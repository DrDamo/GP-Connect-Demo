import { createHash } from 'node:crypto'

// Profile validation results, kept per user for an hour so returning to the
// Validation tab (or re-validating the same record) doesn't re-run a
// 30-60 second validation. Signing out clears that user's results; the
// "Validate again" button bypasses the cache. In memory only: a restart or
// a new deploy empties it.

interface Entry { userId: string; at: number; result: unknown }

const entries = new Map<string, Entry>()
let ttlMs = 60 * 60_000
let maxEntries = 30

export function configureProfileCache(opts: { ttlMs: number; maxEntries: number }): void {
  ttlMs = opts.ttlMs
  maxEntries = opts.maxEntries
}

/** SHA-256 of the record text exactly as sent; the browser computes the same. */
export const recordHash = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

const keyOf = (userId: string, hash: string) => `${userId}:${hash}`

export function getCached(userId: string, hash: string): { at: number; result: unknown } | undefined {
  const key = keyOf(userId, hash)
  const e = entries.get(key)
  if (!e) return undefined
  if (Date.now() - e.at >= ttlMs) {
    entries.delete(key)
    return undefined
  }
  return e
}

export function putCached(userId: string, hash: string, result: unknown): number {
  const key = keyOf(userId, hash)
  const at = Date.now()
  entries.delete(key)
  entries.set(key, { userId, at, result })
  // Oldest first (Map keeps insertion order). Each result can be ~1.5 MB.
  while (entries.size > maxEntries) entries.delete(entries.keys().next().value!)
  return at
}

/** Drops every cached result for a user (on sign-out). */
export function clearCachedForUser(userId: string): void {
  for (const [key, e] of entries) if (e.userId === userId) entries.delete(key)
}
