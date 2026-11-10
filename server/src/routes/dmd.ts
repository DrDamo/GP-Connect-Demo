import { Router } from 'express'
import { sendUpstreamError } from '../errors.js'
import { parseCodeList, parseLimit, isSctid, MAX_QUERY_LENGTH, SNOMED_SYSTEM } from '../validation.js'
import { expandValueSet } from '../fhir/expand.js'
import { lookupCode, validateDmdCodesBatch } from '../fhir/lookup.js'
import { dmdValueSetUrl, toDmdResult, toDmdDetail, pickParentVmpCode, mergeParentVmpDetail } from '../fhir/mappers.js'

export const dmdRouter = Router()

// GET /api/dmd/search?q=metformin&type=vmp&limit=25
// type defaults to vmp; also accepts amp
// Response: { codes: DmdResult[] }
dmdRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = parseLimit(req.query.limit, 25)
  const rawType = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'vmp'
  const type = rawType === 'amp' ? 'amp' : 'vmp'

  if (q.length < 2) {
    res.json({ codes: [] })
    return
  }
  if (q.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `q must be at most ${MAX_QUERY_LENGTH} characters` })
    return
  }

  try {
    const vsUrl = dmdValueSetUrl(type)
    const items = await expandValueSet(vsUrl, q, limit)
    res.json({ codes: items.map(item => toDmdResult(item, type === 'vmp' ? 'VMP' : 'AMP')) })
  } catch (err) {
    sendUpstreamError(res, 'dmd/search', err)
  }
})

// GET /api/dmd/lookup?code=108537001&system=http://snomed.info/sct&type=vmp
// system defaults to SNOMED CT (dm+d codes are SNOMED CT concepts); type
// defaults to vmp and is only used to tag the mapped detail's `type` field.
// For AMPs, strength/ingredient/route are never defined on the AMP itself —
// they're inherited from a parent VMP-equivalent concept — so this also does
// a second $lookup on that parent and fills in the gaps, tagging which
// fields came from there via `detail.fromParentVmp`.
// Response: { raw: Parameters, detail: DmdDetail, parentRaw?: Parameters } —
// raw/parentRaw are the full FHIR responses (for inspecting anything the
// mapper doesn't surface), detail is strength/dose-form/route parsed out of
// their `normalForm` expressions.
dmdRouter.get('/lookup', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : ''
  const system = typeof req.query.system === 'string' && req.query.system
    ? req.query.system
    : SNOMED_SYSTEM
  const rawType = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'vmp'
  const type = rawType === 'amp' ? 'AMP' : 'VMP'

  if (!code) {
    res.status(400).json({ error: 'code is required' })
    return
  }
  if (system !== SNOMED_SYSTEM) {
    res.status(400).json({ error: `Only ${SNOMED_SYSTEM} codes can be looked up` })
    return
  }
  if (!isSctid(code)) {
    res.status(400).json({ error: `${code.slice(0, 40)} is not a SNOMED CT identifier` })
    return
  }

  try {
    const raw = await lookupCode(system, code)
    const detail = toDmdDetail(raw, type)

    let parentRaw
    if (type === 'AMP') {
      const parentCode = pickParentVmpCode(detail)
      if (parentCode) {
        parentRaw = await lookupCode(system, parentCode)
        mergeParentVmpDetail(detail, toDmdDetail(parentRaw, 'VMP'))
      }
    }

    res.json({ raw, detail, parentRaw })
  } catch (err) {
    sendUpstreamError(res, 'dmd/lookup', err)
  }
})

// POST /api/dmd/validate-batch  { codes: string[] }
// Response: { results: { [code]: boolean } } — true when the code is a
// member of the dm+d VMP/AMP ValueSet, false otherwise (including codes that
// are valid SNOMED CT concepts but not dm+d products at all).
dmdRouter.post('/validate-batch', async (req, res) => {
  const codes = parseCodeList(req.body?.codes, 'codes')
  if (!Array.isArray(codes)) { res.status(400).json(codes); return }

  try {
    const results = await validateDmdCodesBatch(codes)
    res.json({ results })
  } catch (err) {
    sendUpstreamError(res, 'dmd/validate-batch', err)
  }
})
