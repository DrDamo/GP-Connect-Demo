import type { VercelRequest, VercelResponse } from '@vercel/node'

// Unauthenticated liveness check. Deliberately reveals nothing about the
// upstream terminology server or the cached token.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({ status: 'ok' })
}
