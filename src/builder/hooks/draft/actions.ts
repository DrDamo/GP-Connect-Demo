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
  ConsultationLinkKind,
  DraftImmunisation,
  DraftInvestigation,
  DraftTestGroup,
  DraftInvestigationResult,
  DraftSpecimen,
  DraftTestRequest,
  DraftReferral,
  DraftDiaryEntry,
  DraftCodedDataItem,
  DraftDocument,
} from '../../types'

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
  // A linked-kind category (Allergy/Document/Investigation/Diary Entry/Medication/Referral)
  // references records in their own section instead of holding items directly.
  | {
      type: 'ADD_CONSULTATION_LINKED_ITEM'
      payload: { consTempId: string; topicTempId: string; title: string; kind: ConsultationLinkKind; resourceTempId: string }
    }
  | {
      type: 'REMOVE_CONSULTATION_LINKED_ITEM'
      payload: { consTempId: string; topicTempId: string; catTempId: string; kind: ConsultationLinkKind; resourceTempId: string }
    }
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
  | { type: 'ADD_SPECIMEN'; payload: string }
  | { type: 'UPDATE_SPECIMEN'; payload: { invTempId: string; specimenTempId: string; updates: Partial<DraftSpecimen> } }
  | { type: 'REMOVE_SPECIMEN'; payload: { invTempId: string; specimenTempId: string } }
  | { type: 'ADD_TEST_REQUEST'; payload: string }
  | { type: 'UPDATE_TEST_REQUEST'; payload: { invTempId: string; requestTempId: string; updates: Partial<DraftTestRequest> } }
  | { type: 'REMOVE_TEST_REQUEST'; payload: { invTempId: string; requestTempId: string } }
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
