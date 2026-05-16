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

export function validateMedicationsBundle(bundle: fhir3.Bundle): ValidationResult {
  const issues: ValidationIssue[] = []
  const resourceCounts = countResources(bundle)

  // Must be a Bundle
  if (bundle.resourceType !== 'Bundle') {
    issues.push({ severity: 'error', message: 'Root resource must be a Bundle', path: 'resourceType' })
    return { valid: false, issues, resourceCounts }
  }

  // Bundle type check
  if (bundle.type && !['collection', 'document', 'searchset'].includes(bundle.type)) {
    issues.push({
      severity: 'warning',
      message: `Bundle.type is "${bundle.type}"; GP Connect typically uses "collection" or "document"`,
      path: 'Bundle.type',
    })
  }

  // Must have entries
  if (!bundle.entry || bundle.entry.length === 0) {
    issues.push({ severity: 'error', message: 'Bundle has no entries', path: 'Bundle.entry' })
    return { valid: false, issues, resourceCounts }
  }

  // Should have a List resource for medications
  const lists = getEntries<fhir3.List>(bundle, 'List')
  if (lists.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No List resource found — GP Connect bundles typically include a List to organise medications',
      path: 'Bundle.entry',
    })
  } else {
    for (const list of lists) {
      if (!list.status) {
        issues.push({ severity: 'error', message: 'List.status is required', path: `List/${list.id}`, resourceId: list.id })
      }
      if (!list.mode) {
        issues.push({ severity: 'error', message: 'List.mode is required', path: `List/${list.id}`, resourceId: list.id })
      }
    }
  }

  // MedicationStatements
  const statements = getEntries<fhir3.MedicationStatement>(bundle, 'MedicationStatement')
  if (statements.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No MedicationStatement resources found',
      path: 'Bundle.entry',
    })
  }

  for (const stmt of statements) {
    const path = `MedicationStatement/${stmt.id}`

    if (!stmt.status) {
      issues.push({ severity: 'error', message: 'MedicationStatement.status is required', path, resourceId: stmt.id })
    }

    if (!stmt.medicationReference && !stmt.medicationCodeableConcept) {
      issues.push({
        severity: 'error',
        message: 'MedicationStatement must have medicationReference or medicationCodeableConcept',
        path,
        resourceId: stmt.id,
      })
    }

    if (!stmt.subject) {
      issues.push({ severity: 'error', message: 'MedicationStatement.subject is required', path, resourceId: stmt.id })
    }

    if (!stmt.taken) {
      issues.push({
        severity: 'warning',
        message: 'MedicationStatement.taken is required in FHIR STU3 (GP Connect may use extension)',
        path,
        resourceId: stmt.id,
      })
    }
  }

  // Medication resources
  const medications = getEntries<fhir3.Medication>(bundle, 'Medication')
  if (medications.length === 0 && statements.length > 0) {
    issues.push({
      severity: 'warning',
      message: 'No Medication resources found — drug codes/names may be embedded in MedicationStatements instead',
      path: 'Bundle.entry',
    })
  }

  for (const med of medications) {
    const path = `Medication/${med.id}`
    if (!med.code) {
      issues.push({
        severity: 'warning',
        message: 'Medication.code is missing — drug name/SNOMED code recommended',
        path,
        resourceId: med.id,
      })
    }
  }

  // Patient
  const patients = getEntries<fhir3.Patient>(bundle, 'Patient')
  if (patients.length === 0) {
    issues.push({ severity: 'warning', message: 'No Patient resource found in Bundle', path: 'Bundle.entry' })
  } else if (patients.length > 1) {
    issues.push({ severity: 'warning', message: 'Multiple Patient resources found — expected exactly one', path: 'Bundle.entry' })
  }

  // MedicationRequests (optional but common)
  const requests = getEntries<fhir3.MedicationRequest>(bundle, 'MedicationRequest')
  for (const req of requests) {
    const path = `MedicationRequest/${req.id}`
    if (!req.status) {
      issues.push({ severity: 'error', message: 'MedicationRequest.status is required', path, resourceId: req.id })
    }
    if (!req.intent) {
      issues.push({ severity: 'error', message: 'MedicationRequest.intent is required', path, resourceId: req.id })
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error')
  return { valid: !hasErrors, issues, resourceCounts }
}
