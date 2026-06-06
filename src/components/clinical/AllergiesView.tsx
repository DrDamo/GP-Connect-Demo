import { useState } from 'react'
import type { GpConnectBundle, GpConnectAllergy } from '../../fhir/types'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'

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
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">{item.causativeAgent}</div>
        {item.snomedCode && (
          <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{item.snomedCode}</div>
        )}
      </div>
    ),
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
  { label: 'Date recorded', className: 'w-32', render: item => item.dateRecorded ?? 'Unknown' },
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
        <DetailRow label="Onset date"    value={allergy.onsetDate} />
        <DetailRow label="Date recorded" value={allergy.dateRecorded} />
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

function AllergySection({
  title, description, allergies, selectedId, onSelect, onJumpToSource, onJumpToRecord, bundle,
}: {
  title: string; description: string; allergies: GpConnectAllergy[]
  selectedId?: string; onSelect?: (id: string) => void; onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  bundle: GpConnectBundle
}) {
  if (allergies.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="border-b border-nhs-grey-4 pb-1">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{title}</h3>
        <p className="text-xs text-nhs-grey-3">{description}</p>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={allergies}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No records in this section"
        expandedContent={allergy => <AllergyDetail allergy={allergy} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}

export function AllergiesView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const { allergies } = bundle
  const active   = allergies.filter(a => a.status === 'active')
  const resolved = allergies.filter(a => a.status !== 'active')
  const total    = allergies.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Allergies &amp; Adverse Reactions</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {total} record{total !== 1 ? 's' : ''} —{' '}
            {active.length} active · {resolved.length} resolved
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>

      <AllergySection
        title="Active"
        description="Current active allergies and adverse reactions"
        allergies={active}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} bundle={bundle}
      />
      <AllergySection
        title="Resolved"
        description="Previously recorded allergies that have resolved"
        allergies={resolved}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} bundle={bundle}
      />

      {total === 0 && (
        <p className="text-sm text-nhs-grey-3 text-center py-8">No allergy records found in this bundle</p>
      )}
    </div>
  )
}
