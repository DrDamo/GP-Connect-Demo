// Draft types for the Record Builder — mirror of GpConnect* from src/fhir/types.ts
// but with all fields optional and a _tempId on every object.

export interface DraftPatient {
  _tempId: string
  nhsNumber?: string
  nhsNumberVerified?: boolean
  prefix?: string
  givenName?: string
  familyName?: string
  dateOfBirth?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  isActive?: boolean
  registrationType?: string
  registrationStart?: string
  address?: string
  phone?: string
  email?: string
}

export interface DraftPractitioner {
  _tempId: string
  prefix?: string
  givenName?: string
  familyName?: string
  sdsUserId?: string
  sdsRoleProfileId?: string
  gender?: string
}

export interface DraftOrganisation {
  _tempId: string
  name?: string
  odsCode?: string
  phone?: string
  address?: string
}

export interface DraftLocation {
  _tempId: string
  name?: string
  address?: string
}

export interface DraftMedicationIssue {
  _tempId: string
  status?: 'cancelled' | string
  issueDate?: string
  startDate?: string
  endDate?: string
  quantityValue?: number
  quantityUnit?: string
  supplyDurationValue?: number
  supplyDurationUnit?: string
  dosageInstruction?: string
  patientInstructions?: string
  pharmacyInstructions?: string
  recorderTempId?: string
}

export interface DraftMedication {
  _tempId: string
  drugName?: string
  snomedCode?: string
  dmdCode?: string
  dmdDisplay?: string
  dmdType?: 'VMP' | 'AMP'
  prescriptionType?: 'acute' | 'repeat' | 'repeat-dispensing' | 'prescribed-elsewhere'
  status?: string
  dose?: string
  frequency?: string
  route?: string
  dosageInstruction?: string
  prescribedQuantityValue?: number
  prescribedQuantityUnit?: string
  supplyDurationValue?: number
  supplyDurationUnit?: string
  numberOfRepeatsAllowed?: number
  startDate?: string
  endDate?: string
  prescriberTempId?: string
  recorderTempId?: string
  orgTempId?: string
  patientInstructions?: string
  pharmacyInstructions?: string
  associatedText?: string
  issues?: DraftMedicationIssue[]
  stopReason?: 'reauthorisation' | string
  reauthorisedFromTempId?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftAllergy {
  _tempId: string
  causativeAgent?: string
  snomedCode?: string
  category?: 'food' | 'medication' | 'environment' | 'biologic'
  criticality?: 'low' | 'high' | 'unable-to-assess'
  reaction?: string
  reactionCode?: string
  status?: 'active' | 'resolved'
  assertedDate?: string
  onsetDate?: string
  endDate?: string
  endReason?: string
  recorderTempId?: string
  associatedText?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftProblem {
  _tempId: string
  problem?: string
  snomedCode?: string
  clinicalStatus?: 'active' | 'inactive' | 'resolved'
  significance?: 'major' | 'minor'
  startDate?: string
  endDate?: string
  assertedDate?: string
  asserterTempId?: string
  associatedText?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export type DraftConsultationItemType = 'note' | 'coded'

export interface DraftConsultationItem {
  _tempId: string
  itemType: DraftConsultationItemType
  narrativeText?: string
  snomedCode?: string
  description?: string
  value?: string
  associatedText?: string
}

export interface DraftConsultationCategory {
  _tempId: string
  title?: string
  items: DraftConsultationItem[]
}

export interface DraftConsultationTopic {
  _tempId: string
  title?: string
  /** Single Problem (Condition) created for this topic — max one per topic. */
  problemTempId?: string
  categories: DraftConsultationCategory[]
  items: DraftConsultationItem[]
}

export interface DraftConsultation {
  _tempId: string
  date?: string
  endDate?: string
  typeDisplay?: string
  clinicianTempId?: string
  orgTempId?: string
  encounterClass?: string
  topics: DraftConsultationTopic[]
  linkedProblemTempIds?: string[]
}

export interface DraftImmunisation {
  _tempId: string
  vaccineName?: string
  snomedCode?: string
  vaccinationProcedureCode?: string
  vaccinationProcedureDisplay?: string
  dateGiven?: string
  dateRecorded?: string
  status?: string
  notGiven?: boolean
  parentPresent?: boolean
  reason?: string
  site?: string
  route?: string
  batchNumber?: string
  expirationDate?: string
  manufacturer?: string
  administeringPractitionerTempId?: string
  enteringPractitionerTempId?: string
  locationTempId?: string
  associatedText?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftInvestigationResult {
  _tempId: string
  name?: string
  snomedCode?: string
  value?: string
  unit?: string
  referenceRangeLow?: string
  referenceRangeHigh?: string
  interpretation?: string
  comment?: string
}

export interface DraftInvestigation {
  _tempId: string
  name?: string
  snomedCode?: string
  date?: string
  status?: string
  performerTempId?: string
  results: DraftInvestigationResult[]
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftReferral {
  _tempId: string
  date?: string
  recipientName?: string
  priority?: 'routine' | 'urgent' | 'asap' | 'stat'
  reason?: string
  description?: string
  requesterTempId?: string
  status?: string
  intent?: string
  associatedText?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftDiaryEntry {
  _tempId: string
  description?: string
  snomedCode?: string
  date?: string
  occurrenceStart?: string
  occurrenceEnd?: string
  clinicianTempId?: string
  priority?: string
  status?: string
  intent?: string
  associatedText?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftCodedDataItem {
  _tempId: string
  description?: string
  snomedCode?: string
  date?: string
  status?: string
  value?: string
  unit?: string
  comment?: string
  interpretation?: string
  performerTempId?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftDocument {
  _tempId: string
  type?: string
  date?: string
  description?: string
  mimeType?: string
  url?: string
  authorTempId?: string
  custodianOrgTempId?: string
  status?: string
  linkedProblemTempIds?: string[]
  linkedConsultationTempId?: string
}

export interface DraftRecord {
  patient: DraftPatient
  organisation: DraftOrganisation
  organisations: DraftOrganisation[]
  practitioners: DraftPractitioner[]
  locations: DraftLocation[]
  medications: DraftMedication[]
  allergies: DraftAllergy[]
  problems: DraftProblem[]
  consultations: DraftConsultation[]
  immunisations: DraftImmunisation[]
  investigations: DraftInvestigation[]
  referrals: DraftReferral[]
  diaryEntries: DraftDiaryEntry[]
  codedData: DraftCodedDataItem[]
  documents: DraftDocument[]
}
