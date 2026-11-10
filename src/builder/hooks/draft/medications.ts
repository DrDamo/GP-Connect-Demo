import type { DraftRecord } from '../../types'
import type { DraftAction } from './actions'
import { newTempId, updateById, removeById } from './helpers'

/** Medications: courses, issues, reauthorisation and cancellation.
 *  Returns undefined for actions outside this group. */
export function reduceMedications(state: DraftRecord, action: DraftAction): DraftRecord | undefined {
  switch (action.type) {
    // --- Medications ---
    case 'ADD_MEDICATION':
      return {
        ...state,
        medications: [...state.medications, { _tempId: newTempId(), issues: [] }],
      }

    case 'UPDATE_MEDICATION':
      return {
        ...state,
        medications: updateById(state.medications, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_MEDICATION':
      return {
        ...state,
        medications: removeById(state.medications, action.payload),
      }

    case 'ADD_MEDICATION_ISSUE': {
      const medTempId = action.payload
      return {
        ...state,
        medications: state.medications.map(med =>
          med._tempId === medTempId
            ? { ...med, issues: [...(med.issues ?? []), { _tempId: newTempId() }] }
            : med,
        ),
      }
    }

    case 'ADD_MEDICATION_ISSUE_WITH_ID': {
      const { medTempId, issueTempId, prefill } = action.payload
      return {
        ...state,
        medications: state.medications.map(med =>
          med._tempId === medTempId
            ? { ...med, issues: [...(med.issues ?? []), { _tempId: issueTempId, ...prefill }] }
            : med,
        ),
      }
    }

    case 'ADD_ALL_REPEAT_DISPENSING_ISSUES': {
      const { medTempId, issues } = action.payload
      return {
        ...state,
        medications: state.medications.map(med =>
          med._tempId === medTempId ? { ...med, issues } : med,
        ),
      }
    }

    case 'REAUTHORISE_MEDICATION': {
      const { oldTempId, newTempId: newId } = action.payload
      const today = new Date().toISOString().split('T')[0]
      const oldMed = state.medications.find(m => m._tempId === oldTempId)
      if (!oldMed) return state
      const newMed = {
        ...oldMed,
        _tempId: newId,
        startDate: today,
        endDate: undefined,
        status: 'active',
        stopReason: undefined,
        issues: [],
        reauthorisedFromTempId: oldTempId,
      }
      return {
        ...state,
        medications: [
          ...state.medications.map(m =>
            m._tempId === oldTempId
              ? { ...m, status: 'stopped', endDate: today, stopReason: 'reauthorisation' as const }
              : m,
          ),
          newMed,
        ],
      }
    }

    case 'UPDATE_MEDICATION_ISSUE': {
      const { medTempId, issueTempId, updates } = action.payload
      return {
        ...state,
        medications: state.medications.map(med =>
          med._tempId === medTempId
            ? {
                ...med,
                issues: updateById(med.issues ?? [], issueTempId, updates),
              }
            : med,
        ),
      }
    }

    case 'REMOVE_MEDICATION_ISSUE': {
      const { medTempId, issueTempId } = action.payload
      return {
        ...state,
        medications: state.medications.map(med =>
          med._tempId === medTempId
            ? { ...med, issues: removeById(med.issues ?? [], issueTempId) }
            : med,
        ),
      }
    }

    case 'CANCEL_MEDICATION_ISSUE': {
      const { medTempId, issueTempId, cascade } = action.payload
      return {
        ...state,
        medications: state.medications.map(med => {
          if (med._tempId !== medTempId) return med
          const issues = med.issues ?? []
          if (!cascade) {
            return { ...med, issues: updateById(issues, issueTempId, { status: 'cancelled' }) }
          }
          const idx = issues.findIndex(i => i._tempId === issueTempId)
          if (idx === -1) return med
          return {
            ...med,
            issues: issues.map((issue, i) =>
              i >= idx ? { ...issue, status: 'cancelled' } : issue,
            ),
          }
        }),
      }
    }

    default:
      return undefined
  }
}
