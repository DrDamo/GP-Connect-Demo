import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateDmdCodesBatch } from '../_lib/lookup'
import { setCors } from '../_lib/cors'
import { requireUser } from '../_lib/requireUser'

const MAX_BATCH_CODES = 2000

// POST /api/dmd/validate-batch  { codes: string[] }
// Response: { results: { [code]: boolean } } — true when the code is a
// member of the dm+d VMP/AMP ValueSet, false otherwise (including codes that
// are valid SNOMED CT concepts but not dm+d products at all).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  if (!(await requireUser(req))) { res.status(401).json({ error: 'Sign in required' }); return }

  const codes = req.body?.codes

  if (!Array.isArray(codes) || !codes.every((c: unknown) => typeof c === 'string')) {
    res.status(400).json({ error: 'codes must be an array of strings' })
    return
  }
  if (codes.length > MAX_BATCH_CODES) {
    res.status(413).json({ error: `Too many codes (max ${MAX_BATCH_CODES})` })
    return
  }

  try {
    const results = await validateDmdCodesBatch(codes)
    res.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[dmd/validate-batch]', message)
    res.status(502).json({ error: message })
  }
}
