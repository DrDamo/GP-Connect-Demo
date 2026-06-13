import type { GpConnectInvestigation, GpConnectInvestigationResult, GpConnectTestGroup, GpConnectObservationComponent, GpConnectSpecimen, GpConnectProcedureRequest } from './types'
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
const TRANSFER_DEGRADED_CODE = '196411000000103'  // Transfer-degraded record entry

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

// Resolve a better name for TPP's generic "Laboratory procedures" group header,
// and for transfer-degraded observations whose original text is in the comment.
const GENERIC_GROUP_NAMES = new Set(['Laboratory procedures', 'Laboratory test observable'])

function originalTextFromComment(obs: ObsLike): string | undefined {
  if (!obs.comment) return undefined
  const m = obs.comment.match(/^Original text:\s*([^\n\r]+)/im)
  return m ? m[1].trim() : undefined
}

function groupHeaderName(obs: ObsLike): string {
  const coding = obs.code?.coding
  const codeText = obs.code?.text
  const displayName = coding?.[0]?.display ?? ''
  const isGeneric = GENERIC_GROUP_NAMES.has(codeText ?? displayName)
  const isTransferDegraded = !codeText && coding?.some(c => c.code === TRANSFER_DEGRADED_CODE)
  if (isGeneric || isTransferDegraded) {
    const original = originalTextFromComment(obs)
    if (original) return original
  }
  return codeText ?? (displayName || 'Results')
}

function resolveObsName(obs: ObsLike, fallback: string): string {
  const coding = obs.code?.coding
  const codeText = obs.code?.text
  if (!codeText && coding?.some(c => c.code === TRANSFER_DEGRADED_CODE)) {
    const original = originalTextFromComment(obs)
    if (original) return original
  }
  return codeText ?? extractSnomedDisplay(coding) ?? coding?.[0]?.display ?? fallback
}

function isTransferDegradedObs(obs: ObsLike): boolean {
  if (!obs.code?.coding?.some(c => c.code === TRANSFER_DEGRADED_CODE)) return false
  return !!obs.code?.text || !!originalTextFromComment(obs)
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

      const performerActor = (report.performer?.[0] as { actor?: { reference?: string; display?: string } } | undefined)?.actor
      const performerActorRef = performerActor?.reference
      const performerActorDisplay = performerActor?.display
      let performer: string | undefined
      let performerId: string | undefined
      if (performerActorRef?.startsWith('Practitioner/')) {
        const resolved = resolvePractitionerRef(bundle, performerActorRef)
        performer = resolved.name || performerActorDisplay
        performerId = resolved.id
      } else if (performerActorRef) {
        const resolvedOrg = resolveReference(bundle, performerActorRef) as fhir3.Organization | undefined
        performer = resolvedOrg?.name || performerActorDisplay
      }

      // Resolve specimen from DiagnosticReport
      let specimen: GpConnectSpecimen | undefined
      const drSpecimenRefs = (report as unknown as { specimen?: Array<{ reference?: string }> }).specimen ?? []
      if (drSpecimenRefs.length > 0 && drSpecimenRefs[0].reference) {
        const spec = resolveReference(bundle, drSpecimenRefs[0].reference) as (fhir3.Resource & {
          type?: { text?: string; coding?: Array<{ display?: string; code?: string; system?: string }> }
          status?: string
          collection?: { collectedDateTime?: string }
          receivedTime?: string
        }) | undefined
        if (spec) {
          specimen = {
            id: spec.id ?? '',
            type: spec.type?.text ?? spec.type?.coding?.[0]?.display,
            typeCode: spec.type?.coding?.find(c => c.system === 'http://snomed.info/sct')?.code ?? spec.type?.coding?.[0]?.code,
            collectedDateTime: formatDate(spec.collection?.collectedDateTime),
            receivedTime: formatDate(spec.receivedTime),
            status: spec.status,
          }
        }
      }

      // Resolve ProcedureRequest from DiagnosticReport.basedOn
      let procedureRequest: GpConnectProcedureRequest | undefined
      const basedOnRefs = (report as unknown as { basedOn?: Array<{ reference?: string }> }).basedOn ?? []
      const prRef = basedOnRefs.find(r => r.reference?.includes('ProcedureRequest/'))?.reference
      if (prRef) {
        const pr = resolveReference(bundle, prRef) as (fhir3.Resource & {
          code?: fhir3.CodeableConcept
          status?: string
          intent?: string
          requester?: { agent?: { reference?: string; display?: string } }
          performer?: { reference?: string; display?: string }
          note?: Array<{ text?: string }>
        }) | undefined
        if (pr) {
          const prCoding = pr.code?.coding
          const reqAgentRef = pr.requester?.agent?.reference
          const reqAgentDisplay = pr.requester?.agent?.display
          let requester: string | undefined
          let requesterId: string | undefined
          if (reqAgentRef?.startsWith('Practitioner/')) {
            const resolved = resolvePractitionerRef(bundle, reqAgentRef)
            requester = resolved.name || reqAgentDisplay
            requesterId = resolved.id
          } else {
            requester = reqAgentDisplay
          }
          const perfRef = pr.performer?.reference
          const perfDisplay = pr.performer?.display
          let prPerformer: string | undefined
          let prPerformerId: string | undefined
          if (perfRef?.startsWith('Practitioner/')) {
            const resolved = resolvePractitionerRef(bundle, perfRef)
            prPerformer = resolved.name || perfDisplay
            prPerformerId = resolved.id
          } else if (perfRef) {
            const resolvedOrg = resolveReference(bundle, perfRef) as fhir3.Organization | undefined
            prPerformer = resolvedOrg?.name || perfDisplay
          } else {
            prPerformer = perfDisplay
          }
          procedureRequest = {
            id: pr.id ?? '',
            name: pr.code?.text ?? extractSnomedDisplay(prCoding) ?? prCoding?.[0]?.display,
            snomedCode: extractSnomedCode(prCoding),
            status: pr.status,
            intent: pr.intent,
            requester,
            requesterId,
            performer: prPerformer,
            performerId: prPerformerId,
            notes: pr.note?.map(n => n.text ?? '').filter(Boolean) as string[] | undefined,
          }
        }
      }

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

      // Build test groups.
      // Three modes: (1) has-member groups (new GP Connect style), (2) explicit TPP groups,
      // (3) implicit EMIS groups. Detection order: check for has-member first.
      const testGroups: GpConnectTestGroup[] = []

      const hasMemberPattern = labObs.some(obs =>
        ((obs as unknown as { related?: Array<{ type?: string }> }).related ?? [])
          .some(r => r.type === 'has-member')
      )

      if (hasMemberPattern) {
        // New GP Connect style: each labObs that has has-member children is a Test Group container.
        // The actual results are only reachable via those has-member references.
        for (const obs of labObs) {
          const castRelated = obs as unknown as {
            related?: Array<{ type?: string; target?: { reference?: string } }>
            effectiveDateTime?: string
          }
          const memberRefs = (castRelated.related ?? [])
            .filter(r => r.type === 'has-member')
            .map(r => r.target?.reference)
            .filter((r): r is string => !!r)

          if (memberRefs.length > 0) {
            const obsCoding = obs.code?.coding
            const group: GpConnectTestGroup = {
              id: obs.id ?? crypto.randomUUID(),
              name: resolveObsName(obs, 'Results'),
              snomedCode: extractSnomedCode(obsCoding),
              comment: cleanGroupComment(obs.comment),
              date: formatDate(castRelated.effectiveDateTime ?? obs.issued),
              isTransferDegraded: isTransferDegradedObs(obs) || undefined,
              results: [],
            }
            for (const memberRef of memberRefs) {
              const memberObs = resolveReference(bundle, memberRef) as ObsLike | undefined
              if (!memberObs) continue
              const memberCoding = memberObs.code?.coding
              group.results.push({
                id: memberObs.id ?? crypto.randomUUID(),
                reportId,
                name: resolveObsName(memberObs, 'Result'),
                snomedCode: extractSnomedCode(memberCoding),
                isTransferDegraded: isTransferDegradedObs(memberObs) || undefined,
                ...extractObsResult(memberObs),
              })
            }
            testGroups.push(group)
          } else {
            // Direct result without group container
            let directGroup = testGroups.find(g => g.id === `${reportId}-direct`)
            if (!directGroup) {
              directGroup = { id: `${reportId}-direct`, name: '', results: [] }
              testGroups.push(directGroup)
            }
            const obsCoding = obs.code?.coding
            directGroup.results.push({
              id: obs.id ?? crypto.randomUUID(),
              reportId,
              name: resolveObsName(obs, 'Result'),
              snomedCode: extractSnomedCode(obsCoding),
              isTransferDegraded: isTransferDegradedObs(obs) || undefined,
              ...extractObsResult(obs),
            })
          }
        }
      } else {
        // Existing logic: explicit TPP groups (code 364712009) or implicit EMIS groups.
        const hasExplicitGroups = labObs.some(obs => obs.code?.coding?.[0]?.code === GROUP_HEADER_CODE)

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
              isTransferDegraded: isTransferDegradedObs(obs) || undefined,
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
            const isSubHeader = hasExplicitGroups && !hasValue && !obs.comment
            const result: GpConnectInvestigationResult = {
              id: obs.id ?? crypto.randomUUID(),
              reportId,
              name: resolveObsName(obs, 'Result'),
              snomedCode: extractSnomedCode(obsCoding),
              isSubHeader,
              isTransferDegraded: isTransferDegradedObs(obs) || undefined,
              ...extractObsResult(obs),
            }
            currentGroup.results.push(result)
            prevHadValue = hasValue
          }
        }
      }

      // Flat results list (for summary shortcuts + backward compat)
      const results = testGroups.flatMap(g => g.results).filter(r => !r.isSubHeader)

      // Report name derivation — priority order:
      // 1. Filing comment title  2. DR code when specific (not the generic category code)
      // 3. First group name  4. Single result name (last resort)
      let reportName: string | undefined
      if (filingComment) {
        const m = filingComment.match(/^Title:\s+([^\n\r]+)/m)
        if (m) reportName = m[1].trim()
      }
      if (!reportName) {
        const coding = report.code?.coding
        const drName = report.code?.text ?? extractSnomedDisplay(coding) ?? coding?.[0]?.display
        // 721981007 "Diagnostic studies report" is the generic category code used for ALL
        // TPP/EMIS lab DiagnosticReports — skip it and derive the name from the test group.
        if (drName && drName.toLowerCase() !== 'diagnostic studies report') {
          reportName = drName
        }
      }
      if (!reportName && testGroups.length > 0 && testGroups[0].name) {
        reportName = testGroups[0].name
      }
      if (!reportName && results.length > 0 && testGroups.length === 1 && !testGroups[0].name) {
        reportName = results[0].name
      }
      reportName = reportName ?? 'Investigation'

      const category = (report.category as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
        ?? (report.category as fhir3.CodeableConcept | undefined)?.text

      // Only surface result shortcuts in the table for single-result tests (no named panel groups)
      const isPanel = testGroups.some(g => g.name)
      const first = isPanel ? undefined : results[0]
      return {
        id: reportId,
        date: formatDate(report.issued ?? castReport.effectiveDateTime),
        name: reportName,
        status: report.status,
        category,
        performer,
        performerId,
        encounterId,
        specimen,
        procedureRequest,
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
