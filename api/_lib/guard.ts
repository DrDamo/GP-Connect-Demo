import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Shared request guard for the terminology proxy functions. Every call
// spends the project's NHS England Terminology Server system-to-system
// credentials, so callers must be signed-in users of this app.
//
// No CORS headers are sent: the frontend calls /api on its own origin, so
// browsers on any other origin are refused by the same-origin policy (a
// cross-origin preflight gets a 405 below). Non-browser clients are stopped
// by the token check instead.

/** Upper bound on codes per batch request. Real GP Connect bundles carry a
 *  few hundred unique SNOMED CT codes; this leaves ample headroom while
 *  bounding the upstream fan-out (200 codes per upstream round trip). */
export const MAX_BATCH_CODES = 5000

/** SCTIDs are at most 18 digits; anything much longer is not a code. */
const MAX_CODE_LENGTH = 32

/** Longest search string accepted by the search endpoints. */
export const MAX_QUERY_LENGTH = 200

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return supabase
}

function bearerToken(req: VercelRequest): string {
  const header = req.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

/**
 * Checks the HTTP method and the caller's Supabase access token. On failure
 * it writes the error response itself and returns false; the handler should
 * then just return.
 */
export async function guard(req: VercelRequest, res: VercelResponse, method: 'GET' | 'POST'): Promise<boolean> {
  if (req.method !== method) {
    res.setHeader('Allow', method)
    res.status(405).json({ error: 'Method not allowed' })
    return false
  }

  const jwt = bearerToken(req)
  if (!jwt) {
    res.status(401).json({ error: 'Sign in required' })
    return false
  }

  const client = getSupabase()
  if (!client) {
    console.error('[guard] SUPABASE_URL / SUPABASE_ANON_KEY not set — refusing all terminology requests')
    res.status(500).json({ error: 'Server authentication is not configured' })
    return false
  }

  // getClaims verifies the signature (locally via JWKS for asymmetric keys,
  // otherwise via the Auth server) and the expiry. The role/sub checks reject
  // the anon key itself, which is also a validly signed JWT.
  const { data, error } = await client.auth.getClaims(jwt)
  const claims = data?.claims
  if (error || !claims?.sub || claims.role !== 'authenticated' || claims.is_anonymous === true) {
    res.status(401).json({ error: 'Sign in required' })
    return false
  }

  return true
}

/** Validates a request-body field as a bounded list of short strings.
 *  Returns the list, or an error message for a 400 response. */
export function parseCodeList(value: unknown, field: string): string[] | { error: string } {
  if (!Array.isArray(value) || !value.every((c: unknown) => typeof c === 'string')) {
    return { error: `${field} must be an array of strings` }
  }
  if (value.length > MAX_BATCH_CODES) {
    return { error: `Too many codes — maximum ${MAX_BATCH_CODES} per request` }
  }
  if (value.some(c => c.length > MAX_CODE_LENGTH)) {
    return { error: `${field} contains a value longer than ${MAX_CODE_LENGTH} characters` }
  }
  return value
}

/** Parses a `limit` query parameter into an integer in [1, max]. */
export function parseLimit(raw: unknown, fallback: number, max = 50): number {
  const n = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, 1), max)
}
