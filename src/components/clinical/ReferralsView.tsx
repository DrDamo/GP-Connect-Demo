import { useState } from 'react'
import type { GpConnectBundle, GpConnectReferral } from '../../fhir/types'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { SearchFilterBox } from './SearchFilterBox'

function referralSearchText(r: GpConnectReferral): string {
  return [
    r.date, r.reason, r.priority, r.recipient, r.status, r.requester, r.description,
    ...r.recipientRefs.map(x => x.name), ...r.supportingDocs.flatMap(d => [d.title, d.description, d.status]),
    ...r.notes,
  ].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const COLUMNS: DomainColumn<GpConnectReferral>[] = [
  { label: 'Date', render: item => item.date ?? 'Unknown' },
  { label: 'Reason', render: item => item.reason ?? '—' },
  {
    label: 'Priority',
    render: item => item.priority
      ? <StatusBadge value={item.priority} />
      : <span className="text-nhs-grey-3">—</span>,
  },
  { label: 'Recipient service', render: item => item.recipient ?? '—' },
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

function ReferralDetail({ referral, bundle, onJumpToSource, onJumpToRecord }: { referral: GpConnectReferral; bundle: GpConnectBundle; onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void }) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const refs = [
    referral.requesterId ? { type: 'Practitioner' as const, id: referral.requesterId, label: 'Requester' } : null,
    ...referral.recipientRefs.map(r => ({ type: r.type, id: r.id, label: 'Recipient' })),
    ...referral.supportingDocs.map(d => ({ type: 'Document' as const, id: d.id, label: 'Document' })),
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  const recipientLabel: Record<string, string> = {
    HealthcareService: 'Service',
    Organisation: 'Organisation',
    Practitioner: 'Practitioner',
  }

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{referral.recipient ?? 'Referral'}</h3>
        <div className="flex gap-2">
          {referral.priority && <StatusBadge value={referral.priority} />}
          <StatusBadge value={referral.status} />
        </div>
      </div>

      {/* Two-column layout: requester left, recipients right */}
      <div className="grid grid-cols-2 gap-x-8">
        {/* Left — requester */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide mb-1">Requester</p>
          <DetailRow label="Date"      value={referral.date} />
          <DetailRow label="Requester" value={
            referral.requester
              ? referral.requesterId
                ? <ReferenceChip label={referral.requester} onClick={() => toggle(referral.requesterId!)} active={openResourceId === referral.requesterId} />
                : referral.requester
              : undefined
          } />
          <DetailRow label="Priority" value={referral.priority ? <StatusBadge value={referral.priority} /> : undefined} />
          <DetailRow label="Status"   value={<StatusBadge value={referral.status} />} />
        </div>

        {/* Right — recipients */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide mb-1">Recipient</p>
          {referral.recipientRefs.length === 0 && referral.recipient && (
            <DetailRow label="Recipient" value={referral.recipient} />
          )}
          {referral.recipientRefs.map(r => (
            <DetailRow
              key={r.id}
              label={recipientLabel[r.type] ?? r.type}
              value={
                r.name
                  ? <ReferenceChip label={r.name} onClick={() => toggle(r.id)} active={openResourceId === r.id} />
                  : r.id
              }
            />
          ))}
        </div>
      </div>

      {/* Full-width fields */}
      {(referral.description || referral.reason) && (
        <div className="space-y-1.5 pt-1 border-t border-nhs-blue/10">
          {referral.description && (
            <div className="flex gap-2 min-w-0">
              <span className="text-xs text-nhs-grey-3 shrink-0 w-36">Description</span>
              <span className="text-xs text-nhs-grey-1 min-w-0">{referral.description}</span>
            </div>
          )}
          {referral.reason && (
            <div className="flex gap-2 min-w-0">
              <span className="text-xs text-nhs-grey-3 shrink-0 w-36">Reason</span>
              <span className="text-xs text-nhs-grey-1 min-w-0">{referral.reason}</span>
            </div>
          )}
        </div>
      )}
      {referral.supportingDocs.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Supporting documents</span>
          {referral.supportingDocs.map(doc => (
            <div key={doc.id} className="flex items-start gap-2 text-xs">
              <span className="text-nhs-grey-3 mt-0.5">📄</span>
              <div className="min-w-0">
                <span className="font-medium text-nhs-grey-1">{doc.title}</span>
                {doc.description && <span className="text-nhs-grey-2 ml-2">— {doc.description}</span>}
                {doc.date && <span className="text-nhs-grey-3 ml-2">{doc.date}</span>}
                {doc.status && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-nhs-grey-5 text-nhs-grey-2 border border-nhs-grey-4">{doc.status}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {referral.notes.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Notes</span>
          {referral.notes.map((note, i) => (
            <p key={i} className="text-xs text-nhs-grey-1">{note}</p>
          ))}
        </div>
      )}
      <ReferencedResources
        refs={refs}
        practitioners={bundle.practitioners}
        organisations={bundle.organisations}
        healthcareServices={bundle.healthcareServices}
        documents={bundle.documents}
        highlightedId={openResourceId ?? undefined}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />
    </div>
  )
}

export function ReferralsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const count = bundle.referrals.length
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredReferrals = trimmedQuery
    ? bundle.referrals.filter(r => referralSearchText(r).includes(trimmedQuery))
    : bundle.referrals
  return (
    <div className="space-y-4">
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
      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search referrals…"
        matchCount={filteredReferrals.length}
        totalCount={count}
      />
      <DomainTable
        columns={COLUMNS}
        items={filteredReferrals}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No referral records found in this bundle"
        expandedContent={referral => <ReferralDetail referral={referral} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}
