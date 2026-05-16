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
}

export interface GpConnectPatient {
  nhsNumber?: string
  familyName?: string
  givenName?: string
  dateOfBirth?: string
  gender?: string
}

export interface GpConnectMedicationsRecord {
  patient?: GpConnectPatient
  practiceOrganisation?: string
  medications: GpConnectMedication[]
  timestamp?: string
}

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
