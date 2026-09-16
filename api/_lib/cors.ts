import type { VercelResponse } from '@vercel/node'

// Restricts the NHS Terminology Server proxy endpoints to this app's own
// origin instead of the previous `Access-Control-Allow-Origin: *`. This is
// defence in depth alongside requireUser() (see requireUser.ts) — the auth
// check is what actually stops an unauthenticated caller, since CORS is
// only enforced by browsers and never stops a direct curl/script request.
const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? 'https://gp-connect-demo.vercel.app'

export function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Vary', 'Origin')
}
