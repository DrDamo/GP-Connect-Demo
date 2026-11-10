import type { DraftRecord } from '../../types'
import type { DraftAction } from './actions'
import { newTempId, updateById, removeById } from './helpers'

/** Patient, organisation, practitioners and locations.
 *  Returns undefined for actions outside this group. */
export function reduceAdmin(state: DraftRecord, action: DraftAction): DraftRecord | undefined {
  switch (action.type) {
    // --- Patient / Org ---
    case 'SET_PATIENT':
      return { ...state, patient: { ...state.patient, ...action.payload } }

    case 'SET_ORGANISATION':
      return { ...state, organisation: { ...state.organisation, ...action.payload } }

    // --- Practitioners ---
    case 'ADD_PRACTITIONER':
      return {
        ...state,
        practitioners: [...state.practitioners, { _tempId: newTempId() }],
      }

    case 'UPDATE_PRACTITIONER':
      return {
        ...state,
        practitioners: updateById(state.practitioners, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_PRACTITIONER':
      return {
        ...state,
        practitioners: removeById(state.practitioners, action.payload),
      }

    // --- Locations ---
    case 'ADD_LOCATION':
      return {
        ...state,
        locations: [...state.locations, { _tempId: newTempId() }],
      }

    case 'UPDATE_LOCATION':
      return {
        ...state,
        locations: updateById(state.locations, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_LOCATION':
      return {
        ...state,
        locations: removeById(state.locations, action.payload),
      }

    // --- Organisations (additional) ---
    case 'ADD_ORGANISATION':
      return {
        ...state,
        organisations: [...state.organisations, { _tempId: newTempId() }],
      }

    case 'ADD_ORGANISATION_WITH_ID':
      return {
        ...state,
        organisations: [...state.organisations, { _tempId: action.payload }],
      }

    case 'UPDATE_ORGANISATION':
      return {
        ...state,
        organisations: updateById(state.organisations, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_ORGANISATION':
      return {
        ...state,
        organisations: removeById(state.organisations, action.payload),
      }

    default:
      return undefined
  }
}
