import type { DraftRecord, DraftInvestigation, DraftInvestigationResult, DraftTestGroup } from '../types'
import type { TempIdMap } from '../idMap'
import { excludeConfidential, nopatMeta } from './security'

// ---------------------------------------------------------------------------
// GP Connect Investigations model — Test Report (DiagnosticReport) contains
// one or more Test Groups (Observation, linked via `related` has-member to
// their child Test Results), plus an optional linked Specimen and Test
// Request (ProcedureRequest), and an optional report-level filing comment
// (a Comment Note Observation, SNOMED 37331000000100). Comments at group and
// result level ride inline on those Observations (the same non-standard
// `.comment` convention already used elsewhere in this generator).
// https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Investigations-guidance
// ---------------------------------------------------------------------------

const SNOMED = 'http://snomed.info/sct'
const COMMENT_NOTE_CODE = '37331000000100'

function makeResultObservation(
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

function makeGroupObservation(
  group: DraftTestGroup,
  memberRefs: string[],
  map: TempIdMap,
  patientRef: string,
  issuedDate: string,
  notForPfs: boolean | undefined,
): { entry: fhir3.BundleEntry; ref: string } {
  const { id, fullUrl } = map.entry(group._tempId)

  const resource: fhir3.Observation & { comment?: string } = {
    resourceType: 'Observation',
    id,
    ...nopatMeta(notForPfs),
    status: 'final',
    code: {
      coding: [
        {
          system: SNOMED,
          ...(group.snomedCode ? { code: group.snomedCode } : {}),
          ...(group.name ? { display: group.name } : {}),
        },
      ],
      ...(group.name ? { text: group.name } : {}),
    },
    subject: { reference: patientRef },
    effectiveDateTime: issuedDate,
    ...(group.comment ? { comment: group.comment } : {}),
    ...(memberRefs.length > 0
      ? { related: memberRefs.map(ref => ({ type: 'has-member', target: { reference: ref } })) }
      : {}),
  }

  return { entry: { fullUrl, resource }, ref: `Observation/${id}` }
}

// Report-level "filing comment" — a Comment Note Observation with no
// has-member/derived-from link, referenced directly in DiagnosticReport.result[].
function makeFilingCommentObservation(
  inv: DraftInvestigation,
  map: TempIdMap,
  patientRef: string,
  issuedDate: string,
): { entry: fhir3.BundleEntry; ref: string } {
  const { id, fullUrl } = map.entry(`${inv._tempId}::comment`)

  const resource: fhir3.Observation & { comment?: string } = {
    resourceType: 'Observation',
    id,
    ...nopatMeta(inv.notForPfs),
    status: 'final',
    code: {
      coding: [{ system: SNOMED, code: COMMENT_NOTE_CODE, display: 'Comment note' }],
    },
    subject: { reference: patientRef },
    effectiveDateTime: issuedDate,
    comment: inv.comment,
  }

  return { entry: { fullUrl, resource }, ref: `Observation/${id}` }
}

function makeSpecimen(
  inv: DraftInvestigation,
  map: TempIdMap,
  patientRef: string,
): { entry: fhir3.BundleEntry; ref: string } | undefined {
  const hasSpecimen = inv.specimenType || inv.specimenSnomedCode || inv.specimenCollectedDate
    || inv.specimenReceivedDate || inv.specimenStatus || inv.specimenNote
  if (!hasSpecimen) return undefined

  const { id, fullUrl } = map.entry(`${inv._tempId}::specimen`)

  const resource: fhir3.Specimen = {
    resourceType: 'Specimen',
    id,
    subject: { reference: patientRef },
    ...(inv.specimenType || inv.specimenSnomedCode
      ? {
          type: {
            coding: [
              {
                system: SNOMED,
                ...(inv.specimenSnomedCode ? { code: inv.specimenSnomedCode } : {}),
                ...(inv.specimenType ? { display: inv.specimenType } : {}),
              },
            ],
            ...(inv.specimenType ? { text: inv.specimenType } : {}),
          },
        }
      : {}),
    ...(inv.specimenStatus ? { status: inv.specimenStatus } : {}),
    ...(inv.specimenCollectedDate ? { collection: { collectedDateTime: inv.specimenCollectedDate } } : {}),
    ...(inv.specimenReceivedDate ? { receivedTime: inv.specimenReceivedDate } : {}),
    ...(inv.specimenNote ? { note: [{ text: inv.specimenNote }] } : {}),
  }

  return { entry: { fullUrl, resource }, ref: `Specimen/${id}` }
}

function makeTestRequest(
  inv: DraftInvestigation,
  map: TempIdMap,
  patientRef: string,
): { entry: fhir3.BundleEntry; ref: string } | undefined {
  if (!inv.testRequestName && !inv.testRequestSnomedCode) return undefined

  const { id, fullUrl } = map.entry(`${inv._tempId}::testrequest`)

  const resource: fhir3.ProcedureRequest = {
    resourceType: 'ProcedureRequest',
    id,
    status: (inv.testRequestStatus as fhir3.ProcedureRequest['status']) ?? 'active',
    intent: (inv.testRequestIntent as fhir3.ProcedureRequest['intent']) ?? 'order',
    subject: { reference: patientRef },
    code: {
      coding: [
        {
          system: SNOMED,
          ...(inv.testRequestSnomedCode ? { code: inv.testRequestSnomedCode } : {}),
          ...(inv.testRequestName ? { display: inv.testRequestName } : {}),
        },
      ],
      ...(inv.testRequestName ? { text: inv.testRequestName } : {}),
    },
    ...(inv.testRequestRequesterTempId
      ? { requester: { agent: { reference: map.ref(inv.testRequestRequesterTempId, 'Practitioner') } } }
      : {}),
  }

  return { entry: { fullUrl, resource }, ref: `ProcedureRequest/${id}` }
}

export function generateInvestigations(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
): fhir3.BundleEntry[] {
  const entries: fhir3.BundleEntry[] = []

  for (const inv of excludeConfidential(draft.investigations)) {
    const { id, fullUrl } = map.entry(inv._tempId)
    const issuedDate = inv.date ? new Date(inv.date).toISOString() : new Date().toISOString()

    // DiagnosticReport.result[] holds a reference per Test Group (not the
    // individual results — those are only reachable via each group's
    // has-member links), plus the report-level filing comment if present.
    const resultRefs: string[] = []

    for (const group of inv.testGroups) {
      const groupResults = group.results.map(r => makeResultObservation(r, map, patientRef, inv.notForPfs))
      for (const { entry } of groupResults) entries.push(entry)

      const { entry: groupEntry, ref: groupRef } = makeGroupObservation(
        group, groupResults.map(r => r.ref), map, patientRef, issuedDate, inv.notForPfs,
      )
      entries.push(groupEntry)
      resultRefs.push(groupRef)
    }

    if (inv.comment) {
      const { entry, ref } = makeFilingCommentObservation(inv, map, patientRef, issuedDate)
      entries.push(entry)
      resultRefs.push(ref)
    }

    const specimen = makeSpecimen(inv, map, patientRef)
    if (specimen) entries.push(specimen.entry)

    const testRequest = makeTestRequest(inv, map, patientRef)
    if (testRequest) entries.push(testRequest.entry)

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
      ...(resultRefs.length > 0 ? { result: resultRefs.map(ref => ({ reference: ref })) } : {}),
      ...(specimen ? { specimen: [{ reference: specimen.ref }] } : {}),
      ...(testRequest ? { basedOn: [{ reference: testRequest.ref }] } : {}),
    }

    entries.push({ fullUrl, resource: report })
  }

  return entries
}
