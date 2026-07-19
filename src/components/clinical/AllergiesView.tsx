import { useState } from 'react'
import type { GpConnectBundle, GpConnectAllergy } from '../../fhir/types'
import { DomainTable, StatusBadge, DegradedTermText } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { SearchFilterBox } from './SearchFilterBox'

function allergySearchText(a: GpConnectAllergy): string {
  return [
    a.causativeAgent, a.reaction, a.criticality, a.category, a.dateRecorded, a.status,
    a.snomedDisplay, a.snomedCode, a.onsetDate, a.verificationStatus, a.recorder, a.asserter,
    a.endDate, a.endReason, ...a.notes.flatMap(n => [n.text, n.author]),
  ].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const COLUMNS: DomainColumn<GpConnectAllergy>[] = [
  {
    label: 'Causative agent',
    render: item => <div className="font-medium text-nhs-grey-1"><DegradedTermText text={item.causativeAgent} /></div>,
  },
  { label: 'Reaction', render: item => item.reaction ?? '—' },
  {
    label: 'Criticality',
    className: 'w-28',
    render: item => item.criticality
      ? <StatusBadge value={item.criticality} />
      : <span className="text-nhs-grey-3">—</span>,
  },
  {
    label: 'Category',
    className: 'w-28',
    render: item => item.category
      ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
      : '—',
  },
  { label: 'Asserted date', className: 'w-32', render: item => item.dateRecorded ?? 'Unknown' },
  { label: 'Status', className: 'w-24', render: item => <StatusBadge value={item.status} /> },
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

function AllergyDetail({ allergy, bundle, onJumpToSource, onJumpToRecord }: { allergy: GpConnectAllergy; bundle: GpConnectBundle; onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void }) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)
  const showSnomedTerm = allergy.snomedDisplay && allergy.snomedDisplay !== allergy.causativeAgent

  // Unique note authors (deduplicated by id only, recorder included even if same person)
  const noteAuthorRefs = allergy.notes
    .filter((n, i, arr) => n.authorId && arr.findIndex(m => m.authorId === n.authorId) === i)
    .map(n => ({ type: 'Practitioner' as const, id: n.authorId!, label: 'Note author' }))

  const refs = [
    allergy.recorderId  ? { type: 'Practitioner' as const, id: allergy.recorderId,  label: 'Recorder'  } : null,
    allergy.asserterId  ? { type: 'Practitioner' as const, id: allergy.asserterId,  label: 'Asserter'  } : null,
    allergy.encounterId ? { type: 'Encounter'    as const, id: allergy.encounterId, label: 'Encounter' } : null,
    ...noteAuthorRefs,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{allergy.causativeAgent}</h3>
        <div className="flex gap-2">
          <StatusBadge value={allergy.status} />
          {allergy.verificationStatus && <StatusBadge value={allergy.verificationStatus} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {showSnomedTerm && <DetailRow label="SNOMED term" value={allergy.snomedDisplay} />}
        {allergy.snomedCode && (
          <DetailRow label="SNOMED code" value={<span className="font-mono">{allergy.snomedCode}</span>} />
        )}
        <DetailRow label="Onset date"     value={allergy.onsetDate} />
        <DetailRow label="Asserted date"  value={allergy.dateRecorded} />
        <DetailRow label="Category" value={allergy.category
          ? allergy.category.charAt(0).toUpperCase() + allergy.category.slice(1)
          : undefined}
        />
        <DetailRow label="Criticality" value={allergy.criticality
          ? <StatusBadge value={allergy.criticality} />
          : undefined}
        />
        <DetailRow label="Reaction" value={allergy.reaction} />
        <DetailRow label="Recorder" value={
          allergy.recorderId
            ? <ReferenceChip label={allergy.recorder ?? allergy.recorderId} onClick={() => toggle(allergy.recorderId!)} active={openResourceId === allergy.recorderId} />
            : allergy.recorder ?? undefined
        } />
        <DetailRow label="Asserter" value={
          allergy.asserterId
            ? <ReferenceChip label={allergy.asserter ?? allergy.asserterId} onClick={() => toggle(allergy.asserterId!)} active={openResourceId === allergy.asserterId} />
            : allergy.asserter ?? undefined
        } />
        {allergy.endDate   && <DetailRow label="End date"     value={allergy.endDate} />}
        {allergy.endReason && <DetailRow label="Reason ended" value={allergy.endReason} />}
      </div>

      {allergy.notes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-nhs-blue/10">
          {allergy.notes.map((note, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-xs text-nhs-grey-1 italic">"{note.text}"</p>
              <div className="flex items-center gap-2 flex-wrap">
                {(note.author || note.authorId) && (
                  note.authorId
                    ? <ReferenceChip label={note.author ?? note.authorId} onClick={() => toggle(note.authorId!)} active={openResourceId === note.authorId} />
                    : <span className="text-xs text-nhs-grey-3">{note.author}</span>
                )}
                {note.time && <span className="text-xs text-nhs-grey-3">{note.time}</span>}
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

export function AllergiesView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const { allergies } = bundle
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredAllergies = trimmedQuery
    ? allergies.filter(a => allergySearchText(a).includes(trimmedQuery))
    : allergies
  const active   = filteredAllergies.filter(a => a.status === 'active')
  const resolved = filteredAllergies.filter(a => a.status !== 'active')
  const total    = allergies.length
  const shown    = activeTab === 'active' ? active : resolved

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Allergies &amp; Adverse Reactions</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {total} record{total !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>

      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search allergies…"
        matchCount={filteredAllergies.length}
        totalCount={total}
      />

      {/* Tabs */}
      <div className="flex border-b border-nhs-grey-4">
        {(['active', 'resolved'] as const).map(tab => {
          const count = tab === 'active' ? active.length : resolved.length
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-nhs-blue text-nhs-blue'
                  : 'border-transparent text-nhs-grey-3 hover:text-nhs-grey-1 hover:border-nhs-grey-4',
              ].join(' ')}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className={[
                'ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold',
                isActive ? 'bg-nhs-blue text-white' : 'bg-nhs-grey-5 text-nhs-grey-2',
              ].join(' ')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-nhs-grey-3 text-center py-8">
          No {activeTab} allergy records found
        </p>
      ) : (
        <DomainTable
          columns={COLUMNS}
          items={shown}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyMessage="No records"
          expandedContent={allergy => (
            <AllergyDetail
              allergy={allergy}
              bundle={bundle}
              onJumpToSource={onJumpToSource}
              onJumpToRecord={onJumpToRecord}
            />
          )}
        />
      )}

      {total === 0 && (
        <p className="text-sm text-nhs-grey-3 text-center py-8">No allergy records found in this bundle</p>
      )}
    </div>
  )
}
