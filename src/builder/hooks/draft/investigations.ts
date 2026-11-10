import type { DraftRecord } from '../../types'
import type { DraftAction } from './actions'
import { newTempId, defaultInvestigation, updateById, removeById } from './helpers'

/** Investigations: test groups, results, specimens and requests.
 *  Returns undefined for actions outside this group. */
export function reduceInvestigations(state: DraftRecord, action: DraftAction): DraftRecord | undefined {
  switch (action.type) {
    // --- Investigations ---
    case 'ADD_INVESTIGATION':
      return {
        ...state,
        investigations: [...state.investigations, defaultInvestigation(newTempId())],
      }

    case 'UPDATE_INVESTIGATION':
      return {
        ...state,
        investigations: updateById(state.investigations, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_INVESTIGATION':
      return {
        ...state,
        investigations: removeById(state.investigations, action.payload),
      }

    case 'ADD_TEST_GROUP': {
      const invTempId = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, testGroups: [...inv.testGroups, { _tempId: newTempId(), results: [] }] }
            : inv,
        ),
      }
    }

    case 'UPDATE_TEST_GROUP': {
      const { invTempId, groupTempId, updates } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, testGroups: updateById(inv.testGroups, groupTempId, updates) }
            : inv,
        ),
      }
    }

    case 'REMOVE_TEST_GROUP': {
      const { invTempId, groupTempId } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, testGroups: removeById(inv.testGroups, groupTempId) }
            : inv,
        ),
      }
    }

    case 'ADD_SPECIMEN': {
      const invTempId = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, specimens: [...inv.specimens, { _tempId: newTempId() }] }
            : inv,
        ),
      }
    }

    case 'UPDATE_SPECIMEN': {
      const { invTempId, specimenTempId, updates } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, specimens: updateById(inv.specimens, specimenTempId, updates) }
            : inv,
        ),
      }
    }

    case 'REMOVE_SPECIMEN': {
      const { invTempId, specimenTempId } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, specimens: removeById(inv.specimens, specimenTempId) }
            : inv,
        ),
      }
    }

    case 'ADD_TEST_REQUEST': {
      const invTempId = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, testRequests: [...inv.testRequests, { _tempId: newTempId() }] }
            : inv,
        ),
      }
    }

    case 'UPDATE_TEST_REQUEST': {
      const { invTempId, requestTempId, updates } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, testRequests: updateById(inv.testRequests, requestTempId, updates) }
            : inv,
        ),
      }
    }

    case 'REMOVE_TEST_REQUEST': {
      const { invTempId, requestTempId } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? { ...inv, testRequests: removeById(inv.testRequests, requestTempId) }
            : inv,
        ),
      }
    }

    case 'ADD_TEST_RESULT': {
      const { invTempId, groupTempId } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? {
                ...inv,
                testGroups: inv.testGroups.map(g =>
                  g._tempId === groupTempId
                    ? { ...g, results: [...g.results, { _tempId: newTempId() }] }
                    : g,
                ),
              }
            : inv,
        ),
      }
    }

    case 'UPDATE_TEST_RESULT': {
      const { invTempId, groupTempId, resultTempId, updates } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? {
                ...inv,
                testGroups: inv.testGroups.map(g =>
                  g._tempId === groupTempId
                    ? { ...g, results: updateById(g.results, resultTempId, updates) }
                    : g,
                ),
              }
            : inv,
        ),
      }
    }

    case 'REMOVE_TEST_RESULT': {
      const { invTempId, groupTempId, resultTempId } = action.payload
      return {
        ...state,
        investigations: state.investigations.map(inv =>
          inv._tempId === invTempId
            ? {
                ...inv,
                testGroups: inv.testGroups.map(g =>
                  g._tempId === groupTempId
                    ? { ...g, results: removeById(g.results, resultTempId) }
                    : g,
                ),
              }
            : inv,
        ),
      }
    }

    default:
      return undefined
  }
}
