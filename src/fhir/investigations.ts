import type { GpConnectInvestigation, GpConnectInvestigationResult, GpConnectObservationComponent } from './types'
import { getEntries, formatDate, resolvePractitionerRef, resolveReference, extractSnomedCode, extractSnomedDisplay, extractId, fhirDateKey } from './utils'

type ObsLike = fhir3.Observation & {
  comment?: string
  component?: Array<{
    code?: fhir3.CodeableConcept
    valueQuantity?: fhir3.Quantity
    valueString?: string
    referenceRange?: Array<{ low?: fhir3.Quantity; high?: fhir3.Quantity }>
    interpretation?: fhir3.CodeableConcept
  }>
}

function formatRange(rr: fhir3.ObservationReferenceRange | undefined): string | undefined {
  if (!rr) return undefined
  const low = rr.low?.value !== undefined ? String(rr.low.value) : undefined
  const high = rr.high?.value !== undefined ? String(rr.high.value) : undefined
  const unit = rr.low?.unit ?? rr.high?.unit
  if (low !== undefined && high !== undefined) return `${low}–${high}${unit ? ` ${unit}` : ''}`
  if (low !== undefined) return `>${low}${unit ? ` ${unit}` : ''}`
  if (high !== undefined) return `<${high}${unit ? ` ${unit}` : ''}`
  return rr.text
}

function extractObsResult(obs: ObsLike): Pick<GpConnectInvestigationResult, 'value' | 'unit' | 'referenceRange' | 'interpretation' | 'comment' | 'components'> {
  const vq = obs.valueQuantity
  const value = vq?.value !== undefined
    ? String(vq.value)
    : (obs as unknown as { valueString?: string }).valueString
      ?? obs.valueCodeableConcept?.text
      ?? obs.valueCodeableConcept?.coding?.[0]?.display

  const referenceRange = formatRange(obs.referenceRange?.[0])
  const interpretation = obs.interpretation?.coding?.[0]?.display ?? obs.interpretation?.text
  const comment = obs.comment || undefined

  const components: GpConnectObservationComponent[] | undefined = obs.component?.length
    ? obs.component.map(c => ({
        name: c.code?.text ?? c.code?.coding?.[0]?.display ?? 'Component',
        value: c.valueQuantity?.value !== undefined ? String(c.valueQuantity.value) : c.valueString,
        unit: c.valueQuantity?.unit,
        referenceRange: formatRange(c.referenceRange?.[0]),
        interpretation: c.interpretation?.coding?.[0]?.display ?? c.interpretation?.text,
      }))
    : undefined

  return { value, unit: vq?.unit, referenceRange, interpretation, comment, components }
}

export function extractInvestigations(bundle: fhir3.Bundle): GpConnectInvestigation[] {
  return getEntries<fhir3.DiagnosticReport>(bundle, 'DiagnosticReport')
    .sort((a, b) => fhirDateKey(
      (b as unknown as {effectiveDateTime?: string}).effectiveDateTime ?? b.issued
    ).localeCompare(fhirDateKey(
      (a as unknown as {effectiveDateTime?: string}).effectiveDateTime ?? a.issued
    )))
    .map(report => {
    const coding = report.code?.coding
    const castReport = report as unknown as Record<string, string>

    const performerRef = (report.performer?.[0] as { actor?: fhir3.Reference } | undefined)?.actor?.reference
    const { name: performer, id: performerId } = resolvePractitionerRef(bundle, performerRef)
    const contextRef = (report as unknown as { context?: { reference?: string } }).context?.reference
    const encounterId = extractId(contextRef)

    // Extract ALL result observations (P0 fix — was only extracting result[0])
    const reportId = report.id ?? crypto.randomUUID()
    const results: GpConnectInvestigationResult[] = ((report.result ?? []) as fhir3.Reference[])
      .flatMap(ref => {
        const obs = resolveReference(bundle, ref.reference) as ObsLike | undefined
        if (!obs) return []
        const obsCoding = obs.code?.coding
        return [{
          id: obs.id ?? crypto.randomUUID(),
          reportId,
          name: obs.code?.text ?? extractSnomedDisplay(obsCoding) ?? obsCoding?.[0]?.display ?? 'Result',
          snomedCode: extractSnomedCode(obsCoding),
          ...extractObsResult(obs),
        }]
      })

    const first = results[0]
    return {
      id: reportId,
      date: formatDate(report.issued ?? castReport.effectiveDateTime),
      name: report.code?.text ?? extractSnomedDisplay(coding) ?? coding?.[0]?.display ?? 'Unknown',
      snomedCode: extractSnomedCode(coding),
      performer,
      performerId,
      encounterId,
      results,
      result: first?.value,
      unit: first?.unit,
      referenceRange: first?.referenceRange,
      interpretation: first?.interpretation,
    }
  })
}
