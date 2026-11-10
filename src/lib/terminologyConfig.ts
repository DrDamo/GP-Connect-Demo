// Where the terminology proxy (/api/snomed/*, /api/dmd/*) lives, and the
// dev-only override the SNOMED picker's config modal stores in localStorage.
//
// Production builds always use the page's own origin and ignore anything
// stored: a stale or tampered value must not be able to send search terms,
// codes or the user's session token to another server.

export interface TerminologyConfig {
  serverUrl: string
  /** Bearer token pasted in the dev config modal (direct-server mode). */
  token: string
}

const CONFIG_KEY = 'gpc-snomed-config'
const CHANGE_EVENT = 'gpc-terminology-config-change'

/** The proxy's default location: the page's own origin. In development Vite
 *  forwards /api to the server on :3001, so the session cookie goes with it. */
export const DEFAULT_TERMINOLOGY_URL = window.location.origin

function readStored(): Partial<TerminologyConfig> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<TerminologyConfig>
    // The old default addresses of the dev proxy. Calling it directly would
    // leave out the session cookie, so use the page origin (Vite's proxy).
    if (parsed.serverUrl === 'http://localhost:3000' || parsed.serverUrl === 'http://localhost:3001') {
      parsed.serverUrl = window.location.origin
    }
    return parsed
  } catch {
    return {}
  }
}

/**
 * The configured server for the pickers. In development an unconfigured
 * browser gets `{}`, which the SNOMED picker treats as "not connected" and
 * offers the config modal for.
 */
export function loadTerminologyConfig(): Partial<TerminologyConfig> {
  if (!import.meta.env.DEV) return { serverUrl: window.location.origin, token: '' }
  return readStored()
}

/** The server to call for background checks, falling back to the default. */
export function terminologyServer(): TerminologyConfig {
  const cfg = loadTerminologyConfig()
  return { serverUrl: cfg.serverUrl || DEFAULT_TERMINOLOGY_URL, token: cfg.token ?? '' }
}

/** Stores the dev override (no-op in production) and notifies open pickers. */
export function saveTerminologyConfig(cfg: Partial<TerminologyConfig>): void {
  if (!import.meta.env.DEV) return
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...readStored(), ...cfg }))
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Calls `onChange` when the config is saved in this tab or another one. */
export function subscribeTerminologyConfig(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === CONFIG_KEY) onChange() }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}
