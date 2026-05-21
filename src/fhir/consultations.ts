import type { GpConnectConsultation } from './types'
import { getEntries, formatDate, resolvePractitionerName, resolveReference, getOrganisationName } from './utils'

export function extractConsultations(bundle: fhir3.Bundle): GpConnectConsultation[] {
  return getEntries<fhir3.Encounter>(bundle, 'Encounter').map(enc => {
    const period = enc.period
    const participant = enc.participant?.[0]
    const clinician = resolvePractitionerName(
      bundle,
      (participant?.individual as fhir3.Reference | undefined)?.reference
    )

    const serviceProviderRef = (enc as unknown as { serviceProvider?: { reference?: string } })
      .serviceProvider?.reference
    const resolvedOrg = resolveReference(bundle, serviceProviderRef) as fhir3.Organization | undefined
    const organisation = resolvedOrg?.name ?? getOrganisationName(bundle)

    const typeEntry = enc.type?.[0]
    const type = typeEntry?.coding?.[0]?.display ?? typeEntry?.text

    return {
      id: enc.id ?? crypto.randomUUID(),
      date: formatDate(period?.start ?? period?.end),
      type,
      clinician,
      organisation,
    }
  })
}
