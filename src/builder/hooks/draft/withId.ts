import type { DraftRecord } from '../../types'
import type { DraftAction } from './actions'
import { today, DEFAULT_CONSULTATION_TYPE, defaultMedication, defaultAllergy, defaultInvestigation, defaultReferral, defaultDiaryEntry, defaultDocument } from './helpers'

/** ADD_*_WITH_ID variants: add a record under a caller-chosen id (used when a form links the new record immediately).
 *  Returns undefined for actions outside this group. */
export function reduceWithId(state: DraftRecord, action: DraftAction): DraftRecord | undefined {
  switch (action.type) {
    // --- WITH_ID variants ---
    case 'ADD_MEDICATION_WITH_ID':
      return {
        ...state,
        medications: [...state.medications, defaultMedication(action.payload)],
      }

    case 'ADD_ALLERGY_WITH_ID':
      return {
        ...state,
        allergies: [...state.allergies, defaultAllergy(action.payload)],
      }

    case 'ADD_PROBLEM_WITH_ID':
      return {
        ...state,
        problems: [...state.problems, {
          _tempId: action.payload,
          clinicalStatus: 'active',
          startDate: today(),
          assertedDate: today(),
        }],
      }

    case 'ADD_CONSULTATION_WITH_ID':
      return {
        ...state,
        consultations: [...state.consultations, {
          _tempId: action.payload,
          topics: [],
          date: today(),
          ...DEFAULT_CONSULTATION_TYPE,
        }],
      }

    case 'ADD_IMMUNISATION_WITH_ID':
      return {
        ...state,
        immunisations: [...state.immunisations, {
          _tempId: action.payload,
          dateGiven: today(),
          dateRecorded: today(),
        }],
      }

    case 'ADD_INVESTIGATION_WITH_ID':
      return {
        ...state,
        investigations: [...state.investigations, defaultInvestigation(action.payload)],
      }

    case 'ADD_REFERRAL_WITH_ID':
      return {
        ...state,
        referrals: [...state.referrals, defaultReferral(action.payload)],
      }

    case 'ADD_DIARY_ENTRY_WITH_ID':
      return {
        ...state,
        diaryEntries: [...state.diaryEntries, defaultDiaryEntry(action.payload)],
      }

    case 'ADD_CODED_DATA_WITH_ID':
      return {
        ...state,
        codedData: [...state.codedData, { _tempId: action.payload, date: today() }],
      }

    case 'ADD_DOCUMENT_WITH_ID':
      return {
        ...state,
        documents: [...state.documents, defaultDocument(action.payload)],
      }

    case 'ADD_PRACTITIONER_WITH_ID':
      return {
        ...state,
        practitioners: [...state.practitioners, { _tempId: action.payload }],
      }

    case 'ADD_LOCATION_WITH_ID':
      return {
        ...state,
        locations: [...state.locations, { _tempId: action.payload }],
      }

    default:
      return undefined
  }
}
