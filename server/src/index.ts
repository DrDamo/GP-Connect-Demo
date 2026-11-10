import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { snomedRouter } from './routes/snomed.js'
import { dmdRouter } from './routes/dmd.js'
import { healthRouter } from './routes/health.js'
import { rateLimit } from './rateLimit.js'

// NHS England Terminology Server proxy. It holds the system-to-system
// credentials, so nothing here should be reachable by arbitrary clients:
// it listens on loopback by default (see HOST) and only the origins in
// CORS_ORIGINS may call it from a browser.
//
// NOTE: there is no user authentication yet. Before exposing this beyond
// localhost, put it behind the app's login (reverse-proxy auth or a
// middleware on /api/snomed and /api/dmd).

const app = express()

app.disable('x-powered-by')
if (config.trustProxy) app.set('trust proxy', config.trustProxy)

app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }))
// Batch bodies are code lists (≤ 5000 short strings); nothing legitimate is near 1 MB.
app.use(express.json({ limit: '1mb' }))

app.use('/api/health', healthRouter)

const limiter = rateLimit({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax })
app.use('/api/snomed', limiter, snomedRouter)
app.use('/api/dmd', limiter, dmdRouter)

// Unknown API paths get a JSON 404 rather than falling through to whatever
// serves the frontend.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(config.port, config.host, () => {
  console.log(`NHS Terminology Proxy listening on http://${config.host}:${config.port}`)
  console.log(`FHIR base: ${config.fhirBase}`)
})
