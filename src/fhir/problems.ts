import type { GpConnectProblem } from './types'
import { getEntries, formatDate, getExtensionValue } from './utils'

export function extractProblems(bundle: fhir3.Bundle): GpConnectProblem[] {
  return getEntries<fhir3.Condition>(bundle, 'Condition').map(resource => {
    const coding = resource.code?.coding?.[0]
    const cast = resource as unknown as Record<string, string>

    const sigExt = getExtensionValue(
      resource.extension,
      'Extension-CareConnect-GPC-ProblemSignificance-1'
    )
    const sigCC = sigExt?.valueCodeableConcept as fhir3.CodeableConcept | undefined
    const significance = sigCC?.coding?.[0]?.display ?? sigCC?.text

    return {
      id: resource.id ?? crypto.randomUUID(),
      problem: resource.code?.text ?? coding?.display ?? 'Unknown',
      snomedCode: coding?.code,
      clinicalStatus: resource.clinicalStatus ?? 'unknown',
      significance,
      startDate: formatDate(cast.onsetDateTime),
      endDate: formatDate(cast.abatementDateTime),
    }
  })
}
