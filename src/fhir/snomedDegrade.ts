import type { ValidationIssue, SnomedStatusMap } from './types'
import { extractOriginalTermText } from './utils'

// ---------------------------------------------------------------------------
// SNOMED CT concept ID validation + GP2GP transfer-degrade conversion.
//
// On load, every SNOMED CT coding in a bundle is checked against the real
// terminology server. A concept ID that doesn't resolve is rewritten to the
// appropriate "Transfer-degraded ..." SNOMED concept (per GP2GP/UK Core
// guidance for codes a receiving system doesn't recognise), with the
// original code and term preserved in CodeableConcept.text.
// ---------------------------------------------------------------------------

export const SNOMED_SYSTEM = 'http://snomed.info/sct'

interface DegradeCode {
  code: string
  display: string
}

// Verified live against the NHS terminology server (all active, real
// concepts under parent 196411000000103 "Transfer-degraded record entry").
const GENERIC_DEGRADE: DegradeCode = { code: '196411000000103', display: 'Transfer-degraded record entry' }
const MEDICATION_DEGRADE: DegradeCode = { code: '196421000000109', display: 'Transfer-degraded medication entry' }
const DRUG_ALLERGY_DEGRADE: DegradeCode = { code: '196461000000101', display: 'Transfer-degraded drug allergy' }
const NON_DRUG_ALLERGY_DEGRADE: DegradeCode = { code: '196471000000108', display: 'Transfer-degraded non-drug allergy' }
const REFERRAL_DEGRADE: DegradeCode = { code: '196431000000106', display: 'Transfer-degraded referral' }
const REQUEST_DEGRADE: DegradeCode = { code: '196441000000102', display: 'Transfer-degraded request' }

const RESOURCE_TYPE_DEGRADE_CODES: Record<string, DegradeCode> = {
  MedicationStatement: MEDICATION_DEGRADE,
  MedicationRequest: MEDICATION_DEGRADE,
  Medication: MEDICATION_DEGRADE,
  ReferralRequest: REFERRAL_DEGRADE,
  ProcedureRequest: REQUEST_DEGRADE,
}

interface AnyResource {
  resourceType: string
  id?: string
}

export interface SnomedCodingRef {
  resourceType: string
  resourceId: string | undefined
  path: string
  codeableConcept: { coding?: unknown[]; text?: string }
  coding: { system?: string; code?: string; display?: string; userSelected?: boolean }
}

/**
 * Walks every resource in the bundle looking for CodeableConcept-shaped
 * objects (anything with a `coding` array — the only place FHIR ever puts
 * one) and collects every coding whose system is SNOMED CT. Returned refs
 * hold live object references, so mutating `.coding`/`.codeableConcept`
 * mutates the bundle in place.
 */
export function findSnomedCodings(bundle: fhir3.Bundle): SnomedCodingRef[] {
  const refs: SnomedCodingRef[] = []

  function walk(obj: unknown, path: string, resourceType: string, resourceId: string | undefined) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${path}[${i}]`, resourceType, resourceId))
      return
    }
    const record = obj as Record<string, unknown>
    if (Array.isArray(record.coding)) {
      for (const coding of record.coding as SnomedCodingRef['coding'][]) {
        if (coding && coding.system === SNOMED_SYSTEM && coding.code) {
          refs.push({
            resourceType,
            resourceId,
            path,
            codeableConcept: record as SnomedCodingRef['codeableConcept'],
            coding,
          })
        }
      }
    }
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'coding') walk(value, `${path}.${key}`, resourceType, resourceId)
    }
  }

  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource as (fhir3.Resource & AnyResource) | undefined
    if (!resource) continue
    walk(resource, `${resource.resourceType}/${resource.id ?? '(no id)'}`, resource.resourceType, resource.id)
  }

  return refs
}

/**
 * Rewrites an invalid SNOMED coding to the appropriate transfer-degraded
 * concept, preserving the original code/term in CodeableConcept.text.
 * `allergyCategory` disambiguates drug vs non-drug allergy degrade codes
 * (only meaningful when ref.resourceType === 'AllergyIntolerance').
 */
export function degradeCoding(ref: SnomedCodingRef, allergyCategory?: string[]): void {
  const originalCode = ref.coding.code
  const originalTerm = extractOriginalTermText(ref.codeableConcept as unknown as fhir3.CodeableConcept) ?? 'Unknown term'

  let degrade: DegradeCode
  if (ref.resourceType === 'AllergyIntolerance') {
    degrade = allergyCategory?.includes('medication') ? DRUG_ALLERGY_DEGRADE : NON_DRUG_ALLERGY_DEGRADE
  } else {
    degrade = RESOURCE_TYPE_DEGRADE_CODES[ref.resourceType] ?? GENERIC_DEGRADE
  }

  ref.coding.system = SNOMED_SYSTEM
  ref.coding.code = degrade.code
  ref.coding.display = degrade.display
  ref.coding.userSelected = false
  ref.codeableConcept.text = `${originalTerm} (degraded from SNOMED CT ${originalCode})`
}

// ---------------------------------------------------------------------------
// Terminology server call
// ---------------------------------------------------------------------------

const CONFIG_KEY = 'gpc-snomed-config'

function getServerConfig(): { serverUrl: string; token?: string } {
  const defaultServerUrl = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { serverUrl?: string; token?: string }
      return { serverUrl: parsed.serverUrl || defaultServerUrl, token: parsed.token }
    }
  } catch {}
  return { serverUrl: defaultServerUrl }
}

async function validateCodesBatch(codes: string[]): Promise<Record<string, boolean>> {
  if (codes.length === 0) return {}
  const { serverUrl, token } = getServerConfig()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${serverUrl}/api/snomed/validate-batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ codes }),
  })
  if (!res.ok) {
    throw new Error(`SNOMED validate-batch failed (HTTP ${res.status})`)
  }
  const json = (await res.json()) as { results: Record<string, boolean> }
  return json.results
}

const MEDICATION_RESOURCE_TYPES = new Set(['MedicationStatement', 'MedicationRequest', 'Medication'])

/**
 * Bulk active/inactive (+ dm+d "withdrawn") status for every SNOMED CT coding
 * in the bundle — purely a UI tag, never fed into the transfer-degrade check
 * above (inactive concepts are still valid and must not be degraded).
 */
export async function checkSnomedStatuses(bundle: fhir3.Bundle): Promise<SnomedStatusMap> {
  const refs = findSnomedCodings(bundle)
  const uniqueCodes = [...new Set(refs.map(r => r.coding.code).filter((c): c is string => !!c))]
  if (uniqueCodes.length === 0) return {}

  const medicationCodes = [...new Set(
    refs.filter(r => MEDICATION_RESOURCE_TYPES.has(r.resourceType) && r.coding.code).map(r => r.coding.code!),
  )]

  const { serverUrl, token } = getServerConfig()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${serverUrl}/api/snomed/status-batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ codes: uniqueCodes, medicationCodes }),
  })
  if (!res.ok) {
    throw new Error(`SNOMED status-batch failed (HTTP ${res.status})`)
  }
  const json = (await res.json()) as { results: SnomedStatusMap }
  return json.results
}

export interface SnomedCheckResult {
  issues: ValidationIssue[]
  degradedCount: number
  checkFailed: boolean
  /** Title for the validation "passed" list — only set when every SNOMED
   * coding found in the bundle was successfully verified. */
  passed: string[]
}

/**
 * Checks every SNOMED CT coding in the bundle. When `mutate` is true (JSON
 * bundles), invalid codes are rewritten to a transfer-degraded coding in
 * place. When false (XML bundles — no serializer exists to write changes
 * back), invalid codes are only reported as validation issues.
 */
export async function checkAndDegradeSnomedCodes(
  bundle: fhir3.Bundle,
  { mutate }: { mutate: boolean },
): Promise<SnomedCheckResult> {
  const refs = findSnomedCodings(bundle)
  const uniqueCodes = [...new Set(refs.map(r => r.coding.code).filter((c): c is string => !!c))]

  if (uniqueCodes.length === 0) {
    return { issues: [], degradedCount: 0, checkFailed: false, passed: [] }
  }

  let results: Record<string, boolean>
  try {
    results = await validateCodesBatch(uniqueCodes)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      issues: [{
        severity: 'info',
        message: `Could not verify SNOMED CT codes — terminology server unavailable (${message})`,
        path: 'Bundle',
      }],
      degradedCount: 0,
      checkFailed: true,
      passed: [],
    }
  }

  const issues: ValidationIssue[] = []
  let degradedCount = 0

  for (const ref of refs) {
    const code = ref.coding.code
    if (!code || results[code] !== false) continue // valid, or not present in results (shouldn't happen)

    const originalTerm = extractOriginalTermText(ref.codeableConcept as unknown as fhir3.CodeableConcept)
    const termSuffix = originalTerm ? ` ("${originalTerm}")` : ''

    if (mutate) {
      const allergyCategory = ref.resourceType === 'AllergyIntolerance'
        ? (bundle.entry ?? [])
            .map(e => e.resource as (fhir3.AllergyIntolerance & { id?: string }) | undefined)
            .find(r => r?.resourceType === 'AllergyIntolerance' && r.id === ref.resourceId)
            ?.category as unknown as string[] | undefined
        : undefined
      degradeCoding(ref, allergyCategory)
      degradedCount++
      issues.push({
        severity: 'warning',
        message: `SNOMED CT code "${code}"${termSuffix} is not a valid concept — degraded to "${ref.coding.code} ${ref.coding.display}"`,
        path: ref.path,
        resourceId: ref.resourceId,
        snomedDegrade: {
          originalCode: code,
          originalDisplay: originalTerm,
          degradedCode: ref.coding.code!,
          degradedDisplay: ref.coding.display!,
        },
      })
    } else {
      issues.push({
        severity: 'warning',
        message: `SNOMED CT code "${code}"${termSuffix} is not a valid concept. Automatic degradation is only available for JSON-format files.`,
        path: ref.path,
        resourceId: ref.resourceId,
      })
    }
  }

  const invalidCount = uniqueCodes.filter(c => results[c] === false).length
  const passed = invalidCount === 0
    ? [`All ${uniqueCodes.length} SNOMED CT concept ID${uniqueCodes.length === 1 ? '' : 's'} verified against the terminology server`]
    : []

  return { issues, degradedCount, checkFailed: false, passed }
}
