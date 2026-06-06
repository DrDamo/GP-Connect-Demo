import { useState, useEffect, useRef } from 'react'
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
import { SupportingResourcesView } from './SupportingResourcesView'
import { ListsView } from './ListsView'
import { type DomainId, DOMAIN_MAP } from './domains'
import type { GpConnectBundle } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'

interface Props {
  record: GpConnectBundle
  onJumpToSource?: (id: string) => void
  onOpenTraining?: (domain: DomainId) => void
}

export function ClinicalView({ record, onJumpToSource, onOpenTraining }: Props) {
  const [activeDomain, setActiveDomain] = useState<DomainId>('medications')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const jumpTargetIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const jumpId = jumpTargetIdRef.current
    if (jumpId) {
      jumpTargetIdRef.current = undefined
      setSelectedId(jumpId)
    }
  }, [activeDomain])

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
    'supporting-resources': record.practitioners.length + record.organisations.length + record.healthcareServices.length + record.locations.length + record.fhirMedications.length,
    'lists': record.lists.length,
  }

  const handleDomainSelect = (domain: DomainId) => {
    setActiveDomain(domain)
    setSelectedId(undefined)
  }

  const handleJumpToRecord = (domain: DomainId, id: string) => {
    jumpTargetIdRef.current = id
    setActiveDomain(domain)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <DomainNav active={activeDomain} onSelect={handleDomainSelect} counts={counts} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-nhs-grey-4 p-4 pb-3">
          <PatientBanner patient={record.patient} practiceOrganisation={record.practiceOrganisation} patientId={record.patient?.id} onJumpToSource={onJumpToSource} />
        </div>
        <div className="flex-1 overflow-auto p-4">
        {onOpenTraining && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => onOpenTraining(activeDomain)}
              className="text-xs text-nhs-blue hover:underline flex items-center gap-1"
              title={`Training guide: ${DOMAIN_MAP[activeDomain].label}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Training guide
            </button>
          </div>
        )}
        {activeDomain === 'medications' && (
          <MedicationsView record={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'allergies' && (
          <AllergiesView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'problems' && (
          <ProblemsView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'consultations' && (
          <ConsultationsView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'immunisations' && (
          <ImmunisationsView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'investigations' && (
          <InvestigationsView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'referrals' && (
          <ReferralsView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'diary-entries' && (
          <DiaryEntriesView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'coded-data' && (
          <CodedDataView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'documents' && (
          <DocumentsView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        {activeDomain === 'supporting-resources' && (
          <SupportingResourcesView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} />
        )}
        {activeDomain === 'lists' && (
          <ListsView bundle={record} selectedId={selectedId} onSelect={handleSelect} onJumpToSource={onJumpToSource} onJumpToRecord={handleJumpToRecord} />
        )}
        </div>
      </div>
    </div>
  )
}
