import type { DraftRecord } from '../types'
import type { TempIdMap } from '../idMap'

const SIGNIFICANCE_EXT = 'https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-ProblemSignificance-1'
const SIGNIFICANCE_SYSTEM = 'https://fhir.nhs.uk/STU3/CodeSystem/CareConnect-ProblemSignificance-1'

export function generateProblems(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
): fhir3.BundleEntry[] {
  return draft.problems.map(p => {
    const { id, fullUrl } = map.entry(p._tempId)

    const significanceCode = p.significance ?? 'minor'
    const significanceDisplay = p.significance === 'major' ? 'Significant' : 'Minor'

    const resource: fhir3.Condition = {
      resourceType: 'Condition',
      id,
      extension: [
        {
          url: SIGNIFICANCE_EXT,
          valueCodeableConcept: {
            coding: [
              {
                system: SIGNIFICANCE_SYSTEM,
                code: significanceCode,
                display: significanceDisplay,
              },
            ],
          },
        },
      ],
      clinicalStatus: p.clinicalStatus ?? 'active',
      verificationStatus: 'confirmed',
      code: {
        ...(p.snomedCode || p.problem
          ? {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  ...(p.snomedCode ? { code: p.snomedCode } : {}),
                  ...(p.problem ? { display: p.problem } : {}),
                },
              ],
            }
          : {}),
        ...(p.problem ? { text: p.problem } : {}),
      },
      subject: { reference: patientRef },
      ...(p.startDate ? { onsetDateTime: p.startDate } : {}),
      ...(p.endDate ? { abatementDateTime: p.endDate } : {}),
      ...(p.asserterTempId
        ? { asserter: { reference: map.ref(p.asserterTempId, 'Practitioner') } }
        : {}),
      ...((p.notes ?? []).length > 0
        ? { note: p.notes!.map(n => ({ text: n })) }
        : {}),
    }

    // assertedDate is a GP Connect STU3 field not in the fhir3 type definition
    if (p.assertedDate) {
      (resource as unknown as Record<string, unknown>)['assertedDate'] = p.assertedDate
    }

    return { fullUrl, resource }
  })
}
