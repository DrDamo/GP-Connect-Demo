import type { GpConnectCodedDataItem } from './types'
import { getEntries, formatDate } from './utils'

export function extractCodedData(bundle: fhir3.Bundle): GpConnectCodedDataItem[] {
  const referencedIds = new Set<string>()
  getEntries<fhir3.DiagnosticReport>(bundle, 'DiagnosticReport').forEach(report => {
    (report.result ?? []).forEach(ref => {
      const r = ref as fhir3.Reference
      if (r.reference) {
        const parts = r.reference.split('/')
        referencedIds.add(parts[parts.length - 1])
      }
    })
  })

  return getEntries<fhir3.Observation>(bundle, 'Observation')
    .filter(obs => obs.id && !referencedIds.has(obs.id))
    .map(obs => {
      const cast = obs as unknown as Record<string, string>
      const coding = obs.code?.coding?.[0]
      const valueQuantity = obs.valueQuantity
      const value = valueQuantity?.value !== undefined
        ? String(valueQuantity.value)
        : (obs as unknown as { valueString?: string }).valueString
          ?? obs.valueCodeableConcept?.text
          ?? obs.valueCodeableConcept?.coding?.[0]?.display

      return {
        id: obs.id ?? crypto.randomUUID(),
        date: formatDate(cast.effectiveDateTime ?? obs.issued),
        snomedCode: coding?.code,
        description: obs.code?.text ?? coding?.display ?? 'Unknown',
        value,
        unit: valueQuantity?.unit,
      }
    })
}
