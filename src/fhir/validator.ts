import type { ValidationIssue, ValidationResult } from './types'

type AnyResource = fhir3.Resource & { resourceType: string }

// All valid SNOMED codes for GP Connect List resources (14 total):
// 11 primary domain Lists + 3 consultation-structure Lists (per CareConnect-GPC-List-1 profile)
const GP_CONNECT_KNOWN_LIST_CODES = new Set([
  // Primary domain Lists
  '886921000000105',  // Allergies and adverse reactions
  '1103671000000101', // Ended allergies
  '1149501000000101', // List of consultations
  '714311000000108',  // Patient recall administration (diary entries)
  '1102181000000102', // Immunisations
  '887191000000108',  // Investigations and results
  '933361000000108',  // Medications and medical devices
  '792931000000107',  // Outbound referral
  '717711000000103',  // Problems
  '826501000000100',  // Miscellaneous record (uncategorised data)
  '823701000000100',  // Documents
  // Consultation-structure Lists (GP Connect structured consultation record)
  '325851000000107',  // Consultation (consultation wrapper List per Encounter)
  '25851000000105',   // Consultation topic (topic List within consultation)
  '24781000000107',   // Consultation category (category List within topic)
])

function buildReferenceIndex(bundle: fhir3.Bundle): Set<string> {
  const refs = new Set<string>()
  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as AnyResource | undefined
    if (!r) continue
    if (entry.fullUrl) refs.add(entry.fullUrl)
    if (r.id) {
      refs.add(`${r.resourceType}/${r.id}`)
      refs.add(r.id)
    }
  }
  return refs
}

// Returns true if ref is absent, local ('#'), or found in the index
function resolves(ref: string | undefined, index: Set<string>): boolean {
  if (!ref) return true
  if (ref.startsWith('#')) return true
  return index.has(ref)
}

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

  // Duplicate resource IDs — FHIR requires each resource in a bundle to have a unique id.
  // Duplicate ids cause reference resolution to return the wrong resource and FHIR source
  // links to navigate to the first occurrence regardless of type.
  const seenIds = new Set<string>()
  for (const entry of bundle.entry) {
    const r = entry.resource as AnyResource | undefined
    if (!r?.id) continue
    const key = `${r.resourceType}/${r.id}`
    if (seenIds.has(key)) {
      issues.push({
        severity: 'error',
        message: `Duplicate resource ID "${r.id}" on ${r.resourceType} — IDs must be unique per resource type within a bundle. FHIR links for this resource will resolve to the first occurrence.`,
        path: key,
        resourceId: r.id,
      })
    }
    seenIds.add(key)
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
    // Encounter.class is 1..1 in base FHIR, but GP Connect's CareConnect-GPC-Encounter-1
    // profile doesn't carry that requirement forward, and most GP source systems (EMIS,
    // TPP) don't populate it for primary-care encounters — so its absence is a minor data
    // completeness note, not a structural validation error.
    req(issues, !!e.class, 'warning', 'Encounter.class is missing', path, e.id)
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

  // DocumentReference (Documents)
  const docRefs = getEntries<fhir3.DocumentReference>(bundle, 'DocumentReference')
  for (const d of docRefs) {
    const path = `DocumentReference/${d.id}`
    req(issues, !!d.status, 'error', 'DocumentReference.status is required', path, d.id)
    req(issues, !!d.type, 'warning', 'DocumentReference.type (document category) is missing', path, d.id)
    req(issues, (d.content?.length ?? 0) > 0, 'warning', 'DocumentReference.content is empty — no attachment', path, d.id)
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

  // ─── GP Connect-specific checks ─────────────────────────────────────────────

  const refIndex = buildReferenceIndex(bundle)

  // NOPAT security labels (patient-restricted information)
  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as AnyResource | undefined
    if (!r) continue
    const hasNopat = (r.meta?.security ?? []).some((s: fhir3.Coding) => s.code === 'NOPAT')
    if (hasNopat) {
      issues.push({
        severity: 'info',
        message: 'Patient-restricted information present (NOPAT security label)',
        path: `${r.resourceType}/${r.id}`,
        resourceId: r.id,
      })
    }
  }

  // All subject/patient references should point to the same Patient
  const patientRefs = new Set<string>()
  const addPatientRef = (ref: string | undefined) => { if (ref) patientRefs.add(ref) }
  statements.forEach(s => addPatientRef(s.subject?.reference))
  allergies.forEach(a => addPatientRef(a.patient?.reference))
  conditions.forEach(c => addPatientRef(c.subject?.reference))
  encounters.forEach(e => addPatientRef(e.subject?.reference))
  immunizations.forEach(i => addPatientRef(i.patient?.reference))
  reports.forEach(r => addPatientRef(r.subject?.reference))
  observations.forEach(o => addPatientRef(o.subject?.reference))
  procedureRequests.forEach(p => addPatientRef(p.subject?.reference))
  if (patientRefs.size > 1) {
    issues.push({
      severity: 'warning',
      message: `Resources reference ${patientRefs.size} different patients — bundle must represent a single patient`,
      path: 'Bundle',
    })
  }

  // MedicationStatement: medicationReference must resolve; warn if inline code used instead
  for (const stmt of statements) {
    if (stmt.medicationReference?.reference) {
      req(issues, resolves(stmt.medicationReference.reference, refIndex), 'warning',
        'MedicationStatement.medicationReference does not resolve to a bundle entry',
        `MedicationStatement/${stmt.id}`, stmt.id)
    }
    if (!stmt.medicationReference && stmt.medicationCodeableConcept) {
      issues.push({
        severity: 'info',
        message: 'MedicationStatement uses inline medicationCodeableConcept — GP Connect expects a Reference to a Medication resource',
        path: `MedicationStatement/${stmt.id}`,
        resourceId: stmt.id,
      })
    }
  }

  // Resolved allergies must be in List.contained, not top-level bundle entries
  for (const a of allergies) {
    if (a.clinicalStatus === 'resolved') {
      issues.push({
        severity: 'warning',
        message: 'Resolved AllergyIntolerance is a top-level bundle entry — GP Connect requires resolved allergies inside List.contained (ended-allergies List)',
        path: `AllergyIntolerance/${a.id}`,
        resourceId: a.id,
      })
    }
  }

  // MedicationRequest.intent should be 'plan' (authorisation) or 'order' (issue)
  for (const mr of requests) {
    if (mr.intent && !['plan', 'order'].includes(mr.intent)) {
      issues.push({
        severity: 'info',
        message: `MedicationRequest.intent is "${mr.intent}" — GP Connect uses "plan" (authorisation) or "order" (issue)`,
        path: `MedicationRequest/${mr.id}`,
        resourceId: mr.id,
      })
    }
  }

  // Encounters should carry a GP Connect consultation record type code
  for (const e of encounters) {
    const hasConsultationType = (e.type ?? []).some(t =>
      (t.coding ?? []).some(c =>
        c.system === 'https://fhir.nhs.uk/STU3/CodeSystem/GPConnect-ConsultationRecordType-1'
      )
    )
    req(issues, hasConsultationType, 'info',
      'Encounter.type does not include a GP Connect consultation record type code',
      `Encounter/${e.id}`, e.id)
  }

  // Lists should have a code; primary Lists should use a known GP Connect SNOMED code
  for (const list of lists) {
    const codings = list.code?.coding ?? []
    const hasCode = codings.length > 0 || !!list.code?.text
    if (!hasCode) {
      issues.push({
        severity: 'info',
        message: 'List has no code — GP Connect primary Lists identify their clinical area with a SNOMED CT code',
        path: `List/${list.id}`,
        resourceId: list.id,
      })
    } else {
      const snomedCodes = codings
        .filter(c => c.system === 'http://snomed.info/sct')
        .map(c => c.code)
        .filter((c): c is string => !!c)
      if (snomedCodes.length > 0 && !snomedCodes.some(c => GP_CONNECT_KNOWN_LIST_CODES.has(c))) {
        issues.push({
          severity: 'info',
          message: `List SNOMED code(s) [${snomedCodes.join(', ')}] are not a recognised GP Connect list code`,
          path: `List/${list.id}`,
          resourceId: list.id,
        })
      }
    }
  }

  // ─── Dangling reference check ────────────────────────────────────────────────
  // Walk every resource and collect all { reference: string } objects.
  // Each ref must resolve to a bundle entry. Local contained refs (#id) are
  // always skipped; absolute URLs (http/https/urn) are skipped as they point
  // to external systems outside this bundle.

  function collectRefs(obj: unknown, refs: Array<{ ref: string; path: string }>, path: string) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => collectRefs(item, refs, `${path}[${i}]`))
      return
    }
    const record = obj as Record<string, unknown>
    if (typeof record.reference === 'string' && record.reference) {
      refs.push({ ref: record.reference, path })
    }
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'reference') collectRefs(value, refs, `${path}.${key}`)
    }
  }

  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as AnyResource | undefined
    if (!r) continue
    const resourcePath = `${r.resourceType}/${r.id ?? '(no id)'}`
    const refs: Array<{ ref: string; path: string }> = []
    collectRefs(r, refs, resourcePath)
    for (const { ref, path } of refs) {
      if (ref.startsWith('#')) continue           // local contained — always valid
      if (/^https?:\/\/|^urn:/.test(ref)) continue // external URL — out of scope
      if (!resolves(ref, refIndex)) {
        issues.push({
          severity: 'warning',
          message: `Reference "${ref}" does not resolve to any resource in this bundle`,
          path,
          resourceId: r.id,
        })
      }
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error')
  return { valid: !hasErrors, issues, resourceCounts }
}

// Backward-compat alias
export const validateMedicationsBundle = validateBundle

// Remove all unresolvable references from a bundle.
// Returns the cleaned bundle and the number of reference strings removed.
// Local contained refs (#id) and absolute URLs (http/https/urn) are left untouched.
export function cleanDanglingRefs(bundle: fhir3.Bundle): { bundle: fhir3.Bundle; removedCount: number } {
  const index = buildReferenceIndex(bundle)
  let removedCount = 0

  function clean(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) {
      return (obj as unknown[]).map(clean).filter(item => item !== null)
    }
    const record = obj as Record<string, unknown>
    let refRemoved = false
    if (typeof record.reference === 'string' && record.reference) {
      const ref = record.reference
      if (!ref.startsWith('#') && !/^https?:\/\/|^urn:/.test(ref) && !index.has(ref)) {
        refRemoved = true
        removedCount++
      }
    }
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(record)) {
      if (key === 'reference' && refRemoved) continue
      result[key] = clean(value)
    }
    // Object was purely {reference: "..."} and ref was removed — signal parent to drop it
    if (refRemoved && Object.keys(result).length === 0) return null
    return result
  }

  return { bundle: clean(bundle) as fhir3.Bundle, removedCount }
}
