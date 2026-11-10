import { config } from './config'
import { getToken } from './auth'
import { UpstreamError } from './errors'
import type { FhirContains, FhirValueSetExpansion } from './types'

export async function expandValueSet(valueSetUrl: string, filter: string, count = 10): Promise<FhirContains[]> {
  const token = await getToken()

  const params = new URLSearchParams({
    url: valueSetUrl,
    filter,
    count: String(count),
    includeDesignations: 'true',
  })

  const res = await fetch(`${config.fhirBase}/ValueSet/$expand?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/fhir+json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new UpstreamError(res.status, `FHIR $expand failed (HTTP ${res.status}): ${text}`)
  }

  const body = await res.json() as FhirValueSetExpansion
  return body.expansion?.contains ?? []
}
