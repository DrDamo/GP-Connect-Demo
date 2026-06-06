// ---------------------------------------------------------------------------
// generate/index.ts — assembles all domain generators into a single Bundle
// ---------------------------------------------------------------------------

import type { DraftRecord } from '../types'
import { TempIdMap } from '../idMap'
import { generateAdmin } from './admin'
import { generateMedications } from './medications'
import { generateAllergies } from './allergies'
import { generateProblems } from './problems'
import { generateConsultations } from './consultations'
import { generateImmunisations } from './immunisations'
import { generateInvestigations } from './investigations'
import { generateReferrals } from './referrals'
import { generateDiaryEntries } from './diaryEntries'
import { generateCodedData } from './codedData'
import { generateDocuments } from './documents'
import { generateDomainLists } from './lists'
import type { DomainEntries } from './lists'

export function buildBundle(draft: DraftRecord): fhir3.Bundle {
  const idMap = new TempIdMap(draft)
  const patientRef = idMap.ref(draft.patient._tempId, 'Patient')

  // Allergies returns { activeEntries, endedListEntry } — handled separately
  const allergyResult = generateAllergies(draft, idMap, patientRef)

  // Build the reference lists for the 10 primary domain Lists
  const domainEntries: DomainEntries = {
    medicationStatementRefs: draft.medications.map(m => idMap.ref(m._tempId, 'MedicationStatement')),
    activeAllergyRefs: draft.allergies
      .filter(a => a.status !== 'resolved')
      .map(a => idMap.ref(a._tempId, 'AllergyIntolerance')),
    problemRefs: draft.problems.map(p => idMap.ref(p._tempId, 'Condition')),
    encounterRefs: draft.consultations.map(c => idMap.ref(c._tempId, 'Encounter')),
    immunisationRefs: draft.immunisations.map(i => idMap.ref(i._tempId, 'Immunization')),
    diagnosticReportRefs: draft.investigations.map(i => idMap.ref(i._tempId, 'DiagnosticReport')),
    referralRefs: draft.referrals.map(r => idMap.ref(r._tempId, 'ReferralRequest')),
    diaryEntryRefs: draft.diaryEntries.map(d => idMap.ref(d._tempId, 'ProcedureRequest')),
    codedDataRefs: draft.codedData.map(c => idMap.ref(c._tempId, 'Observation')),
    documentRefs: draft.documents.map(d => idMap.ref(d._tempId, 'DocumentReference')),
  }

  const entries: fhir3.BundleEntry[] = [
    ...generateAdmin(draft, idMap),
    ...generateMedications(draft, idMap, patientRef),
    ...allergyResult.activeEntries,
    ...generateProblems(draft, idMap, patientRef),
    ...generateConsultations(draft, idMap, patientRef),
    ...generateImmunisations(draft, idMap, patientRef),
    ...generateInvestigations(draft, idMap, patientRef),
    ...generateReferrals(draft, idMap, patientRef),
    ...generateDiaryEntries(draft, idMap, patientRef),
    ...generateCodedData(draft, idMap, patientRef),
    ...generateDocuments(draft, idMap, patientRef),
    ...(allergyResult.endedListEntry ? [allergyResult.endedListEntry] : []),
    ...generateDomainLists(patientRef, domainEntries),
  ]

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries,
  }
}
