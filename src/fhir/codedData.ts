import type { GpConnectCodedDataItem, GpConnectObservationComponent } from './types'
import { getEntries, formatDate, extractSnomedCode, resolvePractitionerRef, extractId, fhirDateKey } from './utils'

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

export function extractCodedData(bundle: fhir3.Bundle): GpConnectCodedDataItem[] {
  // GP Connect scopes uncategorised coded data to the miscellaneous record List
  // (826501000000100). Using the list prevents consultation-internal Observations
  // (which appear in category lists with code 24781000000107) from leaking here.
  // Fall back to a filtered bundle-wide scan for non-compliant/partial bundles.
  const miscList = getEntries<fhir3.List>(bundle, 'List')
    .find(l => l.code?.coding?.some(c => c.code === '826501000000100'))

  let observations: ObsLike[]

  if (miscList) {
    const allowedIds = new Set(
      (miscList.entry ?? [])
        .map(e => extractId(e.item?.reference))
        .filter((id): id is string => !!id)
    )
    observations = getEntries<ObsLike>(bundle, 'Observation')
      .filter(obs => allowedIds.has(obs.id ?? ''))
  } else {
    // Fallback: exclude investigation results and consultation note Observations
    const investigationObsIds = new Set<string>()
    getEntries<fhir3.DiagnosticReport>(bundle, 'DiagnosticReport').forEach(report => {
      ;(report.result ?? []).forEach(ref => {
        const id = (ref as fhir3.Reference).reference?.split('/').pop()
        if (id) investigationObsIds.add(id)
      })
    })
    observations = getEntries<ObsLike>(bundle, 'Observation')
      .filter(obs => !investigationObsIds.has(obs.id ?? ''))
      .filter(obs => !obs.code?.coding?.some(c => c.code === '37331000000100'))
  }

  return observations
    .sort((a, b) => fhirDateKey(
      (b as unknown as {effectiveDateTime?: string}).effectiveDateTime ?? b.issued
    ).localeCompare(fhirDateKey(
      (a as unknown as {effectiveDateTime?: string}).effectiveDateTime ?? a.issued
    )))
    .map(obs => {
      const cast = obs as unknown as Record<string, string>
      const coding = obs.code?.coding
      const vq = obs.valueQuantity
      const value = vq?.value !== undefined
        ? String(vq.value)
        : (obs as unknown as { valueString?: string }).valueString
          ?? obs.valueCodeableConcept?.text
          ?? obs.valueCodeableConcept?.coding?.[0]?.display

      const interpretation = obs.interpretation?.coding?.[0]?.display ?? obs.interpretation?.text

      const components: GpConnectObservationComponent[] | undefined = obs.component?.length
        ? obs.component.map(c => ({
            name: c.code?.text ?? c.code?.coding?.[0]?.display ?? 'Component',
            value: c.valueQuantity?.value !== undefined ? String(c.valueQuantity.value) : c.valueString,
            unit: c.valueQuantity?.unit,
            interpretation: c.interpretation?.coding?.[0]?.display ?? c.interpretation?.text,
          }))
        : undefined

      const performerRef = (Array.isArray(obs.performer) ? obs.performer[0] : obs.performer)?.reference
      const { name: performer, id: performerId } = resolvePractitionerRef(bundle, performerRef)
      const contextRef = (obs as unknown as { context?: { reference?: string } }).context?.reference
      const encounterId = extractId(contextRef)

      const effectiveDateTime = cast.effectiveDateTime
      const isIssuedDate = !effectiveDateTime && !!obs.issued
      const category = (obs.category as fhir3.CodeableConcept[] | undefined)?.[0]?.coding?.[0]?.display
        ?? (obs.category as fhir3.CodeableConcept[] | undefined)?.[0]?.text

      return {
        id: obs.id ?? crypto.randomUUID(),
        date: formatDate(effectiveDateTime ?? obs.issued),
        isIssuedDate,
        category,
        snomedCode: extractSnomedCode(coding),
        description: obs.code?.text ?? coding?.[0]?.display ?? 'Unknown',
        value,
        unit: vq?.unit,
        comment: obs.comment || undefined,
        interpretation: interpretation || undefined,
        performer: performer || undefined,
        performerId: performerId || undefined,
        encounterId: encounterId || undefined,
        components,
      }
    })
}
