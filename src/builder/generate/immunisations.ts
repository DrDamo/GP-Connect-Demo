import type { DraftRecord } from '../types'
import type { TempIdMap } from '../idMap'

const VACCINATION_PROCEDURE_EXT = 'https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-VaccinationProcedure-1'

export function generateImmunisations(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
): fhir3.BundleEntry[] {
  return draft.immunisations.map(imm => {
    const { id, fullUrl } = map.entry(imm._tempId)

    const practitioners: fhir3.ImmunizationPractitioner[] = []
    if (imm.administeringPractitionerTempId) {
      practitioners.push({
        role: { coding: [{ system: 'http://hl7.org/fhir/v3/ParticipationType', code: 'AP' }] },
        actor: { reference: map.ref(imm.administeringPractitionerTempId, 'Practitioner') },
      })
    }
    if (imm.enteringPractitionerTempId) {
      practitioners.push({
        role: { coding: [{ code: 'EP' }] },
        actor: { reference: map.ref(imm.enteringPractitionerTempId, 'Practitioner') },
      })
    }

    const extensions: fhir3.Extension[] = []
    if (imm.vaccinationProcedureCode) {
      extensions.push({
        url: VACCINATION_PROCEDURE_EXT,
        valueCodeableConcept: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: imm.vaccinationProcedureCode,
              ...(imm.vaccinationProcedureDisplay ? { display: imm.vaccinationProcedureDisplay } : {}),
            },
          ],
        },
      })
    }

    const resource: fhir3.Immunization = {
      resourceType: 'Immunization',
      id,
      status: imm.status ?? 'completed',
      notGiven: imm.notGiven ?? false,
      vaccineCode: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            ...(imm.snomedCode ? { code: imm.snomedCode } : {}),
            ...(imm.vaccineName ? { display: imm.vaccineName } : {}),
          },
        ],
        ...(imm.vaccineName ? { text: imm.vaccineName } : {}),
      },
      patient: { reference: patientRef },
      ...(imm.dateGiven ? { date: imm.dateGiven } : {}),
      primarySource: true,
      ...(imm.batchNumber ? { lotNumber: imm.batchNumber } : {}),
      ...(imm.expirationDate ? { expirationDate: imm.expirationDate } : {}),
      ...(imm.site
        ? { site: { coding: [{ display: imm.site }], text: imm.site } }
        : {}),
      ...(imm.route
        ? { route: { coding: [{ display: imm.route }], text: imm.route } }
        : {}),
      ...(practitioners.length > 0 ? { practitioner: practitioners } : {}),
      ...(imm.locationTempId
        ? { location: { reference: map.ref(imm.locationTempId, 'Location') } }
        : {}),
      ...((imm.notes ?? []).length > 0
        ? { note: imm.notes!.map(n => ({ text: n })) }
        : {}),
      ...(extensions.length > 0 ? { extension: extensions } : {}),
    }

    return { fullUrl, resource }
  })
}
