import type { DraftRecord } from '../types'
import type { TempIdMap } from '../idMap'
import { excludeConfidential, nopatMeta } from './security'

const SIGNIFICANCE_EXT = 'https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-ProblemSignificance-1'
const SIGNIFICANCE_SYSTEM = 'https://fhir.nhs.uk/STU3/CodeSystem/CareConnect-ProblemSignificance-1'
const RELATED_CONTENT_EXT = 'https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-GPC-RelatedClinicalContent-1'

// Fixed SNOMED CT codes for Condition.severity — a subjective clinician
// assessment, not a coded search field, so the UI offers just these three.
const SEVERITY_CODES: Record<'severe' | 'moderate' | 'mild', { code: string; display: string }> = {
  severe: { code: '24484000', display: 'Severe' },
  moderate: { code: '6736007', display: 'Moderate' },
  mild: { code: '255604002', display: 'Mild' },
}

export function generateProblems(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
  relatedContent: Map<string, string[]>,
): fhir3.BundleEntry[] {
  return excludeConfidential(draft.problems).map(p => {
    const { id, fullUrl } = map.entry(p._tempId)

    const significanceCode = p.significance ?? 'minor'
    const significanceDisplay = p.significance === 'major' ? 'Significant' : 'Minor'

    const extensions: fhir3.Extension[] = [
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
    ]

    const refs = relatedContent.get(p._tempId) ?? []
    for (const ref of refs) {
      extensions.push({ url: RELATED_CONTENT_EXT, valueReference: { reference: ref } })
    }

    const resource: fhir3.Condition = {
      resourceType: 'Condition',
      id,
      ...nopatMeta(p.notForPfs),
      extension: extensions,
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
      ...(p.severity
        ? {
            severity: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: SEVERITY_CODES[p.severity].code,
                  display: SEVERITY_CODES[p.severity].display,
                },
              ],
            },
          }
        : {}),
      subject: { reference: patientRef },
      ...(p.startDate ? { onsetDateTime: p.startDate } : {}),
      ...(p.endDate ? { abatementDateTime: p.endDate } : {}),
      ...(p.asserterTempId
        ? { asserter: { reference: map.ref(p.asserterTempId, 'Practitioner') } }
        : {}),
      ...(p.associatedText ? { note: [{ text: p.associatedText }] } : {}),
    }

    // assertedDate is a GP Connect STU3 field not in the fhir3 type definition
    if (p.assertedDate) {
      (resource as unknown as Record<string, unknown>)['assertedDate'] = p.assertedDate
    }

    return { fullUrl, resource }
  })
}
