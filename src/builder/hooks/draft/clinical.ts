import type { DraftRecord } from '../../types'
import type { DraftAction } from './actions'
import { newTempId, updateById, removeById } from './helpers'

/** Allergies, problems, immunisations, referrals, diary entries, coded data and documents.
 *  Returns undefined for actions outside this group. */
export function reduceClinical(state: DraftRecord, action: DraftAction): DraftRecord | undefined {
  switch (action.type) {
    // --- Allergies ---
    case 'ADD_ALLERGY':
      return {
        ...state,
        allergies: [...state.allergies, { _tempId: newTempId() }],
      }

    case 'UPDATE_ALLERGY':
      return {
        ...state,
        allergies: updateById(state.allergies, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_ALLERGY':
      return {
        ...state,
        allergies: removeById(state.allergies, action.payload),
      }

    // --- Problems ---
    case 'ADD_PROBLEM':
      return {
        ...state,
        problems: [...state.problems, { _tempId: newTempId() }],
      }

    case 'UPDATE_PROBLEM':
      return {
        ...state,
        problems: updateById(state.problems, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_PROBLEM':
      return {
        ...state,
        problems: removeById(state.problems, action.payload),
      }

    // --- Immunisations ---
    case 'ADD_IMMUNISATION':
      return {
        ...state,
        immunisations: [...state.immunisations, { _tempId: newTempId() }],
      }

    case 'UPDATE_IMMUNISATION':
      return {
        ...state,
        immunisations: updateById(state.immunisations, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_IMMUNISATION':
      return {
        ...state,
        immunisations: removeById(state.immunisations, action.payload),
      }

    // --- Referrals ---
    case 'ADD_REFERRAL':
      return {
        ...state,
        referrals: [...state.referrals, { _tempId: newTempId() }],
      }

    case 'UPDATE_REFERRAL':
      return {
        ...state,
        referrals: updateById(state.referrals, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_REFERRAL':
      return {
        ...state,
        referrals: removeById(state.referrals, action.payload),
      }

    // --- Diary entries ---
    case 'ADD_DIARY_ENTRY':
      return {
        ...state,
        diaryEntries: [...state.diaryEntries, { _tempId: newTempId() }],
      }

    case 'UPDATE_DIARY_ENTRY':
      return {
        ...state,
        diaryEntries: updateById(state.diaryEntries, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_DIARY_ENTRY':
      return {
        ...state,
        diaryEntries: removeById(state.diaryEntries, action.payload),
      }

    // --- Coded data ---
    case 'ADD_CODED_DATA':
      return {
        ...state,
        codedData: [...state.codedData, { _tempId: newTempId() }],
      }

    case 'UPDATE_CODED_DATA':
      return {
        ...state,
        codedData: updateById(state.codedData, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_CODED_DATA':
      return {
        ...state,
        codedData: removeById(state.codedData, action.payload),
      }

    // --- Documents ---
    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [...state.documents, { _tempId: newTempId() }],
      }

    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: updateById(state.documents, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_DOCUMENT':
      return {
        ...state,
        documents: removeById(state.documents, action.payload),
      }

    default:
      return undefined
  }
}
