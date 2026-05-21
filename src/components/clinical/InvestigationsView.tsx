import type { GpConnectBundle, GpConnectInvestigation } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectInvestigation>[] = [
  {
    label: 'Date',
    render: item => item.date ?? '—',
  },
  {
    label: 'Investigation',
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">{item.name}</div>
        {item.snomedCode && (
          <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{item.snomedCode}</div>
        )}
      </div>
    ),
  },
  {
    label: 'Result',
    render: item => {
      const parts = [item.result, item.unit].filter(Boolean)
      return parts.length > 0 ? parts.join(' ') : '—'
    },
  },
  {
    label: 'Reference range',
    render: item => item.referenceRange ?? '—',
  },
  {
    label: 'Interpretation',
    render: item => item.interpretation ?? '—',
  },
  {
    label: 'Performer',
    render: item => item.performer ?? '—',
  },
]

export function InvestigationsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.investigations.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Investigations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}{onSelect ? ' · click a row to highlight FHIR source' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.investigations}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No investigation records found in this bundle"
      />
    </div>
  )
}
