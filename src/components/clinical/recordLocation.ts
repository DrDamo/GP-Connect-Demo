import type { GpConnectBundle, IncomingRef } from '../../fhir/types'
import type { DomainId } from './domains'

const SUPPORTING_TYPES = new Set(['Practitioner', 'Organization', 'Location', 'HealthcareService', 'Medication'])

const DIRECT_DOMAIN: Partial<Record<string, DomainId>> = {
  AllergyIntolerance: 'allergies',
  Condition:          'problems',
  Encounter:          'consultations',
  Immunization:       'immunisations',
  DiagnosticReport:   'investigations',
  ReferralRequest:    'referrals',
  DocumentReference:  'documents',
}

/** Where in the Clinical view a referencing resource lives, if anywhere.
 * Returns the domain plus the id that domain selects by (which for
 * medications is the MedicationStatement-level id, not the request's). */
export function findRecordLocation(ref: Pick<IncomingRef, 'sourceType' | 'sourceId'>, record: GpConnectBundle): { domain: DomainId; id: string } | undefined {
  const { sourceType: type, sourceId: id } = ref
  if (!id) return undefined
  if (SUPPORTING_TYPES.has(type)) return { domain: 'supporting-resources', id }
  const direct = DIRECT_DOMAIN[type]
  if (direct) return { domain: direct, id }
  switch (type) {
    case 'MedicationStatement':
    case 'MedicationRequest': {
      const matches = (r: string) => r === id || r.endsWith(`/${id}`)
      const med = record.medications.find(m =>
        m.medicationStatementId === id || m.medicationRequestIds.some(matches) || m.issues.some(i => i.id === id))
      return med ? { domain: 'medications', id: med.id } : undefined
    }
    case 'Observation':
      if (record.codedData.some(c => c.id === id)) return { domain: 'coded-data', id }
      if (record.immunisations.some(i => i.id === id)) return { domain: 'immunisations', id }
      return { domain: 'investigations', id }
    case 'ProcedureRequest':
      return record.diaryEntries.some(d => d.id === id) ? { domain: 'diary-entries', id } : undefined
    case 'List':
      return record.lists.some(l => l.id === id) ? { domain: 'lists', id } : undefined
  }
  return undefined
}
