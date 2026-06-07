import type { GpConnectInvestigation, GpConnectInvestigationResult, GpConnectTestGroup, GpConnectObservationComponent } from './types'
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

// SNOMED codes with special handling in DiagnosticReport.result[]
const GROUP_HEADER_CODE = '364712009'   // Laboratory test observable (TPP explicit group marker)
const COMMENT_NOTE_CODE = '37331000000100'  // Comment note / filing comment
const SKIP_CODE = '24641000000107'  // Investigation result placeholder — skip

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

// Parse structured values from TPP-style comment text (when no valueQuantity is present)
function parseCommentValue(comment: string): {
  value?: string; unit?: string; referenceRange?: string; interpretation?: string
} {
  const out: { value?: string; unit?: string; referenceRange?: string; interpretation?: string } = {}
  const valMatch = comment.match(/^Value:\s+([^\n\r]+)/m)
  if (valMatch) {
    const raw = valMatch[1].trim()
    const numMatch = raw.match(/^(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\s+(.+)$/)
    if (numMatch) {
      out.value = numMatch[1]
      out.unit = numMatch[2]
    } else {
      out.value = raw
    }
  }
  const rangeMatch = comment.match(/^Reference range:\s+([^\n\r]+)/m)
  if (rangeMatch) {
    out.referenceRange = rangeMatch[1].trim().replace(/\s*-\s*/, '–')
  }
  const interpMatch = comment.match(/^Interpretation Code:\s+([^\n\r]+)/m)
  if (interpMatch) {
    out.interpretation = interpMatch[1].trim()
  }
  return out
}

// Strip parsed/redundant lines from a result comment; return narrative-only text
function cleanResultComment(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw
    .replace(/^Value:[^\n]*/gm, '')
    .replace(/^Reference range:[^\n]*/gm, '')
    .replace(/^Interpretation Code:[^\n]*/gm, '')
    .replace(/^Original text:[^\n]*/gm, '')  // redundant: duplicates result name
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n')
  return cleaned || undefined
}

// Strip "Original text: {name}\n\n" prefix from TPP group header comments
function cleanGroupComment(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const stripped = raw
    .replace(/^Original text:[^\n]*\n\n?/, '')
    .replace(/\r/g, '')
    .trim()
  return stripped || undefined
}

// Resolve a better name for TPP's generic "Laboratory procedures" group header
const GENERIC_GROUP_NAMES = new Set(['Laboratory procedures', 'Laboratory test observable'])
function groupHeaderName(obs: ObsLike): string {
  const name = obs.code?.text ?? obs.code?.coding?.[0]?.display ?? ''
  if (GENERIC_GROUP_NAMES.has(name) && obs.comment) {
    const m = obs.comment.match(/^Original text:\s+([^\n\r]+)/m)
    if (m) return m[1].trim()
  }
  return name || 'Results'
}

function obsHasValue(obs: ObsLike): boolean {
  const cast = obs as unknown as { valueString?: string }
  return obs.valueQuantity?.value !== undefined || !!cast.valueString || !!obs.valueCodeableConcept
}

function extractObsResult(obs: ObsLike): Pick<GpConnectInvestigationResult,
  'value' | 'unit' | 'referenceRange' | 'interpretation' | 'comment' | 'components'> {
  const vq = obs.valueQuantity
  const cast = obs as unknown as { valueString?: string }
  let value: string | undefined = vq?.value !== undefined
    ? String(vq.value)
    : cast.valueString ?? obs.valueCodeableConcept?.text ?? obs.valueCodeableConcept?.coding?.[0]?.display
  let unit = vq?.unit
  let referenceRange = formatRange(obs.referenceRange?.[0])
  let interpretation = obs.interpretation?.coding?.[0]?.display ?? obs.interpretation?.text

  const rawComment = obs.comment || undefined
  if (!value && rawComment) {
    const parsed = parseCommentValue(rawComment)
    if (parsed.value) { value = parsed.value; unit = unit ?? parsed.unit }
    referenceRange = referenceRange ?? parsed.referenceRange
    interpretation = interpretation ?? parsed.interpretation
  }

  const comment = cleanResultComment(rawComment)

  const components: GpConnectObservationComponent[] | undefined = obs.component?.length
    ? obs.component.map(c => ({
        name: c.code?.text ?? c.code?.coding?.[0]?.display ?? 'Component',
        value: c.valueQuantity?.value !== undefined ? String(c.valueQuantity.value) : c.valueString,
        unit: c.valueQuantity?.unit,
        referenceRange: formatRange(c.referenceRange?.[0]),
        interpretation: c.interpretation?.coding?.[0]?.display ?? c.interpretation?.text,
      }))
    : undefined

  return { value, unit, referenceRange, interpretation, comment, components }
}

export function extractInvestigations(bundle: fhir3.Bundle): GpConnectInvestigation[] {
  return getEntries<fhir3.DiagnosticReport>(bundle, 'DiagnosticReport')
    .sort((a, b) => fhirDateKey(
      (b as unknown as { effectiveDateTime?: string }).effectiveDateTime ?? b.issued
    ).localeCompare(fhirDateKey(
      (a as unknown as { effectiveDateTime?: string }).effectiveDateTime ?? a.issued
    )))
    .map(report => {
      const castReport = report as unknown as Record<string, string>
      const reportId = report.id ?? crypto.randomUUID()

      const performerRef = (report.performer?.[0] as { actor?: fhir3.Reference } | undefined)?.actor?.reference
      const { name: performer, id: performerId } = resolvePractitionerRef(bundle, performerRef)
      const contextRef = (report as unknown as { context?: { reference?: string } }).context?.reference
      const encounterId = extractId(contextRef)

      // Resolve all result observations, preserving order
      const resultObs: ObsLike[] = []
      for (const ref of (report.result ?? []) as fhir3.Reference[]) {
        const obs = resolveReference(bundle, ref.reference) as ObsLike | undefined
        if (obs) resultObs.push(obs)
      }

      // Separate filing comment (37331000000100) from lab observations
      let filingComment: string | undefined
      let filingCommentDate: string | undefined
      let filingCommentPerformer: string | undefined
      const labObs: ObsLike[] = []

      for (const obs of resultObs) {
        if (obs.code?.coding?.[0]?.code === COMMENT_NOTE_CODE) {
          filingComment = obs.comment || undefined
          const castObs = obs as unknown as { effectiveDateTime?: string }
          filingCommentDate = formatDate(castObs.effectiveDateTime ?? obs.issued)
          const perfs = (Array.isArray(obs.performer) ? obs.performer : obs.performer ? [obs.performer] : []) as Array<{ display?: string }>
          filingCommentPerformer = perfs[0]?.display ?? undefined
        } else {
          labObs.push(obs)
        }
      }

      // Does this DR use explicit group headers (TPP: code 364712009)?
      const hasExplicitGroups = labObs.some(obs => obs.code?.coding?.[0]?.code === GROUP_HEADER_CODE)

      // Build test groups.
      // Implicit group detection (EMIS): a no-value obs starts a new group only when:
      //   - it is the very first obs (no groups yet), OR
      //   - the previous non-skip obs had a value (new panel begins after numeric results).
      // This prevents qualitative results (no valueQuantity, comment = "NEGATIVE") from being
      // misidentified as panel headers when they follow another no-value obs.
      const testGroups: GpConnectTestGroup[] = []
      let currentGroup: GpConnectTestGroup | null = null
      let prevHadValue = false

      for (const obs of labObs) {
        const code = obs.code?.coding?.[0]?.code ?? ''
        if (code === SKIP_CODE) continue

        const hasValue = obsHasValue(obs)
        const isGroupHeader = hasExplicitGroups
          ? code === GROUP_HEADER_CODE
          : !hasValue && (testGroups.length === 0 || prevHadValue)

        if (isGroupHeader) {
          const obsCoding = obs.code?.coding
          const castObs = obs as unknown as { effectiveDateTime?: string }
          currentGroup = {
            id: obs.id ?? crypto.randomUUID(),
            name: groupHeaderName(obs),
            snomedCode: extractSnomedCode(obsCoding),
            comment: cleanGroupComment(obs.comment),
            date: formatDate(castObs.effectiveDateTime ?? obs.issued),
            results: [],
          }
          testGroups.push(currentGroup)
          prevHadValue = false
        } else {
          if (!currentGroup) {
            currentGroup = { id: `${reportId}-direct`, name: '', results: [] }
            testGroups.push(currentGroup)
          }
          const obsCoding = obs.code?.coding
          // In TPP explicit-group DRs, a no-value obs without a comment is a sub-panel label
          const isSubHeader = hasExplicitGroups && !hasValue && !obs.comment
          const result: GpConnectInvestigationResult = {
            id: obs.id ?? crypto.randomUUID(),
            reportId,
            name: obs.code?.text ?? extractSnomedDisplay(obsCoding) ?? obsCoding?.[0]?.display ?? 'Result',
            snomedCode: extractSnomedCode(obsCoding),
            isSubHeader,
            ...extractObsResult(obs),
          }
          currentGroup.results.push(result)
          prevHadValue = hasValue
        }
      }

      // Flat results list (for summary shortcuts + backward compat)
      const results = testGroups.flatMap(g => g.results).filter(r => !r.isSubHeader)

      // Report name: prefer filing comment Title → first group name → DR code
      let reportName: string | undefined
      if (filingComment) {
        const m = filingComment.match(/^Title:\s+([^\n\r]+)/m)
        if (m) reportName = m[1].trim()
      }
      if (!reportName && testGroups.length > 0 && testGroups[0].name) {
        reportName = testGroups[0].name
      }
      if (!reportName) {
        const coding = report.code?.coding
        const drName = report.code?.text ?? extractSnomedDisplay(coding) ?? coding?.[0]?.display
        if (drName && drName !== 'Diagnostic studies report') reportName = drName
      }
      reportName = reportName ?? 'Investigation'

      const category = (report.category as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
        ?? (report.category as fhir3.CodeableConcept | undefined)?.text

      const first = results[0]
      return {
        id: reportId,
        date: formatDate(report.issued ?? castReport.effectiveDateTime),
        name: reportName,
        status: report.status,
        category,
        performer,
        performerId,
        encounterId,
        filingComment,
        filingCommentDate,
        filingCommentPerformer,
        testGroups,
        results,
        result: first?.value,
        unit: first?.unit,
        referenceRange: first?.referenceRange,
        interpretation: first?.interpretation,
      }
    })
}
