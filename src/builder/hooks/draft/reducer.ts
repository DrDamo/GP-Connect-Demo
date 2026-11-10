import type { DraftRecord } from '../../types'
import type { DraftAction } from './actions'
import { migrateDraft, createEmptyDraft } from './helpers'
import { reduceAdmin } from './admin'
import { reduceMedications } from './medications'
import { reduceConsultations } from './consultations'
import { reduceInvestigations } from './investigations'
import { reduceClinical } from './clinical'
import { reduceWithId } from './withId'

const DOMAIN_REDUCERS = [
  reduceAdmin,
  reduceMedications,
  reduceConsultations,
  reduceInvestigations,
  reduceClinical,
  reduceWithId,
]

export function draftReducer(state: DraftRecord, action: DraftAction): DraftRecord {
  switch (action.type) {
    case 'LOAD_DRAFT':
      return migrateDraft(action.payload)

    case 'AUTO_POPULATE':
      return migrateDraft(action.payload)

    case 'CLEAR_ALL':
      return createEmptyDraft()
  }
  for (const reduce of DOMAIN_REDUCERS) {
    const next = reduce(state, action)
    if (next !== undefined) return next
  }
  return state
}
