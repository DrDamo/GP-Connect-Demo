import { Router } from 'express'
import { expandValueSet } from '../fhir/expand.js'
import { snomedValueSetUrl, toSnomedResult } from '../fhir/mappers.js'

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
