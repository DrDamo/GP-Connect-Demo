import { useReducer, useEffect } from 'react'
import { BUILDER_DRAFT_STORAGE_KEY } from '../../lib/localPatientData'
import type { DraftRecord } from '../types'
import { draftReducer } from './draft/reducer'
import { createEmptyDraft, migrateDraft } from './draft/helpers'

// The reducer is split by record domain under ./draft/. These re-exports keep
// the forms' existing imports working.
export type { DraftAction } from './draft/actions'
export { newTempId } from './draft/helpers'

// Hook
// ---------------------------------------------------------------------------

export function useDraftRecord() {
  const [draft, dispatch] = useReducer(draftReducer, undefined, () => {
    try {
      const stored = localStorage.getItem(BUILDER_DRAFT_STORAGE_KEY)
      if (stored) {
        return migrateDraft(JSON.parse(stored) as DraftRecord)
      }
    } catch { /* storage unavailable */ }
    return createEmptyDraft()
  })

  useEffect(() => {
    try {
      localStorage.setItem(BUILDER_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    } catch { /* storage unavailable */ }
  }, [draft])

  return { draft, dispatch }
}
