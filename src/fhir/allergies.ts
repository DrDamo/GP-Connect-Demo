import type { GpConnectAllergy } from './types'
import { getEntries, formatDate } from './utils'

export function extractAllergies(bundle: fhir3.Bundle): GpConnectAllergy[] {
  return getEntries<fhir3.AllergyIntolerance>(bundle, 'AllergyIntolerance').map(resource => {
    const coding = resource.code?.coding?.[0]
    const reactionManifestation = resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display
    const reactionDescription = (resource.reaction?.[0] as unknown as { description?: string })?.description

    return {
      id: resource.id ?? crypto.randomUUID(),
      causativeAgent: resource.code?.text ?? coding?.display ?? 'Unknown',
      snomedCode: coding?.code,
      category: (resource.category?.[0] as string | undefined),
      criticality: resource.criticality,
      reaction: reactionManifestation ?? reactionDescription,
      dateRecorded: formatDate((resource as unknown as { assertedDate?: string }).assertedDate),
      status: resource.clinicalStatus ?? 'unknown',
      verificationStatus: resource.verificationStatus,
    }
  })
}
