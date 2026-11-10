import type { VercelRequest, VercelResponse } from '@vercel/node'
import { expandValueSet } from '../_lib/expand'
import { snomedValueSetUrl, toSnomedResult } from '../_lib/mappers'
import { guard, parseLimit, MAX_QUERY_LENGTH } from '../_lib/guard'
import { sendUpstreamError } from '../_lib/errors'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await guard(req, res, 'GET'))) return

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = parseLimit(req.query.limit, 10)
  const semanticTag = typeof req.query.semantic_tag === 'string' ? req.query.semantic_tag : undefined

  if (q.length < 2) { res.json({ codes: [] }); return }
  if (q.length > MAX_QUERY_LENGTH) { res.status(400).json({ error: `q must be at most ${MAX_QUERY_LENGTH} characters` }); return }

  try {
    const vsUrl = snomedValueSetUrl(semanticTag)
    const items = await expandValueSet(vsUrl, q, limit)
    res.json({ codes: items.map(toSnomedResult) })
  } catch (err) {
    sendUpstreamError(res, 'snomed/search', err)
  }
}
