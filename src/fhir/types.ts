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

export interface GpConnectMedicationIssue {
  id: string
  issueDate?: string
  endDate?: string
  quantity?: string
  status?: string
  dosageInstruction?: string
  patientInstructions?: string
  pharmacyInstructions?: string
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
  prescribedQuantity?: string
  prescriber?: string
  prescriberOrganisation?: string
  dosageInstruction?: string
  additionalInformation?: string
  medicationStatementId: string
  medicationRequestIds: string[]
  issues: GpConnectMedicationIssue[]
}

export interface GpConnectPatient {
  nhsNumber?: string
  familyName?: string
  givenName?: string
  dateOfBirth?: string
  gender?: string
}

export interface GpConnectAllergyNote {
  text: string
  author?: string
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
  endDate?: string
  endReason?: string
}

export interface GpConnectProblem {
  id: string
  problem: string
  snomedCode?: string
  clinicalStatus: string
  significance?: string
  startDate?: string
  endDate?: string
}

export interface GpConnectConsultation {
  id: string
  date?: string
  type?: string
  clinician?: string
  organisation?: string
}

export interface GpConnectImmunisation {
  id: string
  vaccine: string
  snomedCode?: string
  dateGiven?: string
  status: string
  site?: string
  batchNumber?: string
  performer?: string
}

export interface GpConnectInvestigation {
  id: string
  date?: string
  name: string
  snomedCode?: string
  result?: string
  unit?: string
  referenceRange?: string
  interpretation?: string
  performer?: string
}

export interface GpConnectReferral {
  id: string
  date?: string
  recipient?: string
  priority?: string
  reason?: string
  status: string
}

export interface GpConnectDiaryEntry {
  id: string
  date?: string
  description: string
  snomedCode?: string
  clinician?: string
  priority?: string
  status: string
}

export interface GpConnectCodedDataItem {
  id: string
  date?: string
  snomedCode?: string
  description: string
  value?: string
  unit?: string
}

export interface GpConnectDocument {
  id: string
  date?: string
  type: string
  description?: string
  mimeType?: string
  url?: string
  author?: string
  status: string
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
