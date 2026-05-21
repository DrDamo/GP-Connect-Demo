import type { GpConnectBundle, GpConnectDiaryEntry } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectDiaryEntry>[] = [
  { label: 'Date', render: item => item.date ?? '—' },
  {
    label: 'Description',
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">{item.description}</div>
        {item.snomedCode && (
          <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{item.snomedCode}</div>
        )}
      </div>
    ),
  },
  { label: 'Clinician', render: item => item.clinician ?? '—' },
  {
    label: 'Priority',
    render: item => item.priority
      ? <StatusBadge value={item.priority} />
      : <span className="text-nhs-grey-3">—</span>,
  },
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

function DiaryEntryDetail({ entry }: { entry: GpConnectDiaryEntry }) {
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
        <DetailRow label="Date"      value={entry.date} />
        <DetailRow label="Clinician" value={entry.clinician} />
        {entry.priority && (
          <DetailRow label="Priority" value={<StatusBadge value={entry.priority} />} />
        )}
        <DetailRow label="Status" value={<StatusBadge value={entry.status} />} />
      </div>
    </div>
  )
}

export function DiaryEntriesView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.diaryEntries.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
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
      <DomainTable
        columns={COLUMNS}
        items={bundle.diaryEntries}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No diary entries found in this bundle"
        expandedContent={entry => <DiaryEntryDetail entry={entry} />}
      />
    </div>
  )
}
