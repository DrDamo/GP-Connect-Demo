import type { VercelRequest, VercelResponse } from '@vercel/node'
import { lookupStatusBatch } from '../_lib/lookup'

// POST /api/snomed/status-batch  { codes: string[], medicationCodes?: string[] }
// Response: { results: { [code]: { inactive?: boolean; withdrawn?: boolean } } }
// Bulk active/inactive check for every SNOMED CT coding in a loaded bundle,
// tagging in the UI only — this never feeds the transfer-degrade check
// (see validate-batch). Codes in `medicationCodes` (a subset of `codes`) also
// get a `withdrawn` flag when their dm+d prescribing/non-availability status
// indicates the AMP's been discontinued.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const codes = req.body?.codes
  const medicationCodes = req.body?.medicationCodes

  if (!Array.isArray(codes) || !codes.every((c: unknown) => typeof c === 'string')) {
    res.status(400).json({ error: 'codes must be an array of strings' })
    return
  }
  if (medicationCodes !== undefined && (!Array.isArray(medicationCodes) || !medicationCodes.every((c: unknown) => typeof c === 'string'))) {
    res.status(400).json({ error: 'medicationCodes must be an array of strings' })
    return
  }

  try {
    const results = await lookupStatusBatch(codes, new Set(medicationCodes ?? []))
    res.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[snomed/status-batch]', message)
    res.status(502).json({ error: message })
  }
}
