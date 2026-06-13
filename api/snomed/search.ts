import type { VercelRequest, VercelResponse } from '@vercel/node'
import { expandValueSet } from '../_lib/expand'
import { snomedValueSetUrl, toSnomedResult } from '../_lib/mappers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 50)
  const semanticTag = typeof req.query.semantic_tag === 'string' ? req.query.semantic_tag : undefined

  if (q.length < 2) { res.json({ codes: [] }); return }

  try {
    const vsUrl = snomedValueSetUrl(semanticTag)
    const items = await expandValueSet(vsUrl, q, limit)
    res.json({ codes: items.map(toSnomedResult) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snomed/search]', message)
    res.status(502).json({ error: message })
  }
}
