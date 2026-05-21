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
  { label: 'Date', render: item => item.date ?? '—' },
  { label: 'Recipient service', render: item => item.recipient ?? '—' },
  {
    label: 'Priority',
    render: item => item.priority
      ? <StatusBadge value={item.priority} />
      : <span className="text-nhs-grey-3">—</span>,
  },
  { label: 'Reason', render: item => item.reason ?? '—' },
  { label: 'Status', render: item => <StatusBadge value={item.status} /> },
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

function ReferralDetail({ referral }: { referral: GpConnectReferral }) {
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">
          {referral.recipient ?? 'Referral'}
        </h3>
        <div className="flex gap-2">
          {referral.priority && <StatusBadge value={referral.priority} />}
          <StatusBadge value={referral.status} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        <DetailRow label="Date"              value={referral.date} />
        <DetailRow label="Recipient service" value={referral.recipient} />
        {referral.priority && (
          <DetailRow label="Priority" value={<StatusBadge value={referral.priority} />} />
        )}
        <DetailRow label="Status" value={<StatusBadge value={referral.status} />} />
        {referral.reason && (
          <div className="col-span-2 flex gap-2 min-w-0">
            <span className="text-xs text-nhs-grey-3 shrink-0 w-36">Reason</span>
            <span className="text-xs text-nhs-grey-1 min-w-0">{referral.reason}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ReferralsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.referrals.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Referrals</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
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
        expandedContent={referral => <ReferralDetail referral={referral} />}
      />
    </div>
  )
}
