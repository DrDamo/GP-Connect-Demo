import { clearFileHistory } from './fileHistory'

/** localStorage key the record builder autosaves the current draft under. */
export const BUILDER_DRAFT_STORAGE_KEY = 'gpc-builder-draft'

/**
 * Removes patient-shaped data this browser keeps between sessions — the
 * builder's autosaved draft and the recent-files cache (bundle text and file
 * handles in IndexedDB) — so it isn't left for the next person to use a
 * shared machine. Called whenever the session ends, not only on "Sign out".
 */
export function clearLocalPatientData(): void {
  try { localStorage.removeItem(BUILDER_DRAFT_STORAGE_KEY) } catch { /* storage unavailable */ }
  void clearFileHistory()
}
