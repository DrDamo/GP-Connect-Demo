/**
 * Headers for a request to the terminology proxy (/api/snomed/*, /api/dmd/*).
 *
 * The proxy only serves signed-in users. The session cookie identifies them
 * and goes with every same-origin request, so normally nothing is added here.
 *
 * `devToken` is the token pasted into the dev-only terminology config modal
 * (direct-server mode). It is ignored in production builds.
 */
export async function terminologyHeaders(
  devToken?: string,
  base: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers = { ...base }
  if (import.meta.env.DEV && devToken) headers.Authorization = `Bearer ${devToken}`
  return headers
}
