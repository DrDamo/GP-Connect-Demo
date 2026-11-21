import { Router, text } from 'express'
import { config } from '../config.js'
import { rateLimit } from '../rateLimit.js'
import { summariseOutcome } from '../fhir/profileOutcome.js'

// GP Connect STU3 profile validation. The browser posts the record exactly as
// loaded (JSON or XML); it is forwarded to the internal validator container
// (validator/, the HL7 FHIR validator in server mode, terminology off) and
// the OperationOutcome comes back summarised. Nothing is stored.

export const profileValidationRouter = Router()

/** Packages the validator image loads (validator/Dockerfile IGS). */
const PACKAGES = ['uk.gpc.struct#1.5.0', 'careconnect.stu3.03.00.00#3.1.0']

// One validation uses ~1.5 GB in the validator, so run them one at a time.
let busy = false

profileValidationRouter.get('/', (_req, res) => {
  res.json({ enabled: !!config.validatorUrl, packages: PACKAGES })
})

// Per signed-in user (requireUser runs first and sets res.locals.userId).
const perUser = rateLimit({ windowMs: 60 * 60_000, max: config.validatorRateMax, key: (_req, res) => String(res.locals.userId) })

profileValidationRouter.post(
  '/',
  perUser,
  text({ type: ['application/json', 'application/fhir+json', 'application/xml', 'application/fhir+xml'], limit: config.validatorMaxBytes }),
  async (req, res) => {
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
      res.json({
        packages: PACKAGES,
        durationMs: Date.now() - started,
        ...summariseOutcome(outcome, parsed, config.validatorMaxIssues),
      })
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
