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
  alternativeCodes?: Array<{ label: string; code: string }>
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
  site?: string
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
  /** Whether this belongs in "current drugs" vs "past drugs" — derived from
   * status plus supplier-specific date rules (see classifyIsCurrent in
   * medications.ts), NOT the same thing as `status` itself. The raw FHIR
   * status is always displayed as-is; this only controls section placement. */
  isCurrent: boolean
  /** Whether this resource carries a NOPAT security label (withheld from patient-facing services). */
  notForPfs?: boolean
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
  preferredLanguage?: string
  interpreterRequired?: boolean
  communicationProficiency?: string
  modeOfCommunication?: string
  managingOrganisationName?: string
  managingOrganisationId?: string
  contacts?: GpConnectContact[]
}

export interface GpConnectContact {
  name?: string
  relationship?: string
  phone?: string
  gender?: string
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
  notForPfs?: boolean
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
  notForPfs?: boolean
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
  notForPfs?: boolean
}

export interface GpConnectImmunisation {
  id: string
  /** 'observation' for immunisation-related Observations (declined/consent/contraindication/DNA)
   *  pulled in from the Immunisations List alongside actual administered vaccines — these also
   *  appear in Coded Data since that's their canonical FHIR home. Absent for real Immunizations. */
  entryType?: 'observation'
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
  /** True when explanationCode/Display/Text came from explanation.reasonNotGiven rather than explanation.reason. */
  explanationIsReasonNotGiven?: boolean
  parentPresent?: boolean
  notes: string[]
  /** For entryType 'observation' — the id of the matching Coded Data item (same underlying Observation). */
  codedDataId?: string
  notForPfs?: boolean
}

export interface GpConnectSpecimen {
  id: string
  type?: string
  typeCode?: string
  collectedDateTime?: string
  receivedTime?: string
  status?: string
  note?: string
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
  commentObservationId?: string
  isSubHeader?: boolean
  isTransferDegraded?: boolean
  components?: GpConnectObservationComponent[]
}

export interface GpConnectTestGroup {
  id: string
  name: string
  snomedCode?: string
  comment?: string
  commentObservationId?: string
  date?: string
  interpretation?: string
  isTransferDegraded?: boolean
  specimen?: GpConnectSpecimen
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
  // Every actor in DiagnosticReport.performer[] (can mix Organizations,
  // Practitioners, and HealthcareServices) — performer/performerId above are
  // just performers[0], kept for the table's Requestor column.
  performers?: Array<{ type: 'Practitioner' | 'Organisation' | 'HealthcareService'; id: string }>
  encounterId?: string
  specimen?: GpConnectSpecimen
  procedureRequest?: GpConnectProcedureRequest
  testGroups: GpConnectTestGroup[]
  results: GpConnectInvestigationResult[]
  notForPfs?: boolean
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
  notForPfs?: boolean
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
  notForPfs?: boolean
}

export interface GpConnectCodedDataItem {
  id: string
  date?: string
  isIssuedDate?: boolean
  category?: string
  snomedCode?: string
  description: string
  isTransferDegraded?: boolean
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
  notForPfs?: boolean
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
  notForPfs?: boolean
}

export interface GpConnectPractitioner {
  id: string
  name: string
  sdsUserId?: string
  sdsRoleProfileId?: string
  gender?: string
}

export interface GpConnectPractitionerRole {
  id: string
  practitionerId: string
  jobRole?: string
  organisationId?: string
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
  /** SNOMED / classification code from list.code.coding[0] — used for domain mapping */
  listCode?: string
  /** Value from Extension-CareConnect-GPC-ListWarningCode-1, e.g. 'data-in-transit' */
  warningCode?: string
  notForPfs?: boolean
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
  practitionerRoles: GpConnectPractitionerRole[]
  organisations: GpConnectOrganisation[]
  healthcareServices: GpConnectHealthcareService[]
  locations: GpConnectLocation[]
  lists: GpConnectList[]
}

// Backward-compat alias — components importing this type still work unchanged
export type GpConnectMedicationsRecord = GpConnectBundle

export type ValidationSeverity = 'error' | 'warning' | 'info'

/** Present on a ValidationIssue only when it represents an actual SNOMED CT
 * code conversion (see src/fhir/snomedDegrade.ts) — lets the UI show each
 * one individually instead of folding it into the generic warnings list. */
export interface SnomedDegradeDetail {
  originalCode: string
  originalDisplay?: string
  degradedCode: string
  degradedDisplay: string
}

export interface ValidationIssue {
  severity: ValidationSeverity
  message: string
  path?: string
  resourceId?: string
  snomedDegrade?: SnomedDegradeDetail
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  resourceCounts: Record<string, number>
  /** Titles of checks that ran and found no problem anywhere they applied — not
   * one entry per resource, just the check itself (e.g. "Encounter.status is required"). */
  passed: string[]
}
