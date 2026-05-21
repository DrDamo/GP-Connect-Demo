import type { GpConnectImmunisation } from './types'
import { getEntries, formatDate, resolvePractitionerName } from './utils'

export function extractImmunisations(bundle: fhir3.Bundle): GpConnectImmunisation[] {
  return getEntries<fhir3.Immunization>(bundle, 'Immunization').map(resource => {
    const coding = resource.vaccineCode?.coding?.[0]
    const site = resource.site
    const practitioner = resource.practitioner?.[0]
    const actorRef = (practitioner?.actor as fhir3.Reference | undefined)?.reference

    return {
      id: resource.id ?? crypto.randomUUID(),
      vaccine: resource.vaccineCode?.text ?? coding?.display ?? 'Unknown',
      snomedCode: coding?.code,
      dateGiven: formatDate(resource.date),
      status: resource.status ?? 'unknown',
      site: site?.coding?.[0]?.display ?? site?.text,
      batchNumber: resource.lotNumber,
      performer: resolvePractitionerName(bundle, actorRef),
    }
  })
}
