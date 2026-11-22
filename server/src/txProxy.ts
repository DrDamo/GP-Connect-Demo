import express, { type Request, type Response } from 'express'
import { timingSafeEqual, createHash } from 'node:crypto'
import { config } from './config.js'
import { getToken } from './auth.js'
import { toStu3CapabilityStatement, toStu3TerminologyParameters, adaptParameters } from './fhir/txStu3.js'

// Terminology passthrough for the profile validator (validator/), served on
// its own port (TX_PROXY_PORT) that Caddy never routes to, so only containers
// on the Docker networks can reach it. Callers must send the shared secret
// TX_PROXY_TOKEN as a bearer token; it is swapped for the NHS OAuth token.
// Only the read-only terminology operations the validator uses are allowed.

const ALLOWED = /^\/(metadata|(CodeSystem|ValueSet)\/\$(validate-code|lookup|expand|subsumes))(\?|$)/

const digest = (s: string) => createHash('sha256').update(s).digest()

function authorised(req: Request): boolean {
  const header = req.headers.authorization ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7) : ''
  return !!given && timingSafeEqual(digest(given), digest(config.txProxyToken))
}

export function createTxProxy() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.raw({ type: () => true, limit: '5mb' }))

  app.use(async (req: Request, res: Response) => {
    if (!authorised(req)) {
      res.status(401).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login' }] })
      return
    }
    if (!ALLOWED.test(req.url) || !['GET', 'POST'].includes(req.method)) {
      res.status(403).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden' }] })
      return
    }

    let body: Buffer | undefined = req.method === 'POST' && Buffer.isBuffer(req.body) && req.body.length ? req.body : undefined
    if (body && /\$(validate-code|expand|lookup)/.test(req.url)) {
      try { body = Buffer.from(JSON.stringify(adaptParameters(JSON.parse(body.toString())))) } catch { /* not JSON: forward as is */ }
    }

    try {
      const upstream = await fetch(config.fhirBase + req.url, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          Accept: 'application/fhir+json',
          ...(body ? { 'Content-Type': 'application/fhir+json' } : {}),
        },
        body: body ? new Uint8Array(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      })
      let out = Buffer.from(await upstream.arrayBuffer())
      if (upstream.ok && req.url.startsWith('/metadata')) {
        const resource = JSON.parse(out.toString())
        out = Buffer.from(JSON.stringify(resource.resourceType === 'TerminologyCapabilities'
          ? toStu3TerminologyParameters(resource)
          : toStu3CapabilityStatement(resource)))
      }
      if (!upstream.ok) {
        // The server's own explanation (never record content) helps diagnose
        // value sets it cannot handle.
        let reason = ''
        try {
          const oo = JSON.parse(out.toString()) as { issue?: { details?: { text?: string }; diagnostics?: string }[] }
          reason = (oo.issue?.[0]?.details?.text ?? oo.issue?.[0]?.diagnostics ?? '').slice(0, 200)
        } catch { /* not JSON */ }
        console.warn('[tx-proxy]', upstream.status, req.method, req.url.split('?')[0], reason)
      }
      res.status(upstream.status).type('application/fhir+json').send(out)
    } catch (err) {
      console.error('[tx-proxy]', req.method, req.url.split('?')[0], err instanceof Error ? err.message : err)
      res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception' }] })
    }
  })
  return app
}
