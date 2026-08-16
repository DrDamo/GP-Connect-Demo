import { useReducer, useEffect } from 'react'
import type {
  DraftRecord,
  DraftPatient,
  DraftOrganisation,
  DraftPractitioner,
  DraftLocation,
  DraftMedication,
  DraftMedicationIssue,
  DraftAllergy,
  DraftProblem,
  DraftConsultation,
  DraftConsultationTopic,
  DraftConsultationCategory,
  DraftConsultationItem,
  DraftImmunisation,
  DraftInvestigation,
  DraftTestGroup,
  DraftInvestigationResult,
  DraftReferral,
  DraftDiaryEntry,
  DraftCodedDataItem,
  DraftDocument,
} from '../types'

// ---------------------------------------------------------------------------
// Temp ID generation
// ---------------------------------------------------------------------------

export function newTempId(): string {
  return crypto.randomUUID().slice(0, 8)
}

// Default for "when it happened / was recorded" dates on newly added items
// (start, onset, asserted, given, recorded, occurrence start). End/expiry
// style dates stay blank.
function today(): string {
  return new Date().toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Draft migration — normalises a DraftRecord loaded from an external source
// (localStorage, a shared-patient load, an imported bundle-derived draft)
// that may pre-date a shape change. Applied everywhere a draft can enter
// state from outside the reducer's own actions, so old saved data never
// crashes the app — it's just quietly upgraded on load.
// ---------------------------------------------------------------------------

// Pre-Investigations-restructure shape: results sat directly on the
// investigation instead of being nested under testGroups.
interface LegacyDraftInvestigation extends Omit<DraftInvestigation, 'testGroups'> {
  testGroups?: DraftTestGroup[]
  results?: DraftInvestigationResult[]
}

function migrateInvestigation(inv: LegacyDraftInvestigation): DraftInvestigation {
  if (Array.isArray(inv.testGroups)) return inv as DraftInvestigation
  const { results, ...rest } = inv
  return {
    ...rest,
    testGroups: results && results.length > 0
      ? [{ _tempId: newTempId(), name: inv.name, snomedCode: inv.snomedCode, results }]
      : [],
  }
}

function migrateDraft(draft: DraftRecord): DraftRecord {
  return {
    ...draft,
    organisations: Array.isArray(draft.organisations) ? draft.organisations : [],
    investigations: (draft.investigations ?? []).map(inv => migrateInvestigation(inv as LegacyDraftInvestigation)),
  }
}

// ---------------------------------------------------------------------------
// Empty draft factory
// ---------------------------------------------------------------------------

function createEmptyDraft(): DraftRecord {
  return {
    patient: { _tempId: 'patient-1' },
    organisation: { _tempId: 'org-1' },
    organisations: [],
    practitioners: [],
    locations: [],
    medications: [],
    allergies: [],
    problems: [],
    consultations: [],
    immunisations: [],
    investigations: [],
    referrals: [],
    diaryEntries: [],
    codedData: [],
    documents: [],
  }
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type DraftAction =
  // Patient / Org
  | { type: 'SET_PATIENT'; payload: Partial<DraftPatient> }
  | { type: 'SET_ORGANISATION'; payload: Partial<DraftOrganisation> }
  // Practitioners
  | { type: 'ADD_PRACTITIONER' }
  | { type: 'UPDATE_PRACTITIONER'; payload: { _tempId: string; updates: Partial<DraftPractitioner> } }
  | { type: 'REMOVE_PRACTITIONER'; payload: string }
  // Locations
  | { type: 'ADD_LOCATION' }
  | { type: 'UPDATE_LOCATION'; payload: { _tempId: string; updates: Partial<DraftLocation> } }
  | { type: 'REMOVE_LOCATION'; payload: string }
  // Medications
  | { type: 'ADD_MEDICATION' }
  | { type: 'UPDATE_MEDICATION'; payload: { _tempId: string; updates: Partial<DraftMedication> } }
  | { type: 'REMOVE_MEDICATION'; payload: string }
  | { type: 'ADD_MEDICATION_ISSUE'; payload: string }
  | { type: 'ADD_MEDICATION_ISSUE_WITH_ID'; payload: { medTempId: string; issueTempId: string; prefill?: Partial<DraftMedicationIssue> } }
  | { type: 'ADD_ALL_REPEAT_DISPENSING_ISSUES'; payload: { medTempId: string; issues: DraftMedicationIssue[] } }
  | { type: 'REAUTHORISE_MEDICATION'; payload: { oldTempId: string; newTempId: string } }
  | { type: 'UPDATE_MEDICATION_ISSUE'; payload: { medTempId: string; issueTempId: string; updates: Partial<DraftMedicationIssue> } }
  | { type: 'REMOVE_MEDICATION_ISSUE'; payload: { medTempId: string; issueTempId: string } }
  | { type: 'CANCEL_MEDICATION_ISSUE'; payload: { medTempId: string; issueTempId: string; cascade: boolean } }
  // Allergies
  | { type: 'ADD_ALLERGY' }
  | { type: 'UPDATE_ALLERGY'; payload: { _tempId: string; updates: Partial<DraftAllergy> } }
  | { type: 'REMOVE_ALLERGY'; payload: string }
  // Problems
  | { type: 'ADD_PROBLEM' }
  | { type: 'UPDATE_PROBLEM'; payload: { _tempId: string; updates: Partial<DraftProblem> } }
  | { type: 'REMOVE_PROBLEM'; payload: string }
  // Consultations
  | { type: 'ADD_CONSULTATION' }
  | { type: 'UPDATE_CONSULTATION'; payload: { _tempId: string; updates: Partial<DraftConsultation> } }
  | { type: 'REMOVE_CONSULTATION'; payload: string }
  | { type: 'ADD_CONSULTATION_TOPIC'; payload: string }
  | { type: 'UPDATE_CONSULTATION_TOPIC'; payload: { consTempId: string; topicTempId: string; updates: Partial<DraftConsultationTopic> } }
  | { type: 'REMOVE_CONSULTATION_TOPIC'; payload: { consTempId: string; topicTempId: string } }
  | { type: 'ADD_TOPIC_PROBLEM'; payload: { consTempId: string; topicTempId: string } }
  | { type: 'REMOVE_TOPIC_PROBLEM'; payload: { consTempId: string; topicTempId: string } }
  | { type: 'ADD_CONSULTATION_CATEGORY'; payload: { consTempId: string; topicTempId: string; title?: string } }
  | { type: 'UPDATE_CONSULTATION_CATEGORY'; payload: { consTempId: string; topicTempId: string; catTempId: string; updates: Partial<DraftConsultationCategory> } }
  | { type: 'REMOVE_CONSULTATION_CATEGORY'; payload: { consTempId: string; topicTempId: string; catTempId: string } }
  | { type: 'ADD_CONSULTATION_ITEM'; payload: { consTempId: string; topicTempId: string; catTempId?: string } }
  | { type: 'UPDATE_CONSULTATION_ITEM'; payload: { consTempId: string; topicTempId: string; catTempId?: string; itemTempId: string; updates: Partial<DraftConsultationItem> } }
  | { type: 'REMOVE_CONSULTATION_ITEM'; payload: { consTempId: string; topicTempId: string; catTempId?: string; itemTempId: string } }
  // Immunisations
  | { type: 'ADD_IMMUNISATION' }
  | { type: 'UPDATE_IMMUNISATION'; payload: { _tempId: string; updates: Partial<DraftImmunisation> } }
  | { type: 'REMOVE_IMMUNISATION'; payload: string }
  // Investigations
  | { type: 'ADD_INVESTIGATION' }
  | { type: 'UPDATE_INVESTIGATION'; payload: { _tempId: string; updates: Partial<DraftInvestigation> } }
  | { type: 'REMOVE_INVESTIGATION'; payload: string }
  | { type: 'ADD_TEST_GROUP'; payload: string }
  | { type: 'UPDATE_TEST_GROUP'; payload: { invTempId: string; groupTempId: string; updates: Partial<DraftTestGroup> } }
  | { type: 'REMOVE_TEST_GROUP'; payload: { invTempId: string; groupTempId: string } }
  | { type: 'ADD_TEST_RESULT'; payload: { invTempId: string; groupTempId: string } }
  | { type: 'UPDATE_TEST_RESULT'; payload: { invTempId: string; groupTempId: string; resultTempId: string; updates: Partial<DraftInvestigationResult> } }
  | { type: 'REMOVE_TEST_RESULT'; payload: { invTempId: string; groupTempId: string; resultTempId: string } }
  // Referrals
  | { type: 'ADD_REFERRAL' }
  | { type: 'UPDATE_REFERRAL'; payload: { _tempId: string; updates: Partial<DraftReferral> } }
  | { type: 'REMOVE_REFERRAL'; payload: string }
  // Diary entries
  | { type: 'ADD_DIARY_ENTRY' }
  | { type: 'UPDATE_DIARY_ENTRY'; payload: { _tempId: string; updates: Partial<DraftDiaryEntry> } }
  | { type: 'REMOVE_DIARY_ENTRY'; payload: string }
  // Coded data
  | { type: 'ADD_CODED_DATA' }
  | { type: 'UPDATE_CODED_DATA'; payload: { _tempId: string; updates: Partial<DraftCodedDataItem> } }
  | { type: 'REMOVE_CODED_DATA'; payload: string }
  // Documents
  | { type: 'ADD_DOCUMENT' }
  | { type: 'UPDATE_DOCUMENT'; payload: { _tempId: string; updates: Partial<DraftDocument> } }
  | { type: 'REMOVE_DOCUMENT'; payload: string }
  // WITH_ID variants
  | { type: 'ADD_MEDICATION_WITH_ID'; payload: string }
  | { type: 'ADD_ALLERGY_WITH_ID'; payload: string }
  | { type: 'ADD_PROBLEM_WITH_ID'; payload: string }
  | { type: 'ADD_CONSULTATION_WITH_ID'; payload: string }
  | { type: 'ADD_IMMUNISATION_WITH_ID'; payload: string }
  | { type: 'ADD_INVESTIGATION_WITH_ID'; payload: string }
  | { type: 'ADD_REFERRAL_WITH_ID'; payload: string }
  | { type: 'ADD_DIARY_ENTRY_WITH_ID'; payload: string }
  | { type: 'ADD_CODED_DATA_WITH_ID'; payload: string }
  | { type: 'ADD_DOCUMENT_WITH_ID'; payload: string }
  | { type: 'ADD_PRACTITIONER_WITH_ID'; payload: string }
  | { type: 'ADD_LOCATION_WITH_ID'; payload: string }
  // Organisations (additional)
  | { type: 'ADD_ORGANISATION' }
  | { type: 'ADD_ORGANISATION_WITH_ID'; payload: string }
  | { type: 'UPDATE_ORGANISATION'; payload: { _tempId: string; updates: Partial<DraftOrganisation> } }
  | { type: 'REMOVE_ORGANISATION'; payload: string }
  // Global
  | { type: 'LOAD_DRAFT'; payload: DraftRecord }
  | { type: 'AUTO_POPULATE'; payload: DraftRecord }
  | { type: 'CLEAR_ALL' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updateById<T extends { _tempId: string }>(
  arr: T[],
  tempId: string,
  updates: Partial<T>,
): T[] {
  return arr.map(item =>
    item._tempId === tempId ? { ...item, ...updates } : item,
  )
}

function removeById<T extends { _tempId: string }>(arr: T[], tempId: string): T[] {
  return arr.filter(item => item._tempId !== tempId)
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function draftReducer(state: DraftRecord, action: DraftAction): DraftRecord {
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

    // --- Consultations ---
    case 'ADD_CONSULTATION':
      return {
        ...state,
        consultations: [...state.consultations, { _tempId: newTempId(), topics: [] }],
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
      const consultationDate = state.consultations.find(c => c._tempId === consTempId)?.date
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
      return {
        ...state,
        problems: [...state.problems, {
          _tempId: problemTempId,
          linkedConsultationTempId: consTempId,
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
      return {
        ...state,
        consultations: state.consultations.map(c =>
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

    // --- Investigations ---
    case 'ADD_INVESTIGATION':
      return {
        ...state,
        investigations: [...state.investigations, { _tempId: newTempId(), testGroups: [] }],
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

    // --- WITH_ID variants ---
    case 'ADD_MEDICATION_WITH_ID':
      return {
        ...state,
        medications: [...state.medications, {
          _tempId: action.payload,
          issues: [],
          status: 'active',
          route: 'oral',
          startDate: today(),
          prescriptionType: 'acute',
        }],
      }

    case 'ADD_ALLERGY_WITH_ID':
      return {
        ...state,
        allergies: [...state.allergies, {
          _tempId: action.payload,
          status: 'active' as const,
          assertedDate: today(),
          onsetDate: today(),
        }],
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
        investigations: [...state.investigations, { _tempId: action.payload, date: today(), testGroups: [] }],
      }

    case 'ADD_REFERRAL_WITH_ID':
      return {
        ...state,
        referrals: [...state.referrals, { _tempId: action.payload, date: today() }],
      }

    case 'ADD_DIARY_ENTRY_WITH_ID':
      return {
        ...state,
        diaryEntries: [...state.diaryEntries, {
          _tempId: action.payload,
          date: today(),
          occurrenceStart: today(),
        }],
      }

    case 'ADD_CODED_DATA_WITH_ID':
      return {
        ...state,
        codedData: [...state.codedData, { _tempId: action.payload, date: today() }],
      }

    case 'ADD_DOCUMENT_WITH_ID':
      return {
        ...state,
        documents: [...state.documents, { _tempId: action.payload, date: today() }],
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

    // --- Global ---
    case 'LOAD_DRAFT':
      return migrateDraft(action.payload)

    case 'AUTO_POPULATE':
      return migrateDraft(action.payload)

    case 'CLEAR_ALL':
      return createEmptyDraft()

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDraftRecord() {
  const [draft, dispatch] = useReducer(draftReducer, undefined, () => {
    try {
      const stored = localStorage.getItem('gpc-builder-draft')
      if (stored) {
        return migrateDraft(JSON.parse(stored) as DraftRecord)
      }
    } catch {}
    return createEmptyDraft()
  })

  useEffect(() => {
    try {
      localStorage.setItem('gpc-builder-draft', JSON.stringify(draft))
    } catch {}
  }, [draft])

  return { draft, dispatch }
}
