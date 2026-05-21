import type { GpConnectBundle, GpConnectReferral } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectReferral>[] = [
  {
    label: 'Date',
    render: item => item.date ?? '—',
  },
  {
    label: 'Recipient service',
    render: item => item.recipient ?? '—',
  },
  {
    label: 'Priority',
    render: item => item.priority
      ? <StatusBadge value={item.priority} />
      : <span className="text-nhs-grey-3">—</span>,
  },
  {
    label: 'Reason',
    render: item => item.reason ?? '—',
  },
  {
    label: 'Status',
    render: item => <StatusBadge value={item.status} />,
  },
]

export function ReferralsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.referrals.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Referrals</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}{onSelect ? ' · click a row to highlight FHIR source' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.referrals}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No referral records found in this bundle"
      />
    </div>
  )
}
