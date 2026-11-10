import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateDmdCodesBatch } from '../_lib/lookup'
import { guard, parseCodeList } from '../_lib/guard'
import { sendUpstreamError } from '../_lib/errors'

// POST /api/dmd/validate-batch  { codes: string[] }
// Response: { results: { [code]: boolean } } — true when the code is a
// member of the dm+d VMP/AMP ValueSet, false otherwise (including codes that
// are valid SNOMED CT concepts but not dm+d products at all). A code absent
// from `results` could not be checked (its upstream entry failed).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await guard(req, res, 'POST'))) return

  const codes = parseCodeList(req.body?.codes, 'codes')
  if ('error' in codes) { res.status(400).json(codes); return }

  try {
    const results = await validateDmdCodesBatch(codes)
    res.json({ results })
  } catch (err) {
    sendUpstreamError(res, 'dmd/validate-batch', err)
  }
}
