import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkCodesBatch } from '../_lib/lookup'

const MAX_CODES = 5000

// POST /api/snomed/check-batch  { codes: string[] }
// Response: { results: { [code]: { found, inactive?, display?, fsn? } } }
// Powers the Tools → SNOMED CT Code Checker: existence, active/inactive
// status and matched term for an arbitrary pasted/imported list of codes.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const codes = req.body?.codes

  if (!Array.isArray(codes) || !codes.every((c: unknown) => typeof c === 'string')) {
    res.status(400).json({ error: 'codes must be an array of strings' })
    return
  }
  if (codes.length > MAX_CODES) {
    res.status(400).json({ error: `Too many codes — maximum ${MAX_CODES} per request` })
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
}
