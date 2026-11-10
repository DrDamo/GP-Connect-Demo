import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkCodesBatch } from '../_lib/lookup'
import { guard, parseCodeList } from '../_lib/guard'
import { sendUpstreamError } from '../_lib/errors'

// POST /api/snomed/check-batch  { codes: string[] }
// Response: { results: { [code]: { found, inactive?, display?, fsn? } } }
// Powers the Tools → SNOMED CT Code Checker: existence, active/inactive
// status and matched term for an arbitrary pasted/imported list of codes.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await guard(req, res, 'POST'))) return

  const codes = parseCodeList(req.body?.codes, 'codes')
  if ('error' in codes) { res.status(400).json(codes); return }

  try {
    const results = await checkCodesBatch(codes)
    res.json({ results })
  } catch (err) {
    sendUpstreamError(res, 'snomed/check-batch', err)
  }
}
