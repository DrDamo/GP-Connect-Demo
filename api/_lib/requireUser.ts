import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

let cachedClient: ReturnType<typeof createClient> | null = null

function authClient() {
  if (cachedClient) return cachedClient
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  cachedClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedClient
}

// Verifies the caller sent a valid Supabase session JWT (the signed-in
// user's own access token, not the app's anon/service-role key) and
// returns that user's id, or null if unauthenticated/invalid. Gates the
// NHS Terminology Server proxy endpoints (api/snomed/*, api/dmd/*) so only
// signed-in users of this app can spend the project's NHS system-to-system
// credentials — see docs/code-review-2026-09-16.md S-09.
//
// Fails closed: if Supabase isn't configured at all in this deployment,
// nobody can authenticate, so every caller is rejected rather than the
// check being silently skipped.
export async function requireUser(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization
  const jwt = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!jwt) return null

  const client = authClient()
  if (!client) return null

  try {
    const { data, error } = await client.auth.getUser(jwt)
    if (error || !data.user) return null
    return data.user.id
  } catch {
    return null
  }
}
