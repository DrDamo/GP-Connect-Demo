import { Router, text, type Request, type Response } from 'express'
import { config } from '../config.js'
import { rateLimit } from '../rateLimit.js'
import { summariseOutcome } from '../fhir/profileOutcome.js'
import { configureProfileCache, getCached, putCached, recordHash } from '../profileCache.js'

// GP Connect STU3 profile validation. The browser posts the record exactly as
// loaded (JSON or XML); it is forwarded to the internal validator container
// (validator/, the HL7 FHIR validator in server mode, terminology off) and
// the OperationOutcome comes back summarised. Nothing is stored.

export const profileValidationRouter = Router()

/** Packages the validator image loads (validator/Dockerfile IGS). */
const PACKAGES = ['uk.gpc.struct#1.5.0', 'careconnect.stu3.03.00.00#3.1.0']

/** The validator checks codes against the NHS server when this app runs the
 *  terminology passthrough (the validator's TX_URL must point at it). */
const terminology = () => (config.txProxyPort && config.txProxyToken ? 'nhs' : 'off')

// One validation uses ~1.5 GB in the validator, so run them one at a time.
let busy = false

profileValidationRouter.get('/', (_req, res) => {
  res.json({ enabled: !!config.validatorUrl, packages: PACKAGES, terminology: terminology() })
})

configureProfileCache({ ttlMs: config.validatorCacheMs, maxEntries: config.validatorCacheMax })

const wantsRefresh = (req: Request) => req.query.refresh === '1'

/** A cached result for this user and record, unless a refresh was asked for. */
function cachedFor(req: Request, res: Response) {
  if (wantsRefresh(req) || typeof req.body !== 'string') return undefined
  return getCached(String(res.locals.userId), recordHash(req.body))
}

// Per signed-in user (requireUser runs first and sets res.locals.userId).
// Answers from the cache are not counted.
const perUser = rateLimit({
  windowMs: 60 * 60_000,
  max: config.validatorRateMax,
  key: (_req, res) => String(res.locals.userId),
  skip: (req, res) => !!cachedFor(req, res),
})

// GET /api/profile-validation/result/<sha256 of the record> — this user's
// cached result for that record, so the page can show it again without
// re-sending the record. 404 when there is none (or it has expired).
profileValidationRouter.get('/result/:hash', (req, res) => {
  const hash = String(req.params.hash)
  const hit = /^[0-9a-f]{64}$/.test(hash) ? getCached(String(res.locals.userId), hash) : undefined
  if (!hit) {
    res.status(404).json({ error: 'No cached result' })
    return
  }
  res.json({ ...(hit.result as object), cached: true, validatedAt: new Date(hit.at).toISOString() })
})

// POST /api/profile-validation[?refresh=1] — validates the record, or returns
// this user's result for it from the last hour unless refresh=1.
profileValidationRouter.post(
  '/',
  text({ type: ['application/json', 'application/fhir+json', 'application/xml', 'application/fhir+xml'], limit: config.validatorMaxBytes }),
  perUser,
  async (req, res) => {
    const hit = cachedFor(req, res)
    if (hit) {
      res.json({ ...(hit.result as object), cached: true, validatedAt: new Date(hit.at).toISOString() })
      return
    }
    if (!config.validatorUrl) {
      res.status(503).json({ error: 'Profile validation is not set up on this server' })
      return
    }
    const body = typeof req.body === 'string' ? req.body : ''
    if (!body.trim()) {
      res.status(400).json({ error: 'Send the record as JSON or XML' })
      return
    }
    const isXml = /xml/.test(req.headers['content-type'] ?? '')
    let parsed: unknown
    if (!isXml) {
      try {
        parsed = JSON.parse(body)
      } catch {
        res.status(400).json({ error: 'The record is not valid JSON' })
        return
      }
      if (!parsed || typeof parsed !== 'object' || typeof (parsed as { resourceType?: unknown }).resourceType !== 'string') {
        res.status(400).json({ error: 'The record has no resourceType' })
        return
      }
    }
    if (busy) {
      res.setHeader('Retry-After', '30')
      res.status(503).json({ error: 'Another record is being validated — try again in a minute' })
      return
    }

    busy = true
    const started = Date.now()
    // Stop the validator's work if the browser goes away (tab closed).
    const abort = new AbortController()
    res.on('close', () => { if (!res.writableFinished) abort.abort() })
    try {
      const upstream = await fetch(`${config.validatorUrl}/validateResource`, {
        method: 'POST',
        headers: {
          'Content-Type': isXml ? 'application/fhir+xml' : 'application/fhir+json',
          Accept: 'application/fhir+json',
        },
        body,
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(config.validatorTimeoutMs)]),
      })
      const responseText = await upstream.text()
      let outcome: unknown
      try { outcome = JSON.parse(responseText) } catch { /* handled below */ }
      if (!upstream.ok && (outcome as { resourceType?: string } | undefined)?.resourceType !== 'OperationOutcome') {
        console.error('[profile-validation] HTTP', upstream.status, responseText.slice(0, 500))
        res.status(502).json({ error: `The validator failed (HTTP ${upstream.status})` })
        return
      }
      const result = {
        packages: PACKAGES,
        terminology: terminology(),
        durationMs: Date.now() - started,
        ...summariseOutcome(outcome, parsed, config.validatorMaxIssues),
      }
      const at = putCached(String(res.locals.userId), recordHash(body), result)
      res.json({ ...result, cached: false, validatedAt: new Date(at).toISOString() })
    } catch (err) {
      if (abort.signal.aborted) return
      const timedOut = err instanceof Error && err.name === 'TimeoutError'
      console.error('[profile-validation]', err instanceof Error ? err.message : err)
      res.status(timedOut ? 504 : 502).json({
        error: timedOut ? 'Validation took too long and was stopped' : 'Could not reach the validator',
      })
    } finally {
      busy = false
    }
  },
)
