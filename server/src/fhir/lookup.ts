import { config } from '../config.js'
import { getToken } from '../auth.js'
import type { FhirParameters } from './types.js'
import { extractCodeStatus, dmdMembershipValueSetUrl, type CodeStatus } from './mappers.js'

const SNOMED_SYSTEM = 'http://snomed.info/sct'
const VALIDATE_CODE_BATCH_CHUNK_SIZE = 200

// Requesting these properties explicitly (rather than relying on the server's
// default set) is what unlocks `normalForm` — the full SNOMED defining
// expression, which is where strength/dose-form/route attributes live for
// dm+d concepts. Passing an explicit property list replaces the default set
// entirely (confirmed live) — so parent/child/inactive/designation all need
// re-requesting alongside it, or they silently disappear from the response.
const LOOKUP_PROPERTIES = ['normalForm', 'parent', 'child', 'inactive', 'designation']

// FHIR CodeSystem/$lookup — full detail for a single code (properties,
// designations, relationships), as opposed to ValueSet/$expand which only
// returns the fields needed for a search result list.
export async function lookupCode(system: string, code: string): Promise<FhirParameters> {
  const token = await getToken()

  const params = new URLSearchParams({ system, code })
  for (const property of LOOKUP_PROPERTIES) params.append('property', property)

  const res = await fetch(`${config.fhirBase}/CodeSystem/$lookup?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/fhir+json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`FHIR $lookup failed (HTTP ${res.status}): ${text}`)
  }

  return (await res.json()) as FhirParameters
}

interface FhirBatchResponseEntry {
  resource?: FhirParameters
  response?: { status: string }
}

interface FhirBatchResponse {
  resourceType: 'Bundle'
  type: 'batch-response'
  entry?: FhirBatchResponseEntry[]
}

// Validates a batch of SNOMED CT concept IDs in as few round trips as
// possible. Uses CodeSystem/$validate-code (not $lookup) because it always
// returns HTTP 200 with a `result` boolean — $lookup throws on unknown
// codes, which is awkward to distinguish from a genuine server error.
// Batched via a FHIR `type: "batch"` Bundle (one $validate-code GET per
// entry) — confirmed the server preserves response entry order to match
// request order, and handles ~300 codes per round trip in well under a
// second.
export async function validateCodesBatch(codes: string[]): Promise<Record<string, boolean>> {
  const unique = [...new Set(codes)]
  const results: Record<string, boolean> = {}
  if (unique.length === 0) return results

  const token = await getToken()

  for (let i = 0; i < unique.length; i += VALIDATE_CODE_BATCH_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + VALIDATE_CODE_BATCH_CHUNK_SIZE)
    const batchBundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: chunk.map(code => ({
        request: {
          method: 'GET',
          url: `CodeSystem/$validate-code?url=${encodeURIComponent(SNOMED_SYSTEM)}&code=${encodeURIComponent(code)}`,
        },
      })),
    }

    const res = await fetch(config.fhirBase, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      body: JSON.stringify(batchBundle),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`FHIR batch $validate-code failed (HTTP ${res.status}): ${text}`)
    }

    const batchResponse = (await res.json()) as FhirBatchResponse
    const entries = batchResponse.entry ?? []
    chunk.forEach((code, idx) => {
      const params = entries[idx]?.resource?.parameter ?? []
      const result = params.find(p => p.name === 'result')?.valueBoolean
      results[code] = result === true
    })
  }

  return results
}

// Validates a batch of medication codes against dm+d membership (the
// combined VMP + AMP ValueSet), not mere SNOMED CT existence — a code can be
// a perfectly valid, active SNOMED CT concept and still not be a dm+d
// product (e.g. a clinical finding code mistakenly used on a medication
// resource). Same ValueSet/$validate-code + batching approach as
// validateCodesBatch above, but against ValueSet/$validate-code (ValueSet
// membership) rather than CodeSystem/$validate-code (system existence).
export async function validateDmdCodesBatch(codes: string[]): Promise<Record<string, boolean>> {
  const unique = [...new Set(codes)]
  const results: Record<string, boolean> = {}
  if (unique.length === 0) return results

  const token = await getToken()
  const vsUrl = dmdMembershipValueSetUrl()

  for (let i = 0; i < unique.length; i += VALIDATE_CODE_BATCH_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + VALIDATE_CODE_BATCH_CHUNK_SIZE)
    const batchBundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: chunk.map(code => {
        const params = new URLSearchParams({ url: vsUrl, system: SNOMED_SYSTEM, code })
        return { request: { method: 'GET', url: `ValueSet/$validate-code?${params}` } }
      }),
    }

    const res = await fetch(config.fhirBase, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      body: JSON.stringify(batchBundle),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`FHIR batch ValueSet $validate-code failed (HTTP ${res.status}): ${text}`)
    }

    const batchResponse = (await res.json()) as FhirBatchResponse
    const entries = batchResponse.entry ?? []
    chunk.forEach((code, idx) => {
      const params = entries[idx]?.resource?.parameter ?? []
      const result = params.find(p => p.name === 'result')?.valueBoolean
      results[code] = result === true
    })
  }

  return results
}

// Bulk active/inactive (+ dm+d "withdrawn") status for every SNOMED CT/dm+d
// coding in a loaded bundle — used to tag codes in the UI, not to decide
// whether a code gets transfer-degraded (that's validateCodesBatch above,
// existence-only via $validate-code; an inactive-but-real concept must not
// be degraded). Batched the same way as validateCodesBatch, but with
// CodeSystem/$lookup per entry instead — codes in `medicationCodes` also
// request `normalForm` so extractCodeStatus can check prescribing/
// non-availability status for a discontinued AMP. A code that fails to
// resolve (shouldn't happen here — callers only need to check codes already
// confirmed valid) is simply left out of the result rather than failing the
// whole batch.
export async function lookupStatusBatch(
  codes: string[],
  medicationCodes: Set<string>,
): Promise<Record<string, CodeStatus>> {
  const unique = [...new Set(codes)]
  const results: Record<string, CodeStatus> = {}
  if (unique.length === 0) return results

  const token = await getToken()

  for (let i = 0; i < unique.length; i += VALIDATE_CODE_BATCH_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + VALIDATE_CODE_BATCH_CHUNK_SIZE)
    const batchBundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: chunk.map(code => {
        const properties = medicationCodes.has(code) ? ['inactive', 'normalForm'] : ['inactive']
        const params = new URLSearchParams({ system: SNOMED_SYSTEM, code })
        for (const property of properties) params.append('property', property)
        return { request: { method: 'GET', url: `CodeSystem/$lookup?${params}` } }
      }),
    }

    const res = await fetch(config.fhirBase, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      body: JSON.stringify(batchBundle),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`FHIR batch $lookup failed (HTTP ${res.status}): ${text}`)
    }

    const batchResponse = (await res.json()) as FhirBatchResponse
    const entries = batchResponse.entry ?? []
    chunk.forEach((code, idx) => {
      const entry = entries[idx]
      if (!entry?.response?.status?.startsWith('2') || !entry.resource) return // unresolvable — leave unset
      results[code] = extractCodeStatus(entry.resource, medicationCodes.has(code))
    })
  }

  return results
}
