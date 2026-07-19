import { Router } from 'express'
import { expandValueSet } from '../fhir/expand.js'
import { lookupCode } from '../fhir/lookup.js'
import { dmdValueSetUrl, toDmdResult, toDmdDetail, pickParentVmpCode, mergeParentVmpDetail } from '../fhir/mappers.js'

export const dmdRouter = Router()

// GET /api/dmd/search?q=metformin&type=vmp&limit=25
// type defaults to vmp; also accepts amp
// Response: { codes: DmdResult[] }
dmdRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(parseInt(String(req.query.limit ?? '25'), 10), 50)
  const rawType = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'vmp'
  const type = rawType === 'amp' ? 'amp' : 'vmp'

  if (q.length < 2) {
    res.json({ codes: [] })
    return
  }

  try {
    const vsUrl = dmdValueSetUrl(type)
    const items = await expandValueSet(vsUrl, q, limit)
    res.json({ codes: items.map(item => toDmdResult(item, type === 'vmp' ? 'VMP' : 'AMP')) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[dmd/search]', message)
    res.status(502).json({ error: message })
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
    : 'http://snomed.info/sct'
  const rawType = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'vmp'
  const type = rawType === 'amp' ? 'AMP' : 'VMP'

  if (!code) {
    res.status(400).json({ error: 'code is required' })
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
    const message = err instanceof Error ? err.message : String(err)
    console.error('[dmd/lookup]', message)
    res.status(502).json({ error: message })
  }
})
