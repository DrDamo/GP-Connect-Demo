// Request-input limits for the terminology routes. Every request spends the
// project's NHS England Terminology Server credentials, so inputs are bounded
// before anything is sent upstream.

/** Upper bound on codes per batch request. Real GP Connect bundles carry a
 *  few hundred unique SNOMED CT codes; this leaves ample headroom while
 *  bounding the upstream fan-out (200 codes per upstream round trip). */
export const MAX_BATCH_CODES = 5000

/** SCTIDs are at most 18 digits; anything much longer is not a code. */
const MAX_CODE_LENGTH = 32

/** Longest search string accepted by the search endpoints. */
export const MAX_QUERY_LENGTH = 200

export const SNOMED_SYSTEM = 'http://snomed.info/sct'

/** SCTIDs (concept and description ids alike) are 6–18 digits. */
export function isSctid(code: string): boolean {
  return /^\d{6,18}$/.test(code)
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
