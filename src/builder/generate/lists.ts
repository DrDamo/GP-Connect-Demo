import type { TempIdMap as _TempIdMap } from '../idMap'

const LIST_CODES: Record<string, { code: string; display: string }> = {
  medications:    { code: '933361000000108', display: 'Medications and medical devices' },
  allergies:      { code: '886921000000105', display: 'Allergies and adverse reactions' },
  problems:       { code: '717711000000103', display: 'Problems' },
  consultations:  { code: '1149501000000101', display: 'List of consultations' },
  immunisations:  { code: '1102181000000102', display: 'Immunisations' },
  investigations: { code: '887191000000108', display: 'Investigations and results' },
  referrals:      { code: '792931000000107', display: 'Outbound referral' },
  diaryEntries:   { code: '714311000000108', display: 'Patient recall administration' },
  codedData:      { code: '826501000000100', display: 'Miscellaneous record' },
  documents:      { code: '823701000000100', display: 'Documents' },
}

const EMPTY_REASON_SYSTEM = 'https://fhir.nhs.uk/STU3/CodeSystem/CareConnect-ListEmptyReasonCode-1'
const LIST_PROFILE = 'https://fhir.nhs.uk/STU3/StructureDefinition/CareConnect-GPC-List-1'

export interface DomainEntries {
  medicationStatementRefs: string[]
  activeAllergyRefs: string[]
  problemRefs: string[]
  encounterRefs: string[]
  immunisationRefs: string[]
  diagnosticReportRefs: string[]
  referralRefs: string[]
  diaryEntryRefs: string[]
  codedDataRefs: string[]
  documentRefs: string[]
}

function makeDomainList(
  domain: string,
  patientRef: string,
  refs: string[],
  today: string,
): fhir3.BundleEntry {
  const listId = crypto.randomUUID()
  const { code, display } = LIST_CODES[domain]

  const list: fhir3.List = {
    resourceType: 'List',
    id: listId,
    meta: { profile: [LIST_PROFILE] },
    status: 'current',
    mode: 'snapshot',
    code: {
      coding: [{ system: 'http://snomed.info/sct', code, display }],
    },
    subject: { reference: patientRef },
    date: today,
    orderedBy: {
      coding: [{ system: 'http://hl7.org/fhir/list-order', code: 'event-date' }],
    },
    ...(refs.length > 0
      ? { entry: refs.map(ref => ({ item: { reference: ref } })) }
      : {
          emptyReason: {
            coding: [
              {
                system: EMPTY_REASON_SYSTEM,
                code: 'no-content-recorded',
                display: 'No content recorded',
              },
            ],
          },
        }),
  }

  return { fullUrl: `urn:uuid:${listId}`, resource: list }
}

export function generateDomainLists(
  patientRef: string,
  entries: DomainEntries,
): fhir3.BundleEntry[] {
  const today = new Date().toISOString()

  return [
    makeDomainList('medications', patientRef, entries.medicationStatementRefs, today),
    makeDomainList('allergies', patientRef, entries.activeAllergyRefs, today),
    makeDomainList('problems', patientRef, entries.problemRefs, today),
    makeDomainList('consultations', patientRef, entries.encounterRefs, today),
    makeDomainList('immunisations', patientRef, entries.immunisationRefs, today),
    makeDomainList('investigations', patientRef, entries.diagnosticReportRefs, today),
    makeDomainList('referrals', patientRef, entries.referralRefs, today),
    makeDomainList('diaryEntries', patientRef, entries.diaryEntryRefs, today),
    makeDomainList('codedData', patientRef, entries.codedDataRefs, today),
    makeDomainList('documents', patientRef, entries.documentRefs, today),
  ]
}
