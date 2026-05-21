import type { GpConnectBundle, GpConnectConsultation } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectConsultation>[] = [
  {
    label: 'Date',
    render: item => item.date ?? '—',
  },
  {
    label: 'Type',
    render: item => item.type ?? '—',
  },
  {
    label: 'Clinician',
    render: item => item.clinician ?? '—',
  },
  {
    label: 'Organisation',
    render: item => item.organisation ?? '—',
  },
]

export function ConsultationsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.consultations.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Consultations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}{onSelect ? ' · click a row to highlight FHIR source' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.consultations}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No consultation records found in this bundle"
      />
    </div>
  )
}
