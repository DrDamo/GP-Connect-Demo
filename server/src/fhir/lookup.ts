import { config } from '../config.js'
import { getToken } from '../auth.js'
import type { FhirParameters } from './types.js'

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
