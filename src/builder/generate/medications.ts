import type { DraftRecord, DraftMedication, DraftMedicationIssue } from '../types'
import type { TempIdMap } from '../idMap'

const PRESCRIPTION_TYPE_URL = 'https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-GPC-PrescriptionType-1'
const PRESCRIPTION_TYPE_SYSTEM = 'https://fhir.nhs.uk/STU3/CodeSystem/CareConnect-PrescriptionType-1'
const REPEAT_INFO_URL = 'https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-GPC-MedicationRepeatInformation-1'
const LAST_ISSUE_DATE_URL = 'https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-GPC-MedicationStatementLastIssueDate-1'

const PRESCRIPTION_TYPE_MAP: Record<string, { code: string; display: string }> = {
  acute: { code: 'acute', display: 'Acute' },
  repeat: { code: 'repeat', display: 'Repeat' },
  'repeat-dispensing': { code: 'repeat-dispensing', display: 'Repeat dispensing' },
}

function prescriptionTypeExt(type?: string): fhir3.Extension {
  const mapping = type ? (PRESCRIPTION_TYPE_MAP[type] ?? { code: type, display: type }) : { code: 'acute', display: 'Acute' }
  return {
    url: PRESCRIPTION_TYPE_URL,
    valueCodeableConcept: {
      coding: [{ system: PRESCRIPTION_TYPE_SYSTEM, code: mapping.code, display: mapping.display }],
    },
  }
}

function buildDosage(draft: DraftMedication): fhir3.Dosage[] {
  const dosage: fhir3.Dosage = {
    ...(draft.dosageInstruction ? { text: draft.dosageInstruction } : {}),
    ...(draft.frequency
      ? { timing: { code: { text: draft.frequency } } }
      : {}),
    ...(draft.route
      ? { route: { coding: [{ display: draft.route }] } }
      : {}),
    ...(draft.patientInstructions ? { patientInstruction: draft.patientInstructions } : {}),
  }
  return [dosage]
}

function buildIssueDosage(issue: DraftMedicationIssue): fhir3.Dosage[] {
  const dosage: fhir3.Dosage = {
    ...(issue.dosageInstruction ? { text: issue.dosageInstruction } : {}),
    ...(issue.patientInstructions ? { patientInstruction: issue.patientInstructions } : {}),
  }
  return [dosage]
}

function makeMedication(draft: DraftMedication, map: TempIdMap): { entry: fhir3.BundleEntry; id: string } {
  const { id, fullUrl } = map.entry(draft._tempId + '_med')

  const resource: fhir3.Medication = {
    resourceType: 'Medication',
    id,
    ...(draft.snomedCode || draft.drugName
      ? {
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                ...(draft.snomedCode ? { code: draft.snomedCode } : {}),
                ...(draft.drugName ? { display: draft.drugName } : {}),
              },
            ],
            ...(draft.drugName ? { text: draft.drugName } : {}),
          },
        }
      : {}),
  }

  return { entry: { fullUrl, resource }, id }
}

function makeMedicationStatement(
  draft: DraftMedication,
  map: TempIdMap,
  patientRef: string,
  medId: string,
  planReqId: string,
): fhir3.BundleEntry {
  const { id, fullUrl } = map.entry(draft._tempId)

  const lastIssue = draft.issues?.length ? draft.issues[draft.issues.length - 1] : undefined
  const lastIssueDate = lastIssue?.issueDate

  const extensions: fhir3.Extension[] = [
    prescriptionTypeExt(draft.prescriptionType),
    ...(lastIssueDate
      ? [{ url: LAST_ISSUE_DATE_URL, valueDateTime: lastIssueDate }]
      : []),
  ]

  const resource: fhir3.MedicationStatement = {
    resourceType: 'MedicationStatement',
    id,
    extension: extensions,
    status: (draft.status as fhir3.MedicationStatement['status']) ?? 'active',
    taken: 'unk',
    medicationReference: { reference: `Medication/${medId}` },
    subject: { reference: patientRef },
    dateAsserted: new Date().toISOString(),
    basedOn: [{ reference: `MedicationRequest/${planReqId}` }],
    dosage: buildDosage(draft),
    ...(draft.startDate || draft.endDate
      ? {
          effectivePeriod: {
            ...(draft.startDate ? { start: draft.startDate } : {}),
            ...(draft.endDate ? { end: draft.endDate } : {}),
          },
        }
      : {}),
    ...(draft.pharmacyInstructions ? { note: [{ text: draft.pharmacyInstructions }] } : {}),
  }

  return { fullUrl, resource }
}

function makePlanRequest(
  draft: DraftMedication,
  map: TempIdMap,
  patientRef: string,
  medId: string,
): { entry: fhir3.BundleEntry; id: string } {
  const { id, fullUrl } = map.entry(draft._tempId + '_plan')

  const repeatInfoExt: fhir3.Extension = {
    url: REPEAT_INFO_URL,
    extension: [
      {
        url: 'numberOfRepeatPrescriptionsAllowed',
        valuePositiveInt: draft.numberOfRepeatsAllowed ?? 0,
      },
      {
        url: 'numberOfRepeatPrescriptionsIssued',
        valueUnsignedInt: draft.issues?.length ?? 0,
      },
    ],
  }

  const resource = {
    resourceType: 'MedicationRequest' as const,
    id,
    extension: [repeatInfoExt, prescriptionTypeExt(draft.prescriptionType)],
    status: (draft.status as fhir3.MedicationRequest['status']) ?? 'active',
    intent: 'plan' as const,
    medicationReference: { reference: `Medication/${medId}` },
    subject: { reference: patientRef },
    dosageInstruction: buildDosage(draft),
    ...(draft.prescriberTempId
      ? { requester: { agent: { reference: map.ref(draft.prescriberTempId, 'Practitioner') } } }
      : {}),
    ...(draft.recorderTempId
      ? { recorder: { reference: map.ref(draft.recorderTempId, 'Practitioner') } }
      : {}),
    dispenseRequest: {
      ...(draft.startDate || draft.endDate
        ? {
            validityPeriod: {
              ...(draft.startDate ? { start: draft.startDate } : {}),
              ...(draft.endDate ? { end: draft.endDate } : {}),
            },
          }
        : {}),
      ...(draft.prescribedQuantityValue !== undefined
        ? {
            quantity: {
              value: draft.prescribedQuantityValue,
              ...(draft.prescribedQuantityUnit ? { unit: draft.prescribedQuantityUnit } : {}),
            },
          }
        : {}),
      ...(draft.numberOfRepeatsAllowed !== undefined
        ? { numberOfRepeatsAllowed: draft.numberOfRepeatsAllowed }
        : {}),
    },
  } satisfies fhir3.MedicationRequest

  return { entry: { fullUrl, resource }, id }
}

function makeOrderRequest(
  issue: DraftMedicationIssue,
  draft: DraftMedication,
  map: TempIdMap,
  patientRef: string,
  medId: string,
  planReqId: string,
): fhir3.BundleEntry {
  const { id, fullUrl } = map.entry(issue._tempId)

  const dispenseRequest: fhir3.MedicationRequest['dispenseRequest'] = {
    ...(issue.startDate || issue.endDate
      ? {
          validityPeriod: {
            ...(issue.startDate ? { start: issue.startDate } : {}),
            ...(issue.endDate ? { end: issue.endDate } : {}),
          },
        }
      : {}),
    ...(issue.quantityValue !== undefined
      ? {
          quantity: {
            value: issue.quantityValue,
            ...(issue.quantityUnit ? { unit: issue.quantityUnit } : {}),
          },
        }
      : {}),
    ...(issue.supplyDurationValue !== undefined
      ? {
          expectedSupplyDuration: {
            value: issue.supplyDurationValue,
            unit: issue.supplyDurationUnit ?? 'days',
            system: 'http://unitsofmeasure.org',
            code: 'd',
          },
        }
      : {}),
  }

  // Silence unused variable warning for draft - it's used for context
  void draft

  const resource: fhir3.MedicationRequest = {
    resourceType: 'MedicationRequest',
    id,
    status: 'completed',
    intent: 'order',
    medicationReference: { reference: `Medication/${medId}` },
    subject: { reference: patientRef },
    basedOn: [{ reference: `MedicationRequest/${planReqId}` }],
    ...(issue.issueDate ? { authoredOn: issue.issueDate } : {}),
    ...(issue.recorderTempId
      ? { recorder: { reference: map.ref(issue.recorderTempId, 'Practitioner') } }
      : {}),
    dosageInstruction: buildIssueDosage(issue),
    ...(issue.pharmacyInstructions ? { note: [{ text: issue.pharmacyInstructions }] } : {}),
    dispenseRequest,
  }

  return { fullUrl, resource }
}

export function generateMedications(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
): fhir3.BundleEntry[] {
  const entries: fhir3.BundleEntry[] = []

  for (const med of draft.medications) {
    const { entry: medEntry, id: medId } = makeMedication(med, map)
    const { entry: planEntry, id: planReqId } = makePlanRequest(med, map, patientRef, medId)
    const stmtEntry = makeMedicationStatement(med, map, patientRef, medId, planReqId)

    entries.push(medEntry, planEntry, stmtEntry)

    for (const issue of med.issues ?? []) {
      entries.push(makeOrderRequest(issue, med, map, patientRef, medId, planReqId))
    }
  }

  return entries
}
