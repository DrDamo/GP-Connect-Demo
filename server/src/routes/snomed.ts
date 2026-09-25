import { Router } from 'express'
import { expandValueSet } from '../fhir/expand.js'
import { lookupCode, validateCodesBatch, lookupStatusBatch, checkCodesBatch, looksLikeDescriptionId, resolveDescriptionIdToConcept } from '../fhir/lookup.js'
import { snomedValueSetUrl, toSnomedResult, toSnomedDetail } from '../fhir/mappers.js'

const SNOMED_SYSTEM = 'http://snomed.info/sct'

export const snomedRouter = Router()

// GET /api/snomed/search?q=diabetes&limit=10&semantic_tag=disorder,finding
// Response matches the SnomedPicker contract: { codes: SnomedResult[] }
snomedRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 50)
  const semanticTag = typeof req.query.semantic_tag === 'string' ? req.query.semantic_tag : undefined

  if (q.length < 2) {
    res.json({ codes: [] })
    return
  }

  try {
    const vsUrl = snomedValueSetUrl(semanticTag)
    const items = await expandValueSet(vsUrl, q, limit)
    res.json({ codes: items.map(toSnomedResult) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snomed/search]', message)
    res.status(502).json({ error: message })
  }
})

// GET /api/snomed/lookup?code=73211009&system=http://snomed.info/sct
// system defaults to SNOMED CT. Response: { raw: Parameters, detail: SnomedDetail } —
// raw is the full FHIR CodeSystem/$lookup response (for inspecting anything
// the mapper doesn't surface), detail pulls out inactive/parent/child/
// designations/attributes generically (see toSnomedDetail — there's no fixed
// attribute set for arbitrary SNOMED concepts the way there is for dm+d).
snomedRouter.get('/lookup', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : ''
  const system = typeof req.query.system === 'string' && req.query.system
    ? req.query.system
    : 'http://snomed.info/sct'

  if (!code) {
    res.status(400).json({ error: 'code is required' })
    return
  }

  try {
    const raw = await lookupCode(system, code)
    res.json({ raw, detail: toSnomedDetail(raw) })
  } catch (err) {
    // $lookup only resolves concept ids — if this looks like a SNOMED CT
    // description id instead (e.g. a Coding's `descriptionId` extension
    // value from a GP Connect/CareConnect record), resolve it to its owning
    // concept and look that up instead (see resolveDescriptionIdToConcept).
    if (system === SNOMED_SYSTEM && looksLikeDescriptionId(code)) {
      try {
        const conceptCode = await resolveDescriptionIdToConcept(code)
        if (conceptCode) {
          const raw = await lookupCode(system, conceptCode)
          res.json({ raw, detail: toSnomedDetail(raw), resolvedFromDescriptionId: code })
          return
        }
        // Structurally a description id, but resolveDescriptionIdToConcept's
        // $expand search found no match — confirmed live that this Ontoserver
        // instance's search index only covers active descriptions, so this is
        // almost always an inactive/historical description (e.g. a
        // superseded synonym still referenced by an old clinical record),
        // not a genuinely made-up number. There's no FHIR-standard operation
        // to resolve those, so this is a real terminology-server limitation,
        // not something retryable.
        res.status(502).json({
          error: `Could not resolve description ID ${code} to a concept — it looks like an inactive/historical SNOMED CT description, which this terminology server's search doesn't index.`,
        })
        return
      } catch { /* resolution itself errored (network/server) — fall through to the original error below */ }
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snomed/lookup]', message)
    res.status(502).json({ error: message })
  }
})

// POST /api/snomed/validate-batch  { codes: string[] }
// Response: { results: { [code]: boolean } } — whether each code is a valid
// SNOMED CT concept ID. Used to check every SNOMED coding in a loaded GP
// Connect bundle in one round trip rather than one $lookup per code.
snomedRouter.post('/validate-batch', async (req, res) => {
  const codes = req.body?.codes

  if (!Array.isArray(codes) || !codes.every(c => typeof c === 'string')) {
    res.status(400).json({ error: 'codes must be an array of strings' })
    return
  }

  try {
    const results = await validateCodesBatch(codes)
    res.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snomed/validate-batch]', message)
    res.status(502).json({ error: message })
  }
})

// POST /api/snomed/status-batch  { codes: string[], medicationCodes?: string[] }
// Response: { results: { [code]: { inactive?: boolean; withdrawn?: boolean } } }
// Bulk active/inactive check for every SNOMED CT coding in a loaded bundle,
// tagging in the UI only — this never feeds the transfer-degrade check above
// (inactive concepts are still valid and must not be degraded). Codes in
// `medicationCodes` (a subset of `codes`) also get a `withdrawn` flag when
// their dm+d prescribing/non-availability status indicates the AMP's been
// discontinued.
snomedRouter.post('/status-batch', async (req, res) => {
  const codes = req.body?.codes
  const medicationCodes = req.body?.medicationCodes

  if (!Array.isArray(codes) || !codes.every((c: unknown) => typeof c === 'string')) {
    res.status(400).json({ error: 'codes must be an array of strings' })
    return
  }
  if (medicationCodes !== undefined && (!Array.isArray(medicationCodes) || !medicationCodes.every((c: unknown) => typeof c === 'string'))) {
    res.status(400).json({ error: 'medicationCodes must be an array of strings' })
    return
  }

  try {
    const results = await lookupStatusBatch(codes, new Set(medicationCodes ?? []))
    res.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snomed/status-batch]', message)
    res.status(502).json({ error: message })
  }
})

// POST /api/snomed/check-batch  { codes: string[] }
// Response: { results: { [code]: { found, inactive?, display?, fsn? } } }
// Powers the Tools → SNOMED CT Code Checker: existence, active/inactive
// status and matched term for an arbitrary pasted/imported list of codes.
const CHECK_BATCH_MAX_CODES = 5000

snomedRouter.post('/check-batch', async (req, res) => {
  const codes = req.body?.codes

  if (!Array.isArray(codes) || !codes.every((c: unknown) => typeof c === 'string')) {
    res.status(400).json({ error: 'codes must be an array of strings' })
    return
  }
  if (codes.length > CHECK_BATCH_MAX_CODES) {
    res.status(400).json({ error: `Too many codes — maximum ${CHECK_BATCH_MAX_CODES} per request` })
    return
  }

  try {
    const results = await checkCodesBatch(codes)
    res.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snomed/check-batch]', message)
    res.status(502).json({ error: message })
  }
})
