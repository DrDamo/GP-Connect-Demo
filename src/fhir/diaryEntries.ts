import type { GpConnectDiaryEntry } from './types'
import { getEntries, formatDate, resolvePractitionerName } from './utils'

export function extractDiaryEntries(bundle: fhir3.Bundle): GpConnectDiaryEntry[] {
  return getEntries<fhir3.ProcedureRequest>(bundle, 'ProcedureRequest').map(resource => {
    const req = resource as unknown as { requester?: { agent?: fhir3.Reference } }
    const cast = resource as unknown as Record<string, string>
    const coding = resource.code?.coding?.[0]

    return {
      id: resource.id ?? crypto.randomUUID(),
      date: formatDate(resource.authoredOn ?? cast.occurrenceDateTime),
      description: resource.code?.text ?? coding?.display ?? 'Unknown',
      snomedCode: coding?.code,
      clinician: resolvePractitionerName(bundle, req.requester?.agent?.reference),
      priority: resource.priority,
      status: resource.status ?? 'unknown',
    }
  })
}
