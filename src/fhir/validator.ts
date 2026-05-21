import type { ValidationIssue, ValidationResult } from './types'

type AnyResource = fhir3.Resource & { resourceType: string }

function countResources(bundle: fhir3.Bundle): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of bundle.entry ?? []) {
    const rt = (entry.resource as AnyResource | undefined)?.resourceType
    if (rt) counts[rt] = (counts[rt] ?? 0) + 1
  }
  return counts
}

function getEntries<T extends fhir3.Resource>(bundle: fhir3.Bundle, resourceType: string): T[] {
  return (bundle.entry ?? [])
    .map(e => e.resource as AnyResource | undefined)
    .filter((r): r is T & AnyResource => r?.resourceType === resourceType)
}

function req(issues: ValidationIssue[], condition: boolean, severity: ValidationIssue['severity'], message: string, path: string, resourceId?: string) {
  if (!condition) issues.push({ severity, message, path, resourceId })
}

export function validateBundle(bundle: fhir3.Bundle): ValidationResult {
  const issues: ValidationIssue[] = []
  const resourceCounts = countResources(bundle)

  if (bundle.resourceType !== 'Bundle') {
    issues.push({ severity: 'error', message: 'Root resource must be a Bundle', path: 'resourceType' })
    return { valid: false, issues, resourceCounts }
  }

  if (bundle.type && !['collection', 'document', 'searchset'].includes(bundle.type)) {
    issues.push({
      severity: 'warning',
      message: `Bundle.type is "${bundle.type}"; GP Connect typically uses "collection" or "document"`,
      path: 'Bundle.type',
    })
  }

  if (!bundle.entry || bundle.entry.length === 0) {
    issues.push({ severity: 'error', message: 'Bundle has no entries', path: 'Bundle.entry' })
    return { valid: false, issues, resourceCounts }
  }

  // Patient
  const patients = getEntries<fhir3.Patient>(bundle, 'Patient')
  if (patients.length === 0) {
    issues.push({ severity: 'warning', message: 'No Patient resource found in Bundle', path: 'Bundle.entry' })
  } else if (patients.length > 1) {
    issues.push({ severity: 'warning', message: 'Multiple Patient resources found — expected exactly one', path: 'Bundle.entry' })
  }

  // List resources
  const lists = getEntries<fhir3.List>(bundle, 'List')
  if (lists.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No List resource found — GP Connect bundles typically include a List to organise clinical entries',
      path: 'Bundle.entry',
    })
  }
  for (const list of lists) {
    const path = `List/${list.id}`
    req(issues, !!list.status, 'error', 'List.status is required', path, list.id)
    req(issues, !!list.mode, 'error', 'List.mode is required', path, list.id)
  }

  // MedicationStatement
  const statements = getEntries<fhir3.MedicationStatement>(bundle, 'MedicationStatement')
  for (const stmt of statements) {
    const path = `MedicationStatement/${stmt.id}`
    req(issues, !!stmt.status, 'error', 'MedicationStatement.status is required', path, stmt.id)
    req(issues, !!(stmt.medicationReference || stmt.medicationCodeableConcept), 'error',
      'MedicationStatement must have medicationReference or medicationCodeableConcept', path, stmt.id)
    req(issues, !!stmt.subject, 'error', 'MedicationStatement.subject is required', path, stmt.id)
    req(issues, !!stmt.taken, 'warning',
      'MedicationStatement.taken is required in FHIR STU3 (GP Connect may use extension)', path, stmt.id)
  }

  // Medication
  const medications = getEntries<fhir3.Medication>(bundle, 'Medication')
  if (medications.length === 0 && statements.length > 0) {
    issues.push({
      severity: 'warning',
      message: 'No Medication resources found — drug codes/names may be embedded in MedicationStatements instead',
      path: 'Bundle.entry',
    })
  }
  for (const med of medications) {
    req(issues, !!med.code, 'warning', 'Medication.code is missing — drug name/SNOMED code recommended',
      `Medication/${med.id}`, med.id)
  }

  // MedicationRequest
  const requests = getEntries<fhir3.MedicationRequest>(bundle, 'MedicationRequest')
  for (const req_ of requests) {
    const path = `MedicationRequest/${req_.id}`
    req(issues, !!req_.status, 'error', 'MedicationRequest.status is required', path, req_.id)
    req(issues, !!req_.intent, 'error', 'MedicationRequest.intent is required', path, req_.id)
  }

  // AllergyIntolerance
  const allergies = getEntries<fhir3.AllergyIntolerance>(bundle, 'AllergyIntolerance')
  for (const a of allergies) {
    const path = `AllergyIntolerance/${a.id}`
    req(issues, !!a.patient, 'error', 'AllergyIntolerance.patient is required', path, a.id)
    req(issues, !!a.code, 'warning', 'AllergyIntolerance.code (causative agent) is missing', path, a.id)
  }

  // Condition (Problems)
  const conditions = getEntries<fhir3.Condition>(bundle, 'Condition')
  for (const c of conditions) {
    const path = `Condition/${c.id}`
    req(issues, !!c.subject, 'error', 'Condition.subject is required', path, c.id)
    req(issues, !!c.code, 'warning', 'Condition.code (SNOMED) is missing', path, c.id)
  }

  // Encounter (Consultations)
  const encounters = getEntries<fhir3.Encounter>(bundle, 'Encounter')
  for (const e of encounters) {
    const path = `Encounter/${e.id}`
    req(issues, !!e.status, 'error', 'Encounter.status is required', path, e.id)
    req(issues, !!e.class, 'error', 'Encounter.class is required', path, e.id)
  }

  // Immunization
  const immunizations = getEntries<fhir3.Immunization>(bundle, 'Immunization')
  for (const imm of immunizations) {
    const path = `Immunization/${imm.id}`
    req(issues, !!imm.status, 'error', 'Immunization.status is required', path, imm.id)
    req(issues, imm.notGiven !== undefined, 'error', 'Immunization.notGiven is required in FHIR STU3', path, imm.id)
    req(issues, !!imm.vaccineCode, 'error', 'Immunization.vaccineCode is required', path, imm.id)
    req(issues, !!imm.patient, 'error', 'Immunization.patient is required', path, imm.id)
  }

  // DiagnosticReport (Investigations)
  const reports = getEntries<fhir3.DiagnosticReport>(bundle, 'DiagnosticReport')
  for (const r of reports) {
    const path = `DiagnosticReport/${r.id}`
    req(issues, !!r.status, 'error', 'DiagnosticReport.status is required', path, r.id)
    req(issues, !!r.code, 'error', 'DiagnosticReport.code is required', path, r.id)
  }

  // Observation (Coded Data + Investigation results)
  const observations = getEntries<fhir3.Observation>(bundle, 'Observation')
  for (const o of observations) {
    const path = `Observation/${o.id}`
    req(issues, !!o.status, 'error', 'Observation.status is required', path, o.id)
    req(issues, !!o.code, 'error', 'Observation.code is required', path, o.id)
  }

  // ReferralRequest
  const referrals = getEntries<fhir3.ReferralRequest>(bundle, 'ReferralRequest')
  for (const r of referrals) {
    const path = `ReferralRequest/${r.id}`
    req(issues, !!r.status, 'error', 'ReferralRequest.status is required', path, r.id)
    req(issues, !!r.intent, 'error', 'ReferralRequest.intent is required', path, r.id)
  }

  // ProcedureRequest (Diary Entries)
  const procedureRequests = getEntries<fhir3.ProcedureRequest>(bundle, 'ProcedureRequest')
  for (const p of procedureRequests) {
    const path = `ProcedureRequest/${p.id}`
    req(issues, !!p.status, 'error', 'ProcedureRequest.status is required', path, p.id)
    req(issues, !!p.intent, 'error', 'ProcedureRequest.intent is required', path, p.id)
    req(issues, !!p.subject, 'error', 'ProcedureRequest.subject is required', path, p.id)
    req(issues, !!p.code, 'warning', 'ProcedureRequest.code (procedure type) is missing', path, p.id)
  }

  const hasErrors = issues.some(i => i.severity === 'error')
  return { valid: !hasErrors, issues, resourceCounts }
}

// Backward-compat alias
export const validateMedicationsBundle = validateBundle
