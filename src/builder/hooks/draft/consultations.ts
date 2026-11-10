import type { DraftRecord } from '../../types'
import type {
  DraftConsultationCategory,
  DraftConsultationItem,
} from '../../types'
import type { DraftAction } from './actions'
import { newTempId, today, DEFAULT_CONSULTATION_TYPE, updateById, removeById, addLinkedResource, removeLinkedResource } from './helpers'

/** Consultations and their topics, categories, items and links.
 *  Returns undefined for actions outside this group. */
export function reduceConsultations(state: DraftRecord, action: DraftAction): DraftRecord | undefined {
  switch (action.type) {
    // --- Consultations ---
    case 'ADD_CONSULTATION':
      return {
        ...state,
        consultations: [...state.consultations, { _tempId: newTempId(), topics: [], ...DEFAULT_CONSULTATION_TYPE }],
      }

    case 'UPDATE_CONSULTATION':
      return {
        ...state,
        consultations: updateById(state.consultations, action.payload._tempId, action.payload.updates),
      }

    case 'REMOVE_CONSULTATION':
      return {
        ...state,
        consultations: removeById(state.consultations, action.payload),
      }

    case 'ADD_CONSULTATION_TOPIC': {
      const consTempId = action.payload
      const problemTempId = newTempId()
      const consultation = state.consultations.find(c => c._tempId === consTempId)
      const consultationDate = consultation?.date
      const defaultCategories: DraftConsultationCategory[] = ['History', 'Examination', 'Assessment', 'Plan'].map(title => ({
        _tempId: newTempId(),
        title,
        items: [{ _tempId: newTempId(), itemType: 'note', date: consultationDate }],
      }))
      return {
        ...state,
        problems: [...state.problems, {
          _tempId: problemTempId,
          linkedConsultationTempId: consTempId,
          // The clinician running the encounter is asserting any problem
          // raised in it, unless changed by hand afterwards.
          asserterTempId: consultation?.clinicianTempId,
          clinicalStatus: 'active',
          startDate: today(),
          assertedDate: today(),
        }],
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: [
                  ...c.topics,
                  { _tempId: newTempId(), problemTempId, categories: defaultCategories, items: [] },
                ],
              }
            : c,
        ),
      }
    }

    case 'UPDATE_CONSULTATION_TOPIC': {
      const { consTempId, topicTempId, updates } = action.payload
      return {
        ...state,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? { ...c, topics: updateById(c.topics, topicTempId, updates) }
            : c,
        ),
      }
    }

    case 'REMOVE_CONSULTATION_TOPIC': {
      const { consTempId, topicTempId } = action.payload
      const cons = state.consultations.find(c => c._tempId === consTempId)
      const topic = cons?.topics.find(t => t._tempId === topicTempId)
      return {
        ...state,
        problems: topic?.problemTempId ? removeById(state.problems, topic.problemTempId) : state.problems,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? { ...c, topics: removeById(c.topics, topicTempId) }
            : c,
        ),
      }
    }

    case 'ADD_TOPIC_PROBLEM': {
      const { consTempId, topicTempId } = action.payload
      const problemTempId = newTempId()
      const clinicianTempId = state.consultations.find(c => c._tempId === consTempId)?.clinicianTempId
      return {
        ...state,
        problems: [...state.problems, {
          _tempId: problemTempId,
          linkedConsultationTempId: consTempId,
          // The clinician running the encounter is asserting any problem
          // raised in it, unless changed by hand afterwards.
          asserterTempId: clinicianTempId,
          clinicalStatus: 'active',
          startDate: today(),
          assertedDate: today(),
        }],
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? { ...c, topics: updateById(c.topics, topicTempId, { problemTempId }) }
            : c,
        ),
      }
    }

    case 'REMOVE_TOPIC_PROBLEM': {
      const { consTempId, topicTempId } = action.payload
      const cons = state.consultations.find(c => c._tempId === consTempId)
      const topic = cons?.topics.find(t => t._tempId === topicTempId)
      return {
        ...state,
        problems: topic?.problemTempId ? removeById(state.problems, topic.problemTempId) : state.problems,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? { ...c, topics: updateById(c.topics, topicTempId, { problemTempId: undefined }) }
            : c,
        ),
      }
    }

    case 'ADD_CONSULTATION_CATEGORY': {
      const { consTempId, topicTempId, title } = action.payload
      return {
        ...state,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t =>
                  t._tempId === topicTempId
                    ? {
                        ...t,
                        categories: [
                          ...t.categories,
                          { _tempId: newTempId(), title, items: [] },
                        ],
                      }
                    : t,
                ),
              }
            : c,
        ),
      }
    }

    case 'UPDATE_CONSULTATION_CATEGORY': {
      const { consTempId, topicTempId, catTempId, updates } = action.payload
      return {
        ...state,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t =>
                  t._tempId === topicTempId
                    ? { ...t, categories: updateById(t.categories, catTempId, updates) }
                    : t,
                ),
              }
            : c,
        ),
      }
    }

    case 'REMOVE_CONSULTATION_CATEGORY': {
      const { consTempId, topicTempId, catTempId } = action.payload
      const cons = state.consultations.find(c => c._tempId === consTempId)
      const cat = cons?.topics.find(t => t._tempId === topicTempId)?.categories.find(c => c._tempId === catTempId)
      // A linked-kind category's items are records that only exist because
      // this category created them — remove the whole category and they go
      // with it, same as removing a topic's linked problem.
      const stateAfterCascade = (cat?.linkedRefs ?? []).reduce(
        (s, ref) => removeLinkedResource(s, ref.kind, ref.tempId),
        state,
      )
      return {
        ...stateAfterCascade,
        consultations: stateAfterCascade.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t =>
                  t._tempId === topicTempId
                    ? { ...t, categories: removeById(t.categories, catTempId) }
                    : t,
                ),
              }
            : c,
        ),
      }
    }

    case 'ADD_CONSULTATION_LINKED_ITEM': {
      const { consTempId, topicTempId, title, kind, resourceTempId } = action.payload
      const stateWithResource = addLinkedResource(state, kind, resourceTempId, consTempId)
      return {
        ...stateWithResource,
        consultations: stateWithResource.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t => {
                  if (t._tempId !== topicTempId) return t
                  const existing = t.categories.find(cat => cat.title === title)
                  return existing
                    ? {
                        ...t,
                        categories: updateById(t.categories, existing._tempId, {
                          linkedRefs: [...(existing.linkedRefs ?? []), { kind, tempId: resourceTempId }],
                        }),
                      }
                    : {
                        ...t,
                        categories: [
                          ...t.categories,
                          { _tempId: newTempId(), title, items: [], linkedRefs: [{ kind, tempId: resourceTempId }] },
                        ],
                      }
                }),
              }
            : c,
        ),
      }
    }

    case 'REMOVE_CONSULTATION_LINKED_ITEM': {
      const { consTempId, topicTempId, catTempId, kind, resourceTempId } = action.payload
      const stateWithoutResource = removeLinkedResource(state, kind, resourceTempId)
      return {
        ...stateWithoutResource,
        consultations: stateWithoutResource.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t =>
                  t._tempId === topicTempId
                    ? {
                        ...t,
                        categories: t.categories.map(cat =>
                          cat._tempId === catTempId
                            ? { ...cat, linkedRefs: (cat.linkedRefs ?? []).filter(r => r.tempId !== resourceTempId) }
                            : cat,
                        ),
                      }
                    : t,
                ),
              }
            : c,
        ),
      }
    }

    case 'ADD_CONSULTATION_ITEM': {
      const { consTempId, topicTempId, catTempId } = action.payload
      const consultationDate = state.consultations.find(c => c._tempId === consTempId)?.date
      const newItem: DraftConsultationItem = { _tempId: newTempId(), itemType: 'note', date: consultationDate }
      return {
        ...state,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t =>
                  t._tempId === topicTempId
                    ? catTempId
                      ? {
                          ...t,
                          categories: t.categories.map(cat =>
                            cat._tempId === catTempId
                              ? { ...cat, items: [...cat.items, newItem] }
                              : cat,
                          ),
                        }
                      : { ...t, items: [...t.items, newItem] }
                    : t,
                ),
              }
            : c,
        ),
      }
    }

    case 'UPDATE_CONSULTATION_ITEM': {
      const { consTempId, topicTempId, catTempId, itemTempId, updates } = action.payload
      return {
        ...state,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t =>
                  t._tempId === topicTempId
                    ? catTempId
                      ? {
                          ...t,
                          categories: t.categories.map(cat =>
                            cat._tempId === catTempId
                              ? { ...cat, items: updateById(cat.items, itemTempId, updates) }
                              : cat,
                          ),
                        }
                      : { ...t, items: updateById(t.items, itemTempId, updates) }
                    : t,
                ),
              }
            : c,
        ),
      }
    }

    case 'REMOVE_CONSULTATION_ITEM': {
      const { consTempId, topicTempId, catTempId, itemTempId } = action.payload
      return {
        ...state,
        consultations: state.consultations.map(c =>
          c._tempId === consTempId
            ? {
                ...c,
                topics: c.topics.map(t =>
                  t._tempId === topicTempId
                    ? catTempId
                      ? {
                          ...t,
                          categories: t.categories.map(cat =>
                            cat._tempId === catTempId
                              ? { ...cat, items: removeById(cat.items, itemTempId) }
                              : cat,
                          ),
                        }
                      : { ...t, items: removeById(t.items, itemTempId) }
                    : t,
                ),
              }
            : c,
        ),
      }
    }

    default:
      return undefined
  }
}
