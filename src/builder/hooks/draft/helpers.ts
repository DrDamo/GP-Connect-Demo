import type {
  DraftRecord,
  DraftMedication,
  DraftAllergy,
  ConsultationLinkKind,
  DraftInvestigation,
  DraftTestGroup,
  DraftInvestigationResult,
  DraftSpecimen,
  DraftTestRequest,
  DraftReferral,
  DraftDiaryEntry,
  DraftDocument,
} from '../../types'

// ---------------------------------------------------------------------------
// Temp ID generation
// ---------------------------------------------------------------------------

export function newTempId(): string {
  return crypto.randomUUID().slice(0, 8)
}

// Default for "when it happened / was recorded" dates on newly added items
// (start, onset, asserted, given, recorded, occurrence start). End/expiry
// style dates stay blank.
export function today(): string {
  return new Date().toISOString().split('T')[0]
}

// Default Encounter.type for a newly added consultation — SNOMED CT
// 1258986006 "Face-to-face encounter", the commonest GP Connect consultation
// type. Still a fully editable field in ConsultationForm afterwards.
export const DEFAULT_CONSULTATION_TYPE = { typeCode: '1258986006', typeDisplay: 'Face-to-face encounter' }

// ---------------------------------------------------------------------------
// Default-record factories — shared by the standalone ADD_X_WITH_ID cases
// and by ADD_CONSULTATION_LINKED_ITEM, which creates the same kind of record
// but from inside a consultation's category picker instead of that record's
// own "+ Add" button.
// ---------------------------------------------------------------------------

export function defaultMedication(id: string): DraftMedication {
  return { _tempId: id, issues: [], status: 'active', route: 'oral', startDate: today(), prescriptionType: 'acute' }
}
export function defaultAllergy(id: string): DraftAllergy {
  return { _tempId: id, status: 'active', assertedDate: today(), onsetDate: today() }
}
export function defaultInvestigation(id: string): DraftInvestigation {
  return { _tempId: id, date: today(), specimens: [], testRequests: [], testGroups: [] }
}
export function defaultReferral(id: string): DraftReferral {
  return { _tempId: id, date: today() }
}
export function defaultDiaryEntry(id: string): DraftDiaryEntry {
  return { _tempId: id, date: today(), occurrenceStart: today() }
}
export function defaultDocument(id: string): DraftDocument {
  return { _tempId: id, indexedDate: today() }
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
interface LegacyDraftInvestigation extends Omit<DraftInvestigation, 'testGroups' | 'specimens' | 'testRequests'> {
  testGroups?: DraftTestGroup[]
  results?: DraftInvestigationResult[]
  specimens?: DraftSpecimen[]
  testRequests?: DraftTestRequest[]
  // Pre-multiple-specimen/request shape: a single specimen/test request sat
  // directly on the investigation as flat fields instead of a list.
  specimenType?: string
  specimenSnomedCode?: string
  specimenCollectedDate?: string
  specimenReceivedDate?: string
  specimenStatus?: string
  specimenNote?: string
  testRequestName?: string
  testRequestSnomedCode?: string
  testRequestStatus?: string
  testRequestIntent?: string
  testRequestRequesterTempId?: string
}

export function migrateInvestigation(inv: LegacyDraftInvestigation): DraftInvestigation {
  const {
    results, testGroups,
    specimens, specimenType, specimenSnomedCode, specimenCollectedDate, specimenReceivedDate, specimenStatus, specimenNote,
    testRequests, testRequestName, testRequestSnomedCode, testRequestStatus, testRequestIntent, testRequestRequesterTempId,
    ...rest
  } = inv

  const hasLegacySpecimen = specimenType || specimenSnomedCode || specimenCollectedDate || specimenReceivedDate || specimenStatus || specimenNote
  const hasLegacyTestRequest = testRequestName || testRequestSnomedCode

  return {
    ...rest,
    testGroups: Array.isArray(testGroups)
      ? testGroups
      : results && results.length > 0
      ? [{ _tempId: newTempId(), name: inv.name, snomedCode: inv.snomedCode, results }]
      : [],
    specimens: Array.isArray(specimens)
      ? specimens
      : hasLegacySpecimen
      ? [{
          _tempId: newTempId(),
          type: specimenType,
          snomedCode: specimenSnomedCode,
          collectedDate: specimenCollectedDate,
          receivedDate: specimenReceivedDate,
          status: specimenStatus,
          note: specimenNote,
        }]
      : [],
    testRequests: Array.isArray(testRequests)
      ? testRequests
      : hasLegacyTestRequest
      ? [{
          _tempId: newTempId(),
          name: testRequestName,
          snomedCode: testRequestSnomedCode,
          status: testRequestStatus,
          intent: testRequestIntent,
          requesterTempId: testRequestRequesterTempId,
        }]
      : [],
  }
}

// Pre-indexed/created-split shape: documents carried a single `date` field
// standing in for both DocumentReference.indexed (mandatory) and .created
// (optional). Treat that lone date as the indexed date — it's always been
// mandatory for filing purposes — and leave created date unset.
interface LegacyDraftDocument extends Omit<DraftDocument, 'indexedDate' | 'createdDate'> {
  indexedDate?: string
  createdDate?: string
  date?: string
}

export function migrateDocument(doc: LegacyDraftDocument): DraftDocument {
  if (doc.indexedDate !== undefined || doc.date === undefined) return doc as DraftDocument
  const { date, ...rest } = doc
  return { ...rest, indexedDate: date }
}

export function migrateDraft(draft: DraftRecord): DraftRecord {
  return {
    ...draft,
    organisations: Array.isArray(draft.organisations) ? draft.organisations : [],
    investigations: (draft.investigations ?? []).map(inv => migrateInvestigation(inv as LegacyDraftInvestigation)),
    documents: (draft.documents ?? []).map(doc => migrateDocument(doc as LegacyDraftDocument)),
  }
}

// ---------------------------------------------------------------------------
// Empty draft factory
// ---------------------------------------------------------------------------

export function createEmptyDraft(): DraftRecord {
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
// Helpers
// ---------------------------------------------------------------------------

export function updateById<T extends { _tempId: string }>(
  arr: T[],
  tempId: string,
  updates: Partial<T>,
): T[] {
  return arr.map(item =>
    item._tempId === tempId ? { ...item, ...updates } : item,
  )
}

export function removeById<T extends { _tempId: string }>(arr: T[], tempId: string): T[] {
  return arr.filter(item => item._tempId !== tempId)
}

// Creates a linked-category resource (tagged with the owning consultation)
// in its own top-level list, shared by ADD_CONSULTATION_LINKED_ITEM.
export function addLinkedResource(state: DraftRecord, kind: ConsultationLinkKind, id: string, consTempId: string): DraftRecord {
  const linkedConsultationTempId = consTempId
  switch (kind) {
    case 'allergy':
      return { ...state, allergies: [...state.allergies, { ...defaultAllergy(id), linkedConsultationTempId }] }
    case 'document':
      return { ...state, documents: [...state.documents, { ...defaultDocument(id), linkedConsultationTempId }] }
    case 'investigation':
      return { ...state, investigations: [...state.investigations, { ...defaultInvestigation(id), linkedConsultationTempId }] }
    case 'diaryEntry':
      return { ...state, diaryEntries: [...state.diaryEntries, { ...defaultDiaryEntry(id), linkedConsultationTempId }] }
    case 'medication':
      return { ...state, medications: [...state.medications, { ...defaultMedication(id), linkedConsultationTempId }] }
    case 'referral':
      return { ...state, referrals: [...state.referrals, { ...defaultReferral(id), linkedConsultationTempId }] }
  }
}

// Removes a linked-category resource from its own top-level list, shared by
// REMOVE_CONSULTATION_LINKED_ITEM and the category-cascade in REMOVE_CONSULTATION_CATEGORY.
export function removeLinkedResource(state: DraftRecord, kind: ConsultationLinkKind, id: string): DraftRecord {
  switch (kind) {
    case 'allergy':
      return { ...state, allergies: removeById(state.allergies, id) }
    case 'document':
      return { ...state, documents: removeById(state.documents, id) }
    case 'investigation':
      return { ...state, investigations: removeById(state.investigations, id) }
    case 'diaryEntry':
      return { ...state, diaryEntries: removeById(state.diaryEntries, id) }
    case 'medication':
      return { ...state, medications: removeById(state.medications, id) }
    case 'referral':
      return { ...state, referrals: removeById(state.referrals, id) }
  }
}

// ---------------------------------------------------------------------------
