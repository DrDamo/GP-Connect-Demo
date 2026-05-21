import type { GpConnectBundle, GpConnectCodedDataItem } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectCodedDataItem>[] = [
  {
    label: 'Date',
    render: item => item.date ?? '—',
  },
  {
    label: 'SNOMED code',
    render: item => item.snomedCode
      ? <span className="font-mono text-xs text-nhs-grey-2">{item.snomedCode}</span>
      : <span className="text-nhs-grey-3">—</span>,
  },
  {
    label: 'Description',
    render: item => (
      <div className="font-medium text-nhs-grey-1">{item.description}</div>
    ),
  },
  {
    label: 'Value',
    render: item => {
      const parts = [item.value, item.unit].filter(Boolean)
      return parts.length > 0 ? parts.join(' ') : '—'
    },
  },
]

export function CodedDataView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.codedData.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Coded Data</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}{onSelect ? ' · click a row to highlight FHIR source' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.codedData}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No coded data records found in this bundle"
      />
    </div>
  )
}
