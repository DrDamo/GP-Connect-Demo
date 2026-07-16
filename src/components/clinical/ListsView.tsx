import { useState } from 'react'
import type { GpConnectBundle, GpConnectList, GpConnectListEntry, ListCategory } from '../../fhir/types'
import { formatDate } from '../../fhir/utils'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import type { DomainId } from './domains'
import { SearchFilterBox } from './SearchFilterBox'

function listSearchText(l: GpConnectList): string {
  return [
    l.title, l.status, l.date, l.mode, l.orderedBy, l.note,
    ...l.entries.flatMap(e => [e.resourceType, e.display, e.resourceId]),
  ].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const RESOURCE_TYPE_TO_DOMAIN: Partial<Record<string, DomainId>> = {
  MedicationStatement: 'medications',
  MedicationRequest:   'medications',
  AllergyIntolerance:  'allergies',
  Condition:           'problems',
  Encounter:           'consultations',
  Immunization:        'immunisations',
  DiagnosticReport:    'investigations',
  Observation:         'investigations',
  ReferralRequest:     'referrals',
  ProcedureRequest:    'diary-entries',
  DocumentReference:   'documents',
}

const COLUMNS: DomainColumn<GpConnectList>[] = [
  {
    label: 'List',
    render: item => <span className="font-medium text-nhs-grey-1">{item.title ?? '—'}</span>,
  },
  { label: 'Date',    className: 'w-28', render: item => formatDate(item.date) ?? 'Unknown' },
  { label: 'Status',  className: 'w-24', render: item => <StatusBadge value={item.status} /> },
  {
    label: 'Entries',
    className: 'w-16',
    render: item => {
      const n = item.entries.filter(e => !e.deleted).length
      return <span className="text-nhs-grey-2">{n}</span>
    },
  },
]

function EntryRow({
  entry,
  onJumpToSource,
  onJumpToRecord,
}: {
  entry: GpConnectListEntry
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const domain = entry.resourceType ? RESOURCE_TYPE_TO_DOMAIN[entry.resourceType] : undefined
  return (
    <tr className="border-b border-nhs-blue/10 last:border-0">
      <td className="py-1.5 pr-4 text-xs text-nhs-grey-3 font-mono">{entry.resourceType || '—'}</td>
      <td className="py-1.5 pr-4">
        <div className="text-xs text-nhs-grey-1">{entry.display ?? '—'}</div>
        <div className="text-xs text-nhs-grey-4 font-mono">{entry.resourceId ?? ''}</div>
      </td>
      <td className="py-1.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {onJumpToRecord && domain && entry.resourceId && (
            <button
              onClick={() => onJumpToRecord(domain, entry.resourceId)}
              className="px-2 py-0.5 text-xs border border-nhs-green text-nhs-green rounded hover:bg-nhs-green hover:text-white transition-colors whitespace-nowrap"
            >
              Inspector →
            </button>
          )}
          {onJumpToSource && entry.resourceId && (
            <button
              onClick={() => onJumpToSource(entry.resourceId)}
              className="px-2 py-0.5 text-xs border border-nhs-blue text-nhs-blue rounded hover:bg-nhs-blue hover:text-white transition-colors whitespace-nowrap"
            >
              FHIR ↗
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 min-w-0">
      <span className="text-xs text-nhs-grey-3 shrink-0 w-28">{label}</span>
      <span className="text-xs text-nhs-grey-1">{value}</span>
    </div>
  )
}

function ListDetail({
  list,
  onJumpToSource,
  onJumpToRecord,
}: {
  list: GpConnectList
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const entries = list.entries.filter(e => !e.deleted)
  const deletedCount = list.entries.filter(e => e.deleted).length

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{list.title ?? 'List'}</h3>
        <StatusBadge value={list.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {list.date      && <DetailRow label="Date"       value={list.date} />}
        {list.mode      && <DetailRow label="Mode"       value={list.mode} />}
        {list.orderedBy && <DetailRow label="Ordered by" value={list.orderedBy} />}
        {list.note      && <div className="col-span-2"><DetailRow label="Note" value={list.note} /></div>}
      </div>
      {entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-nhs-blue/20">
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Resource type</th>
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Description</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <EntryRow
                  key={entry.resourceId || i}
                  entry={entry}
                  onJumpToSource={onJumpToSource}
                  onJumpToRecord={onJumpToRecord}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.emptyReason && (
        <p className="text-xs text-nhs-grey-3 italic">Empty reason: {list.emptyReason}</p>
      )}
      {deletedCount > 0 && (
        <p className="text-xs text-nhs-grey-3">{deletedCount} deleted entr{deletedCount === 1 ? 'y' : 'ies'} not shown</p>
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  description: string
  lists: GpConnectList[]
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

function ListSection({ title, description, lists, selectedId, onSelect, onJumpToSource, onJumpToRecord }: SectionProps) {
  if (lists.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="border-b border-nhs-grey-4 pb-1">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{title}</h3>
        <p className="text-xs text-nhs-grey-3">{description}</p>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={lists}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No lists in this section"
        expandedContent={list => <ListDetail list={list} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}

function countByCategory(lists: GpConnectList[], cat: ListCategory) {
  return lists.filter(l => l.category === cat).length
}

export function ListsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const { lists } = bundle
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredLists = trimmedQuery
    ? lists.filter(l => listSearchText(l).includes(trimmedQuery))
    : lists

  const primary             = filteredLists.filter(l => l.category === 'primary')
  const secondaryConsult    = filteredLists.filter(l => l.category === 'secondary-consultation')
  const secondaryProblems   = filteredLists.filter(l => l.category === 'secondary-problems')
  const other               = filteredLists.filter(l => l.category === 'other')

  const total = lists.length
  const counts = [
    countByCategory(filteredLists, 'primary'),
    countByCategory(filteredLists, 'secondary-consultation'),
    countByCategory(filteredLists, 'secondary-problems'),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Lists</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {total} list{total !== 1 ? 's' : ''} —{' '}
            {counts[0]} primary · {counts[1]} consultation linkages · {counts[2]} problem linkages
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>

      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search lists…"
        matchCount={filteredLists.length}
        totalCount={total}
      />

      <ListSection
        title="Primary Lists"
        description="Domain-level summaries — one per clinical area returned in this bundle"
        lists={primary}
        selectedId={selectedId}
        onSelect={onSelect}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />

      <ListSection
        title="Consultation Linkages"
        description="Cross-references identifying which clinical items were recorded during consultations"
        lists={secondaryConsult}
        selectedId={selectedId}
        onSelect={onSelect}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />

      <ListSection
        title="Problem Linkages"
        description="Cross-references identifying which clinical items are related to specific problems"
        lists={secondaryProblems}
        selectedId={selectedId}
        onSelect={onSelect}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />

      {other.length > 0 && (
        <ListSection
          title="Other Lists"
          description="Lists not matching a recognised GP Connect category"
          lists={other}
          selectedId={selectedId}
          onSelect={onSelect}
          onJumpToSource={onJumpToSource}
          onJumpToRecord={onJumpToRecord}
        />
      )}

      {total === 0 && (
        <p className="text-sm text-nhs-grey-3 text-center py-8">No lists found in this bundle</p>
      )}
    </div>
  )
}
