import { supabase } from './supabase'

/**
 * Headers for a request to the terminology proxy (/api/snomed/*, /api/dmd/*).
 *
 * The production proxy only serves signed-in users, so the current Supabase
 * access token is sent as the bearer token. `getSession()` refreshes an
 * expired token before returning it.
 *
 * `devToken` is the token pasted into the dev-only terminology config modal
 * (direct-server mode). It is ignored in production builds so a stale value
 * left in localStorage can never displace the session token.
 */
export async function terminologyHeaders(
  devToken?: string,
  base: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers = { ...base }
  let token = import.meta.env.DEV ? devToken : undefined
  if (!token && supabase) {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}
