import { useState } from 'react'
import type { GpConnectBundle, GpConnectDiaryEntry } from '../../fhir/types'
import { DomainTable, StatusBadge, DegradedTermText } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { SearchFilterBox } from './SearchFilterBox'

function diaryEntrySearchText(e: GpConnectDiaryEntry): string {
  return [
    e.date, e.occurrenceStart, e.occurrenceEnd, e.description, e.priority, e.status, e.snomedCode,
    e.clinician, e.intent, ...e.notes.flatMap(n => [n.text, n.author]),
  ].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const COLUMNS: DomainColumn<GpConnectDiaryEntry>[] = [
  { label: 'Recorded date', className: 'w-32', render: item => item.date ?? 'Unknown' },
  { label: 'Start date',    className: 'w-32', render: item => item.occurrenceStart ?? '—' },
  { label: 'Description',  render: item => <span className="font-medium text-nhs-grey-1"><DegradedTermText text={item.description} /></span> },
  {
    label: 'Priority',
    className: 'w-28',
    render: item => item.priority
      ? <StatusBadge value={item.priority} />
      : <span className="text-nhs-grey-3">—</span>,
  },
  { label: 'Status', className: 'w-28', render: item => <StatusBadge value={item.status} /> },
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

function DiaryEntryDetail({ entry, bundle, onJumpToSource, onJumpToRecord }: { entry: GpConnectDiaryEntry; bundle: GpConnectBundle; onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void }) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const noteAuthorIds = entry.notes.map(n => n.authorId).filter((id): id is string => Boolean(id))

  const refs = [
    entry.clinicianId  ? { type: 'Practitioner' as const, id: entry.clinicianId,  label: 'Clinician' } : null,
    entry.encounterId  ? { type: 'Encounter'    as const, id: entry.encounterId,  label: 'Encounter' } : null,
    ...noteAuthorIds.map(id => ({ type: 'Practitioner' as const, id, label: 'Note author' })),
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{entry.description}</h3>
        <div className="flex gap-2">
          {entry.priority && <StatusBadge value={entry.priority} />}
          <StatusBadge value={entry.status} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {entry.snomedCode && (
          <DetailRow label="SNOMED code" value={<span className="font-mono">{entry.snomedCode}</span>} />
        )}
        <DetailRow label="Recorded date" value={entry.date} />
        <DetailRow label="Clinician" value={
          entry.clinician
            ? entry.clinicianId
              ? <ReferenceChip label={entry.clinician} onClick={() => toggle(entry.clinicianId!)} active={openResourceId === entry.clinicianId} />
              : entry.clinician
            : undefined
        } />
        {entry.occurrenceStart && (
          <DetailRow label="Occurrence start" value={entry.occurrenceStart} />
        )}
        {entry.occurrenceEnd && (
          <DetailRow label="Occurrence end" value={entry.occurrenceEnd} />
        )}
        {entry.intent && (
          <DetailRow label="Intent" value={<StatusBadge value={entry.intent} />} />
        )}
        {entry.priority && (
          <DetailRow label="Priority" value={<StatusBadge value={entry.priority} />} />
        )}
        <DetailRow label="Status" value={<StatusBadge value={entry.status} />} />
      </div>
      {entry.notes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Notes</span>
          {entry.notes.map((note, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-xs text-nhs-grey-1">{note.text}</p>
              <div className="flex gap-3 text-[11px] text-nhs-grey-3">
                {note.author && (
                  note.authorId
                    ? <ReferenceChip label={note.author} onClick={() => toggle(note.authorId!)} active={openResourceId === note.authorId} />
                    : <span>{note.author}</span>
                )}
                {note.time && <span>{note.time}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <ReferencedResources
        refs={refs}
        practitioners={bundle.practitioners}
        organisations={bundle.organisations}
        healthcareServices={bundle.healthcareServices}
        consultations={bundle.consultations}
        highlightedId={openResourceId ?? undefined}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />
    </div>
  )
}

export function DiaryEntriesView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const count = bundle.diaryEntries.length
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredEntries = trimmedQuery
    ? bundle.diaryEntries.filter(e => diaryEntrySearchText(e).includes(trimmedQuery))
    : bundle.diaryEntries
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Diary Entries</h2>
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
        placeholder="Search diary entries…"
        matchCount={filteredEntries.length}
        totalCount={count}
      />
      <DomainTable
        columns={COLUMNS}
        items={filteredEntries}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No diary entries found in this bundle"
        expandedContent={entry => <DiaryEntryDetail entry={entry} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}
