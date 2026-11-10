import type { VercelRequest, VercelResponse } from '@vercel/node'
import { lookupStatusBatch } from '../_lib/lookup'
import { guard, parseCodeList } from '../_lib/guard'
import { sendUpstreamError } from '../_lib/errors'

// POST /api/snomed/status-batch  { codes: string[], medicationCodes?: string[] }
// Response: { results: { [code]: { inactive?: boolean; withdrawn?: boolean } } }
// Bulk active/inactive check for every SNOMED CT coding in a loaded bundle,
// tagging in the UI only — this never feeds the transfer-degrade check
// (see validate-batch). Codes in `medicationCodes` (a subset of `codes`) also
// get a `withdrawn` flag when their dm+d prescribing/non-availability status
// indicates the AMP's been discontinued.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await guard(req, res, 'POST'))) return

  const codes = parseCodeList(req.body?.codes, 'codes')
  if ('error' in codes) { res.status(400).json(codes); return }

  const rawMedicationCodes = req.body?.medicationCodes
  const medicationCodes = rawMedicationCodes === undefined ? [] : parseCodeList(rawMedicationCodes, 'medicationCodes')
  if ('error' in medicationCodes) { res.status(400).json(medicationCodes); return }

  try {
    const results = await lookupStatusBatch(codes, new Set(medicationCodes))
    res.json({ results })
  } catch (err) {
    sendUpstreamError(res, 'snomed/status-batch', err)
  }
}
