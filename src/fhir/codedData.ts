import type { GpConnectCodedDataItem, GpConnectObservationComponent } from './types'
import { getEntries, formatDate, extractSnomedCode, resolvePractitionerRef, resolveReference, extractId, fhirDateKey } from './utils'

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

const TRANSFER_DEGRADED_CODE = '196411000000103'

function extractObsDescription(obs: ObsLike): string {
  const coding = obs.code?.coding
  const codeText = obs.code?.text
  if (!codeText && coding?.some(c => c.code === TRANSFER_DEGRADED_CODE) && obs.comment) {
    const m = obs.comment.match(/^Original text:\s*([^\n\r]+)/im)
    if (m) return m[1].trim()
  }
  return codeText ?? coding?.[0]?.display ?? 'Unknown'
}

const COMMENT_NOTE_CODE = '37331000000100'

export function extractCodedData(bundle: fhir3.Bundle): GpConnectCodedDataItem[] {
  // Always exclude observations that belong to a DiagnosticReport result set.
  // Also traverse has-member links transitively: GP Connect bundles list only the
  // group-header in DiagnosticReport.result; the individual child results are only
  // reachable via related[type=has-member] on that header.
  const allObsById = new Map<string, ObsLike>()
  getEntries<ObsLike>(bundle, 'Observation').forEach(obs => { if (obs.id) allObsById.set(obs.id, obs) })

  const investigationObsIds = new Set<string>()
  getEntries<fhir3.DiagnosticReport>(bundle, 'DiagnosticReport').forEach(report => {
    ;(report.result ?? []).forEach(ref => {
      const id = (ref as fhir3.Reference).reference?.split('/').pop()
      if (id) investigationObsIds.add(id)
    })
  })

  const queue = [...investigationObsIds]
  while (queue.length) {
    const id = queue.shift()!
    const obs = allObsById.get(id)
    if (!obs) continue
    type Related = { type?: string; target?: { reference?: string } }
    const related = (obs as unknown as { related?: Related[] }).related ?? []
    for (const r of related) {
      // Some vendor bundles (e.g. Orange Labs) omit related.type entirely on
      // group-header -> analyte links; an untyped relation between
      // Observations here is a has-member link in practice.
      if (r.type === 'has-member' || r.type === undefined) {
        const childId = r.target?.reference?.split('/').pop()
        if (childId && !investigationObsIds.has(childId)) {
          investigationObsIds.add(childId)
          queue.push(childId)
        }
      }
    }
  }

  const notAnInvestigation = (obs: ObsLike) => !investigationObsIds.has(obs.id ?? '')

  // Show every coded Observation that isn't an investigation result and isn't
  // a free-text comment note (37331000000100) — including ones nested inside
  // consultation topic/category lists (24781000000107), which also surface
  // there but should still appear here as flat coded entries.
  const observations = getEntries<ObsLike>(bundle, 'Observation')
    .filter(notAnInvestigation)
    .filter(obs => !obs.code?.coding?.some(c => c.code === COMMENT_NOTE_CODE))

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

      const performers = (Array.isArray(obs.performer) ? obs.performer : obs.performer ? [obs.performer] : []) as Array<{ reference?: string; display?: string }>
      let performer: string | undefined
      let performerId: string | undefined
      let organisation: string | undefined
      let organisationId: string | undefined
      for (const p of performers) {
        const ref = p.reference
        if (ref?.startsWith('Organization/') || ref?.startsWith('Organisation/')) {
          const resolved = resolveReference(bundle, ref) as fhir3.Organization | undefined
          organisation = resolved?.name ?? p.display
          organisationId = extractId(ref)
        } else if (ref) {
          const { name, id } = resolvePractitionerRef(bundle, ref)
          performer = name ?? p.display
          performerId = id
        } else if (p.display && !performer) {
          performer = p.display
        }
      }
      const contextRef = (obs as unknown as { context?: { reference?: string } }).context?.reference
      const encounterId = extractId(contextRef)

      const effectiveDateTime = cast.effectiveDateTime
      const isIssuedDate = !effectiveDateTime && !!obs.issued
      const category = (obs.category as fhir3.CodeableConcept[] | undefined)?.[0]?.coding?.[0]?.display
        ?? (obs.category as fhir3.CodeableConcept[] | undefined)?.[0]?.text

      const isTransferDegraded = coding?.some(c => c.code === TRANSFER_DEGRADED_CODE)
        ? (!!obs.code?.text || !!(obs.comment?.match(/^Original text:\s*([^\n\r]+)/im)))
        : false

      return {
        id: obs.id ?? crypto.randomUUID(),
        date: formatDate(effectiveDateTime ?? obs.issued),
        isIssuedDate,
        category,
        snomedCode: extractSnomedCode(coding),
        description: extractObsDescription(obs),
        isTransferDegraded: isTransferDegraded || undefined,
        value,
        unit: vq?.unit,
        comment: obs.comment || undefined,
        interpretation: interpretation || undefined,
        performer: performer || undefined,
        performerId: performerId || undefined,
        organisation: organisation || undefined,
        organisationId: organisationId || undefined,
        encounterId: encounterId || undefined,
        components,
      }
    })
}
