import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateCodesBatch } from '../_lib/lookup'
import { guard, parseCodeList } from '../_lib/guard'
import { sendUpstreamError } from '../_lib/errors'

// POST /api/snomed/validate-batch  { codes: string[] }
// Response: { results: { [code]: boolean } } — whether each code is a valid
// SNOMED CT concept ID. Used to check every SNOMED coding in a loaded GP
// Connect bundle in one round trip rather than one $lookup per code.
// A code absent from `results` could not be checked (its upstream entry
// failed) — it is NOT invalid, and must not be transfer-degraded.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await guard(req, res, 'POST'))) return

  const codes = parseCodeList(req.body?.codes, 'codes')
  if ('error' in codes) { res.status(400).json(codes); return }

  try {
    const results = await validateCodesBatch(codes)
    res.json({ results })
  } catch (err) {
    sendUpstreamError(res, 'snomed/validate-batch', err)
  }
}
