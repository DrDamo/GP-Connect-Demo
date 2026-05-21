import { useState } from 'react'
import { DomainNav } from './DomainNav'
import { MedicationsView } from './MedicationsView'
import { AllergiesView } from './AllergiesView'
import { ProblemsView } from './ProblemsView'
import { ConsultationsView } from './ConsultationsView'
import { ImmunisationsView } from './ImmunisationsView'
import { InvestigationsView } from './InvestigationsView'
import { ReferralsView } from './ReferralsView'
import { DiaryEntriesView } from './DiaryEntriesView'
import { CodedDataView } from './CodedDataView'
import { DocumentsView } from './DocumentsView'
import { type DomainId } from './domains'
import type { GpConnectBundle } from '../../fhir/types'

interface Props {
  record: GpConnectBundle
}

export function ClinicalView({ record }: Props) {
  const [activeDomain, setActiveDomain] = useState<DomainId>('medications')
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const handleSelect = (id: string) => {
    setSelectedId(prev => (prev === id ? undefined : id))
  }

  const counts: Partial<Record<DomainId, number>> = {
    medications:    record.medications.length,
    allergies:      record.allergies.length,
    problems:       record.problems.length,
    consultations:  record.consultations.length,
    immunisations:  record.immunisations.length,
    investigations: record.investigations.length,
    referrals:      record.referrals.length,
    'diary-entries': record.diaryEntries.length,
    'coded-data':   record.codedData.length,
    documents:      record.documents.length,
  }

  const handleDomainSelect = (domain: DomainId) => {
    setActiveDomain(domain)
    setSelectedId(undefined)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <DomainNav active={activeDomain} onSelect={handleDomainSelect} counts={counts} />
      <div className="flex-1 overflow-auto p-4">
        {activeDomain === 'medications' && (
          <MedicationsView record={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'allergies' && (
          <AllergiesView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'problems' && (
          <ProblemsView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'consultations' && (
          <ConsultationsView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'immunisations' && (
          <ImmunisationsView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'investigations' && (
          <InvestigationsView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'referrals' && (
          <ReferralsView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'diary-entries' && (
          <DiaryEntriesView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'coded-data' && (
          <CodedDataView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
        {activeDomain === 'documents' && (
          <DocumentsView bundle={record} selectedId={selectedId} onSelect={handleSelect} />
        )}
      </div>
    </div>
  )
}
