import type { VercelRequest, VercelResponse } from '@vercel/node'
import { tokenStatus } from './_lib/auth'
import { config } from './_lib/config'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const token = tokenStatus()
  res.json({ status: 'ok', fhirBase: config.fhirBase, token })
}
