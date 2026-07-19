import type { DraftRecord, DraftInvestigationResult } from '../types'
import type { TempIdMap } from '../idMap'
import { excludeConfidential, nopatMeta } from './security'

const SNOMED = 'http://snomed.info/sct'

function makeObservation(
  result: DraftInvestigationResult,
  map: TempIdMap,
  patientRef: string,
  notForPfs: boolean | undefined,
): { entry: fhir3.BundleEntry; ref: string } {
  const { id, fullUrl } = map.entry(result._tempId)

  const hasUnit = Boolean(result.unit)
  const hasValue = result.value !== undefined && result.value !== ''

  const valueFields: Partial<fhir3.Observation> = hasValue
    ? hasUnit
      ? { valueQuantity: { value: parseFloat(result.value!), unit: result.unit } }
      : { valueString: result.value }
    : {}

  const referenceRange: fhir3.ObservationReferenceRange[] | undefined =
    result.referenceRangeLow || result.referenceRangeHigh
      ? [
          {
            ...(result.referenceRangeLow
              ? { low: { value: parseFloat(result.referenceRangeLow) } }
              : {}),
            ...(result.referenceRangeHigh
              ? { high: { value: parseFloat(result.referenceRangeHigh) } }
              : {}),
          },
        ]
      : undefined

  const resource: fhir3.Observation & { comment?: string } = {
    resourceType: 'Observation',
    id,
    ...nopatMeta(notForPfs),
    status: 'final',
    code: {
      coding: [
        {
          system: SNOMED,
          ...(result.snomedCode ? { code: result.snomedCode } : {}),
          ...(result.name ? { display: result.name } : {}),
        },
      ],
      ...(result.name ? { text: result.name } : {}),
    },
    subject: { reference: patientRef },
    ...valueFields,
    ...(referenceRange ? { referenceRange } : {}),
    ...(result.interpretation
      ? { interpretation: { coding: [{ display: result.interpretation }] } }
      : {}),
    ...(result.comment ? { comment: result.comment } : {}),
  }

  return { entry: { fullUrl, resource }, ref: `Observation/${id}` }
}

export function generateInvestigations(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
): fhir3.BundleEntry[] {
  const entries: fhir3.BundleEntry[] = []

  for (const inv of excludeConfidential(draft.investigations)) {
    const { id, fullUrl } = map.entry(inv._tempId)

    const observationResults = inv.results.map(r => makeObservation(r, map, patientRef, inv.notForPfs))
    for (const { entry } of observationResults) entries.push(entry)

    const issuedDate = inv.date ? new Date(inv.date).toISOString() : new Date().toISOString()

    const report: fhir3.DiagnosticReport = {
      resourceType: 'DiagnosticReport',
      id,
      ...nopatMeta(inv.notForPfs),
      status: (inv.status as fhir3.DiagnosticReport['status']) ?? 'final',
      code: {
        coding: [
          {
            system: SNOMED,
            ...(inv.snomedCode ? { code: inv.snomedCode } : {}),
            ...(inv.name ? { display: inv.name } : {}),
          },
        ],
        ...(inv.name ? { text: inv.name } : {}),
      },
      subject: { reference: patientRef },
      issued: issuedDate,
      ...(inv.performerTempId
        ? { performer: [{ actor: { reference: map.ref(inv.performerTempId, 'Practitioner') } }] }
        : {}),
      ...(observationResults.length > 0
        ? { result: observationResults.map(r => ({ reference: r.ref })) }
        : {}),
    }

    entries.push({ fullUrl, resource: report })
  }

  return entries
}
