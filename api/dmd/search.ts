import type { VercelRequest, VercelResponse } from '@vercel/node'
import { expandValueSet } from '../_lib/expand'
import { dmdValueSetUrl, toDmdResult } from '../_lib/mappers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 50)
  const rawType = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'vmp'
  const type = rawType === 'amp' ? 'amp' : 'vmp'

  if (q.length < 2) { res.json({ codes: [] }); return }

  try {
    const vsUrl = dmdValueSetUrl(type)
    const items = await expandValueSet(vsUrl, q, limit)
    res.json({ codes: items.map(item => toDmdResult(item, type === 'vmp' ? 'VMP' : 'AMP')) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[dmd/search]', message)
    res.status(502).json({ error: message })
  }
}
