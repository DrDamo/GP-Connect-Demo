import type { GpConnectBundle, GpConnectAllergy } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectAllergy>[] = [
  {
    label: 'Causative agent',
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">{item.causativeAgent}</div>
        {item.snomedCode && (
          <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{item.snomedCode}</div>
        )}
      </div>
    ),
  },
  {
    label: 'Reaction',
    render: item => item.reaction ?? '—',
  },
  {
    label: 'Criticality',
    render: item => item.criticality ? <StatusBadge value={item.criticality} /> : <span className="text-nhs-grey-3">—</span>,
  },
  {
    label: 'Category',
    render: item => item.category
      ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
      : '—',
  },
  {
    label: 'Date recorded',
    render: item => item.dateRecorded ?? '—',
  },
  {
    label: 'Status',
    render: item => <StatusBadge value={item.status} />,
  },
]

export function AllergiesView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.allergies.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Allergies &amp; Adverse Reactions</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}{onSelect ? ' · click a row to highlight FHIR source' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.allergies}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No allergy records found in this bundle"
      />
    </div>
  )
}
