export type DomainId =
  | 'allergies'
  | 'consultations'
  | 'diary-entries'
  | 'documents'
  | 'immunisations'
  | 'medications'
  | 'investigations'
  | 'problems'
  | 'referrals'
  | 'coded-data'
  | 'supporting-resources'
  | 'lists'

export interface DomainDef {
  id: DomainId
  label: string
  description: string
  fhirResources: string[]
  tableColumns: string[]
  implemented: boolean
}

export const DOMAINS: DomainDef[] = [
  {
    id: 'allergies',
    label: 'Allergies',
    description: 'Allergies and adverse reactions to substances',
    fhirResources: ['AllergyIntolerance', 'List'],
    tableColumns: ['Causative agent', 'Reaction', 'Severity', 'Certainty', 'Date recorded', 'Status'],
    implemented: true,
  },
  {
    id: 'consultations',
    label: 'Consultations',
    description: 'GP consultations and clinical encounter records',
    fhirResources: ['Encounter', 'Composition', 'List'],
    tableColumns: ['Date', 'Type', 'Clinician', 'Practice', 'Details'],
    implemented: true,
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Clinical documents including letters, discharge summaries and reports',
    fhirResources: ['DocumentReference'],
    tableColumns: ['Date', 'Type', 'Description', 'Author', 'Format', 'Status'],
    implemented: true,
  },
  {
    id: 'diary-entries',
    label: 'Diary Entries',
    description: 'Planned activities, follow-ups, and future care instructions',
    fhirResources: ['ProcedureRequest', 'List'],
    tableColumns: ['Date', 'Description', 'Clinician', 'Priority', 'Status'],
    implemented: true,
  },
  {
    id: 'immunisations',
    label: 'Immunisations',
    description: 'Vaccination and immunisation history',
    fhirResources: ['Immunization', 'List'],
    tableColumns: ['Vaccine', 'Date given', 'Status', 'Site', 'Batch no.', 'Performer'],
    implemented: true,
  },
  {
    id: 'medications',
    label: 'Medications',
    description: 'Acute, repeat, and repeat dispensing prescriptions',
    fhirResources: ['MedicationStatement', 'MedicationRequest', 'Medication'],
    tableColumns: ['Drug', 'Dose / Frequency', 'Route', 'Start date', 'Last issued', 'Status'],
    implemented: true,
  },
  {
    id: 'investigations',
    label: 'Investigations',
    description: 'Laboratory results and diagnostic reports',
    fhirResources: ['DiagnosticReport', 'Observation', 'Specimen', 'List'],
    tableColumns: ['Date', 'Investigation', 'Result', 'Reference range', 'Interpretation', 'Performer'],
    implemented: true,
  },
  {
    id: 'problems',
    label: 'Problems',
    description: 'Active and inactive problems and diagnoses',
    fhirResources: ['Condition', 'List'],
    tableColumns: ['Problem', 'SNOMED code', 'Clinical status', 'Significance', 'Start date', 'End date'],
    implemented: true,
  },
  {
    id: 'referrals',
    label: 'Referrals',
    description: 'Referral requests to other services and specialties',
    fhirResources: ['ReferralRequest', 'List'],
    tableColumns: ['Date', 'Recipient service', 'Priority', 'Reason', 'Status'],
    implemented: true,
  },
  {
    id: 'coded-data',
    label: 'Coded Data',
    description: 'SNOMED coded entries not captured in other clinical areas',
    fhirResources: ['Observation', 'List'],
    tableColumns: ['Date', 'SNOMED code', 'Description', 'Value', 'Associated problem'],
    implemented: true,
  },
  {
    id: 'supporting-resources',
    label: 'Supporting Resources',
    description: 'Practitioners, Organisations, Locations, Healthcare Services and Medications referenced in this bundle',
    fhirResources: ['Practitioner', 'Organization', 'HealthcareService'],
    tableColumns: ['Name', 'Type', 'Identifier', 'Contact'],
    implemented: true,
  },
  {
    id: 'lists',
    label: 'Lists',
    description: 'FHIR List resources organising entries by clinical category',
    fhirResources: ['List'],
    tableColumns: ['List', 'Date', 'Mode', 'Status', 'Entries'],
    implemented: true,
  },
]

export const DOMAIN_MAP = Object.fromEntries(DOMAINS.map(d => [d.id, d])) as Record<DomainId, DomainDef>
