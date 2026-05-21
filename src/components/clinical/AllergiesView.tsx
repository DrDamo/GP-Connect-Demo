import type { GpConnectBundle, GpConnectAllergy } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
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
  { label: 'Date recorded', className: 'w-32', render: item => item.dateRecorded ?? '—' },
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

function AllergyDetail({ allergy }: { allergy: GpConnectAllergy }) {
  const showSnomedTerm = allergy.snomedDisplay && allergy.snomedDisplay !== allergy.causativeAgent

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
        {showSnomedTerm && (
          <DetailRow label="SNOMED term" value={allergy.snomedDisplay} />
        )}
        {allergy.snomedCode && (
          <DetailRow label="SNOMED code" value={
            <span className="font-mono">{allergy.snomedCode}</span>
          } />
        )}
        <DetailRow label="Onset date" value={allergy.onsetDate} />
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
        <DetailRow label="Recorder" value={allergy.recorder} />
        {allergy.endDate && (
          <DetailRow label="End date" value={allergy.endDate} />
        )}
        {allergy.endReason && (
          <DetailRow label="Reason ended" value={allergy.endReason} />
        )}
      </div>

      {allergy.notes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-nhs-blue/10">
          {allergy.notes.map((note, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-xs text-nhs-grey-1 italic">"{note.text}"</p>
              {(note.author || note.time) && (
                <p className="text-xs text-nhs-grey-3">
                  {[note.author, note.time].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AllergiesView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.allergies.length
  const selected = selectedId ? bundle.allergies.find(a => a.id === selectedId) : undefined

  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Allergies &amp; Adverse Reactions</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.allergies}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No allergy records found in this bundle"
      />
      {selected && <AllergyDetail allergy={selected} />}
    </div>
  )
}
