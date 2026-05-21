import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge, type DomainColumn } from './DomainTable'
import type { GpConnectBundle, GpConnectDocument } from '../../fhir/types'

const MIME_LABELS: Record<string, string> = {
  'application/pdf':    'PDF',
  'text/html':          'HTML',
  'text/plain':         'TXT',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'image/jpeg':         'JPEG',
  'image/png':          'PNG',
}

function mimeLabel(mimeType?: string): string {
  if (!mimeType) return '—'
  return MIME_LABELS[mimeType] ?? mimeType.split('/')[1]?.toUpperCase() ?? mimeType
}

const COLUMNS: DomainColumn<GpConnectDocument>[] = [
  { label: 'Date',        className: 'w-28',  render: d => d.date ?? '—' },
  { label: 'Type',        className: 'w-52',  render: d => d.type },
  { label: 'Description', render: d => d.description ?? '—' },
  { label: 'Author',      className: 'w-40',  render: d => d.author ?? '—' },
  { label: 'Format',      className: 'w-20',  render: d => mimeLabel(d.mimeType) },
  {
    label: 'Status',
    className: 'w-28',
    render: d => <StatusBadge value={d.status} />,
  },
]

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

export function DocumentsView({ bundle, selectedId, onSelect }: Props) {
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Documents</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {bundle.documents.length} {bundle.documents.length === 1 ? 'document' : 'documents'}
            {bundle.documents.length > 0 ? ' · click a row to highlight FHIR source' : ''}
          </p>
        </div>
        <span className="text-xs text-nhs-grey-3 border border-nhs-grey-4 rounded px-2 py-1">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.documents}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No documents found in this bundle"
      />
    </div>
  )
}
