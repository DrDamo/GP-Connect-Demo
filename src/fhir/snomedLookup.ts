import type { SnomedDetail } from './types'

// Same dev/prod base-URL logic as checkSnomedStatuses (snomedDegrade.ts) and
// SnomedPicker — the dev Express proxy runs on :3001, everywhere else the
// Vercel functions are same-origin.
const DEFAULT_SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin

const SNOMED_SYSTEM = 'http://snomed.info/sct'

// Caches by `${system}|${code}` for the lifetime of the page — hovering (or
// looking up) the same code more than once in a session shouldn't re-hit the
// terminology server.
const cache = new Map<string, SnomedDetail>()

/**
 * Fetches full terminology detail (fully specified name, synonyms, parsed
 * attributes, active/inactive) for a single SNOMED CT concept — dm+d
 * VMP/AMP codes included, since they're ordinary SNOMED CT concepts under
 * the same system. Throws with a message suitable for direct display on a
 * non-OK response (unrecognised code, or a genuine server/network failure).
 */
export async function fetchSnomedDetail(
  code: string,
  system: string = SNOMED_SYSTEM,
  signal?: AbortSignal,
): Promise<SnomedDetail> {
  const cacheKey = `${system}|${code}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({ code, system })
  const res = await fetch(`${DEFAULT_SERVER_URL}/api/snomed/lookup?${params}`, { signal })

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    // The proxy always returns 502 for any upstream $lookup failure (the NHS
    // terminology server has no distinct "not found" status) — a 404-shaped
    // message in the body means the code genuinely doesn't exist; anything
    // else is a real outage/auth/network problem worth showing verbatim.
    if (body?.error?.includes('HTTP 404')) throw new Error(`No SNOMED CT concept found for code ${code}`)
    throw new Error(body?.error || `SNOMED lookup failed (HTTP ${res.status})`)
  }

  const body = (await res.json()) as { detail: SnomedDetail; resolvedFromDescriptionId?: string }
  const detail: SnomedDetail = body.resolvedFromDescriptionId
    ? { ...body.detail, resolvedFromDescriptionId: body.resolvedFromDescriptionId }
    : body.detail
  // Cached under the description id too — a second hover/lookup of the same
  // description id should hit cache rather than re-resolving it.
  cache.set(cacheKey, detail)
  return detail
}
