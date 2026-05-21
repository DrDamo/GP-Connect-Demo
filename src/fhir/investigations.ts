import type { GpConnectInvestigation } from './types'
import { getEntries, formatDate, resolvePractitionerName, resolveReference } from './utils'

export function extractInvestigations(bundle: fhir3.Bundle): GpConnectInvestigation[] {
  return getEntries<fhir3.DiagnosticReport>(bundle, 'DiagnosticReport').map(report => {
    const coding = report.code?.coding?.[0]

    const firstResultRef = (report.result?.[0] as fhir3.Reference | undefined)?.reference
    const obs = resolveReference(bundle, firstResultRef) as fhir3.Observation | undefined

    const valueQuantity = obs?.valueQuantity
    const result = valueQuantity?.value !== undefined
      ? String(valueQuantity.value)
      : (obs as unknown as { valueString?: string })?.valueString
        ?? obs?.valueCodeableConcept?.text

    const unit = valueQuantity?.unit

    const rr = obs?.referenceRange?.[0]
    let referenceRange: string | undefined
    if (rr) {
      const low = rr.low?.value !== undefined ? String(rr.low.value) : undefined
      const high = rr.high?.value !== undefined ? String(rr.high.value) : undefined
      const rrUnit = rr.low?.unit ?? rr.high?.unit
      if (low !== undefined && high !== undefined) {
        referenceRange = `${low}–${high}${rrUnit ? ` ${rrUnit}` : ''}`
      } else if (low !== undefined) {
        referenceRange = `>${low}${rrUnit ? ` ${rrUnit}` : ''}`
      } else if (high !== undefined) {
        referenceRange = `<${high}${rrUnit ? ` ${rrUnit}` : ''}`
      }
    }

    const interpretation = obs?.interpretation?.coding?.[0]?.display ?? obs?.interpretation?.text

    const performerRef = (report.performer?.[0] as { actor?: fhir3.Reference } | undefined)?.actor?.reference
    const performer = resolvePractitionerName(bundle, performerRef)

    const castReport = report as unknown as Record<string, string>

    return {
      id: report.id ?? crypto.randomUUID(),
      date: formatDate(report.issued ?? castReport.effectiveDateTime),
      name: report.code?.text ?? coding?.display ?? 'Unknown',
      snomedCode: coding?.code,
      result,
      unit,
      referenceRange,
      interpretation,
      performer,
    }
  })
}
