// FHIR STU3 types via @types/fhir (namespace fhir3)

export type FhirBundle = fhir3.Bundle
export type FhirBundleEntry = fhir3.BundleEntry
export type FhirMedicationStatement = fhir3.MedicationStatement
export type FhirMedication = fhir3.Medication
export type FhirMedicationRequest = fhir3.MedicationRequest
export type FhirPatient = fhir3.Patient
export type FhirOrganization = fhir3.Organization
export type FhirPractitioner = fhir3.Practitioner
export type FhirList = fhir3.List
export type FhirResource = fhir3.Resource
export type FhirAllergyIntolerance = fhir3.AllergyIntolerance
export type FhirCondition = fhir3.Condition
export type FhirEncounter = fhir3.Encounter
export type FhirImmunization = fhir3.Immunization
export type FhirDiagnosticReport = fhir3.DiagnosticReport
export type FhirObservation = fhir3.Observation
export type FhirDocumentReference = fhir3.DocumentReference

export interface GpConnectFhirMedication {
  id: string
  name: string
  snomedCode?: string
}

export interface GpConnectMedicationIssue {
  id: string
  issueDate?: string
  startDate?: string
  endDate?: string
  quantity?: string
  status?: string
  supplyDuration?: string
  dosageInstruction?: string
  patientInstructions?: string
  pharmacyInstructions?: string
  recorder?: string
  recorderId?: string
}

// GP Connect domain model for Medications — normalised from FHIR for display
export interface GpConnectMedication {
  id: string
  drugName: string
  snomedCode?: string
  dose?: string
  frequency?: string
  route?: string
  status: string
  prescriptionType?: string
  prescribingAgency?: string
  patientInstructions?: string
  pharmacyInstructions?: string
  startDate?: string
  endDate?: string
  lastIssuedDate?: string
  reviewDate?: string
  numberOfRepeatsAllowed?: number
  numberOfIssued?: number
  authorisationExpiryDate?: string
  prescribedQuantity?: string
  encounterId?: string
  medicationResourceId?: string
  dateAsserted?: string
  prescriber?: string
  prescriberId?: string
  recorder?: string
  recorderId?: string
  prescriberOrganisation?: string
  prescriberOrganisationId?: string
  expectedSupplyDuration?: string
  dosageInstruction?: string
  additionalInformation?: string
  statusReason?: string
  statusChangeDate?: string
  medicationStatementId: string
  medicationRequestIds: string[]
  issues: GpConnectMedicationIssue[]
}

export interface GpConnectPatient {
  id?: string
  nhsNumber?: string
  nhsNumberVerified?: boolean
  nhsNumberVerificationDisplay?: string
  prefix?: string
  familyName?: string
  givenName?: string
  dateOfBirth?: string
  gender?: string
  isActive?: boolean
  registrationType?: string
  registrationStart?: string
  preferredBranchSurgery?: string
  address?: string
  phone?: string
  email?: string
  registeredGpName?: string
  registeredGpId?: string
}

export interface GpConnectAllergyNote {
  text: string
  author?: string
  authorId?: string
  time?: string
}

export interface GpConnectAllergy {
  id: string
  causativeAgent: string
  snomedCode?: string
  snomedDisplay?: string
  category?: string
  criticality?: string
  reaction?: string
  dateRecorded?: string
  onsetDate?: string
  status: string
  verificationStatus?: string
  notes: GpConnectAllergyNote[]
  recorder?: string
  recorderId?: string
  asserter?: string
  asserterId?: string
  encounterId?: string
  endDate?: string
  endReason?: string
}

export interface GpConnectLinkedItem {
  resourceType: string
  id: string
  description?: string
  linkType: 'actual' | 'related'
}

export interface GpConnectProblem {
  id: string
  problem: string
  snomedCode?: string
  snomedDisplay?: string
  clinicalStatus: string
  significance?: string
  startDate?: string
  endDate?: string
  assertedDate?: string
  asserter?: string
  asserterId?: string
  encounterId?: string
  notes: string[]
  linkedItems: GpConnectLinkedItem[]
}

export interface GpConnectConsultationItem {
  resourceType: string
  resourceId: string
  display?: string
  /** Free text from a Comment note observation (SNOMED 37331000000100) */
  narrativeText?: string
}

export interface GpConnectConsultationCategory {
  id: string
  title?: string
  items: GpConnectConsultationItem[]
}

export interface GpConnectConsultationTopic {
  id: string
  title?: string
  categories: GpConnectConsultationCategory[]
  items: GpConnectConsultationItem[]
}

export interface GpConnectConsultation {
  id: string
  date?: string
  endDate?: string
  type?: string
  clinician?: string
  clinicianId?: string
  organisation?: string
  organisationId?: string
  encounterClass?: string
  encounterStatus?: string
  topics: GpConnectConsultationTopic[]
}

export interface GpConnectImmunisation {
  id: string
  vaccine: string
  snomedCode?: string
  vaccinationProcedureCode?: string
  vaccinationProcedureDisplay?: string
  vaccinationProcedureText?: string
  vaccineCodeDisplay?: string
  dateGiven?: string
  dateRecorded?: string
  status: string
  notGiven?: boolean
  site?: string
  siteDisplay?: string
  siteCode?: string
  route?: string
  batchNumber?: string
  expirationDate?: string
  administeringPractitioner?: string
  administeringPractitionerId?: string
  enteringPractitioner?: string
  enteringPractitionerId?: string
  locationId?: string
  locationName?: string
  encounterId?: string
  explanationCode?: string
  explanationDisplay?: string
  explanationText?: string
  parentPresent?: boolean
  notes: string[]
}

export interface GpConnectSpecimen {
  id: string
  type?: string
  typeCode?: string
  collectedDateTime?: string
  receivedTime?: string
  status?: string
}

export interface GpConnectProcedureRequest {
  id: string
  name?: string
  snomedCode?: string
  status?: string
  intent?: string
  requester?: string
  requesterId?: string
  performer?: string
  performerId?: string
  notes?: string[]
}

export interface GpConnectObservationComponent {
  name: string
  value?: string
  unit?: string
  referenceRange?: string
  interpretation?: string
}

export interface GpConnectInvestigationResult {
  id: string
  reportId: string
  name: string
  snomedCode?: string
  value?: string
  unit?: string
  referenceRange?: string
  interpretation?: string
  comment?: string
  isSubHeader?: boolean
  components?: GpConnectObservationComponent[]
}

export interface GpConnectTestGroup {
  id: string
  name: string
  snomedCode?: string
  comment?: string
  date?: string
  results: GpConnectInvestigationResult[]
}

export interface GpConnectInvestigation {
  id: string
  date?: string
  name: string
  snomedCode?: string
  status?: string
  category?: string
  filingComment?: string
  filingCommentDate?: string
  filingCommentPerformer?: string
  // First-result shortcuts kept for table column display
  result?: string
  unit?: string
  referenceRange?: string
  interpretation?: string
  performer?: string
  performerId?: string
  encounterId?: string
  specimen?: GpConnectSpecimen
  procedureRequest?: GpConnectProcedureRequest
  testGroups: GpConnectTestGroup[]
  results: GpConnectInvestigationResult[]
}

export interface GpConnectReferralRecipient {
  id: string
  type: 'Organisation' | 'HealthcareService' | 'Practitioner'
  name?: string
}

export interface GpConnectReferralDocument {
  id: string
  title: string
  description?: string
  date?: string
  status?: string
}

export interface GpConnectReferral {
  id: string
  date?: string
  recipient?: string
  recipientId?: string
  recipientRefs: GpConnectReferralRecipient[]
  priority?: string
  reason?: string
  description?: string
  requester?: string
  requesterId?: string
  notes: string[]
  status: string
  supportingDocs: GpConnectReferralDocument[]
}

export interface GpConnectDiaryNote {
  text: string
  author?: string
  authorId?: string
  time?: string
}

export interface GpConnectDiaryEntry {
  id: string
  date?: string
  description: string
  snomedCode?: string
  clinician?: string
  clinicianId?: string
  encounterId?: string
  priority?: string
  status: string
  intent?: string
  occurrenceStart?: string
  occurrenceEnd?: string
  notes: GpConnectDiaryNote[]
}

export interface GpConnectCodedDataItem {
  id: string
  date?: string
  isIssuedDate?: boolean
  category?: string
  snomedCode?: string
  description: string
  value?: string
  unit?: string
  comment?: string
  interpretation?: string
  performer?: string
  performerId?: string
  organisation?: string
  organisationId?: string
  encounterId?: string
  components?: GpConnectObservationComponent[]
}

export interface GpConnectDocument {
  id: string
  date?: string
  type: string
  description?: string
  attachmentTitle?: string
  mimeType?: string
  url?: string
  author?: string
  authorId?: string
  encounterId?: string
  custodian?: string
  custodianId?: string
  status: string
  attachmentSize?: number
}

export interface GpConnectPractitioner {
  id: string
  name: string
  sdsUserId?: string
  sdsRoleProfileId?: string
  gender?: string
}

export interface GpConnectOrganisation {
  id: string
  name: string
  odsCode?: string
  phone?: string
  address?: string
}

export interface GpConnectHealthcareService {
  id: string
  name?: string
  comment?: string
  specialty?: string
  providedBy?: string
}

export interface GpConnectLocation {
  id: string
  name: string
  address?: string
}

export type ListCategory =
  | 'primary'
  | 'secondary-consultation'
  | 'secondary-problems'
  | 'consultation-wrapper'
  | 'consultation-topic'
  | 'consultation-category'
  | 'other'

export interface GpConnectListEntry {
  resourceId: string
  resourceType: string
  display?: string
  date?: string
  flag?: string
  deleted: boolean
}

export interface GpConnectList {
  id: string
  title?: string
  status: string
  mode?: string
  date?: string
  orderedBy?: string
  note?: string
  emptyReason?: string
  entries: GpConnectListEntry[]
  category: ListCategory
  encounterId?: string
}

export interface GpConnectBundle {
  patient?: GpConnectPatient
  practiceOrganisation?: string
  timestamp?: string
  medications: GpConnectMedication[]
  allergies: GpConnectAllergy[]
  problems: GpConnectProblem[]
  consultations: GpConnectConsultation[]
  immunisations: GpConnectImmunisation[]
  investigations: GpConnectInvestigation[]
  referrals: GpConnectReferral[]
  diaryEntries: GpConnectDiaryEntry[]
  codedData: GpConnectCodedDataItem[]
  documents: GpConnectDocument[]
  fhirMedications: GpConnectFhirMedication[]
  practitioners: GpConnectPractitioner[]
  organisations: GpConnectOrganisation[]
  healthcareServices: GpConnectHealthcareService[]
  locations: GpConnectLocation[]
  lists: GpConnectList[]
}

// Backward-compat alias — components importing this type still work unchanged
export type GpConnectMedicationsRecord = GpConnectBundle

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  message: string
  path?: string
  resourceId?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  resourceCounts: Record<string, number>
}
