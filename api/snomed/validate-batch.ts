import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateCodesBatch } from '../_lib/lookup'

// POST /api/snomed/validate-batch  { codes: string[] }
// Response: { results: { [code]: boolean } } — whether each code is a valid
// SNOMED CT concept ID. Used to check every SNOMED coding in a loaded GP
// Connect bundle in one round trip rather than one $lookup per code.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const codes = req.body?.codes

  if (!Array.isArray(codes) || !codes.every((c: unknown) => typeof c === 'string')) {
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
}
