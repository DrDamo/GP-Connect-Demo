import type { GpConnectBundle, GpConnectImmunisation } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectImmunisation>[] = [
  {
    label: 'Vaccine',
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">{item.vaccine}</div>
        {item.snomedCode && (
          <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{item.snomedCode}</div>
        )}
      </div>
    ),
  },
  { label: 'Date given', render: item => item.dateGiven ?? '—' },
  { label: 'Status',     render: item => <StatusBadge value={item.status} /> },
  { label: 'Site',       render: item => item.site ?? '—' },
  {
    label: 'Batch no.',
    render: item => item.batchNumber
      ? <span className="font-mono text-xs">{item.batchNumber}</span>
      : <span>—</span>,
  },
  { label: 'Performer', render: item => item.performer ?? '—' },
]

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex gap-2 min-w-0">
      <span className="text-xs text-nhs-grey-3 shrink-0 w-36">{label}</span>
      <span className="text-xs text-nhs-grey-1 min-w-0">{value}</span>
    </div>
  )
}

function ImmunisationDetail({ immunisation }: { immunisation: GpConnectImmunisation }) {
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{immunisation.vaccine}</h3>
        <StatusBadge value={immunisation.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {immunisation.snomedCode && (
          <DetailRow label="SNOMED code" value={<span className="font-mono">{immunisation.snomedCode}</span>} />
        )}
        <DetailRow label="Date given"   value={immunisation.dateGiven} />
        <DetailRow label="Site"         value={immunisation.site} />
        {immunisation.batchNumber && (
          <DetailRow label="Batch number" value={<span className="font-mono">{immunisation.batchNumber}</span>} />
        )}
        <DetailRow label="Performer"    value={immunisation.performer} />
      </div>
    </div>
  )
}

export function ImmunisationsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.immunisations.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Immunisations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.immunisations}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No immunisation records found in this bundle"
        expandedContent={immunisation => <ImmunisationDetail immunisation={immunisation} />}
      />
    </div>
  )
}
