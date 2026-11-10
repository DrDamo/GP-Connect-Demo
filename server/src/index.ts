import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { resolve } from 'path'
import { config } from './config.js'
import { snomedRouter } from './routes/snomed.js'
import { dmdRouter } from './routes/dmd.js'
import { healthRouter } from './routes/health.js'
import { dataRouter } from './routes/data.js'
import { authRouter } from './users/authRoutes.js'
import { requireUser } from './users/sessions.js'
import { rateLimit } from './rateLimit.js'

// The GP Connect Demonstrator backend: sign-in, the app's data and the NHS
// England Terminology Server proxy, plus (in the container) the built
// frontend. It listens on loopback by default (see HOST); in production
// Caddy sits in front of it.

const app = express()

app.disable('x-powered-by')
if (config.trustProxy) app.set('trust proxy', config.trustProxy)

if (config.corsOrigins.length) {
  app.use('/api', cors({ origin: config.corsOrigins, credentials: true }))
}

// Cross-site request guard for every state-changing call. The session cookie
// is SameSite=Lax, which already keeps it off cross-site POSTs; this also
// refuses any write whose Origin isn't this site (or an allowed dev origin).
const allowedOrigins = new Set([config.publicOrigin, ...config.corsOrigins])
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) {
    res.status(403).json({ error: 'Cross-site request refused' })
    return
  }
  next()
})

// Shared-patient drafts carry a whole record; everything else is small.
app.use('/api/drafts', express.json({ limit: '10mb' }))
app.use(express.json({ limit: '1mb' }))

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)

const limiter = rateLimit({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax })
app.use('/api/snomed', limiter, requireUser, snomedRouter)
app.use('/api/dmd', limiter, requireUser, dmdRouter)

app.use('/api', dataRouter)

// Unknown API paths get a JSON 404 rather than the frontend's index.html.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// The built frontend. Hashed assets are cached for a year; index.html is
// revalidated every time so a deploy is picked up immediately.
if (config.staticDir) {
  const root = resolve(config.staticDir)
  app.use('/assets', express.static(resolve(root, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false }))
  app.use(express.static(root, { index: false, maxAge: '1h' }))
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(resolve(root, 'index.html'))
  })
}

// Last resort: log the detail, tell the client only that it failed.
// Express recognises an error handler by its four parameters.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = err as { type?: string; status?: number; message?: string }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request too large' })
    return
  }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }
  // e.g. a missing file under /assets (404) from express.static
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) {
    res.status(e.status).end()
    return
  }
  console.error('[server]', err)
  if (!res.headersSent) res.status(500).json({ error: 'Something went wrong' })
})

app.listen(config.port, config.host, () => {
  console.log(`GP Connect Demonstrator API listening on http://${config.host}:${config.port}`)
})
