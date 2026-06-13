import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(410).json({
    error: 'Client credentials are managed server-side. No user login required. Point the server URL to this proxy and use Verify & Save with any placeholder token.',
  })
}
