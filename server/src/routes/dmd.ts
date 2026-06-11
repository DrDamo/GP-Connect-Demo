import { Router } from 'express'
import { expandValueSet } from '../fhir/expand.js'
import { dmdValueSetUrl, toDmdResult } from '../fhir/mappers.js'

export const dmdRouter = Router()

// GET /api/dmd/search?q=metformin&type=vmp&limit=10
// type defaults to vmp; also accepts amp
// Response: { codes: DmdResult[] }
dmdRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 50)
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
