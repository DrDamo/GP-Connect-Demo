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
  { label: 'Date',        className: 'w-28', render: d => d.date ?? '—' },
  { label: 'Type',        className: 'w-52', render: d => d.type },
  { label: 'Description', render: d => d.description ?? '—' },
  { label: 'Author',      className: 'w-40', render: d => d.author ?? '—' },
  { label: 'Format',      className: 'w-20', render: d => mimeLabel(d.mimeType) },
  { label: 'Status',      className: 'w-28', render: d => <StatusBadge value={d.status} /> },
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

function DocumentDetail({ document }: { document: GpConnectDocument }) {
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{document.type}</h3>
        <StatusBadge value={document.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        <DetailRow label="Date"        value={document.date} />
        <DetailRow label="Author"      value={document.author} />
        <DetailRow label="Format"      value={document.mimeType ? mimeLabel(document.mimeType) : undefined} />
        {document.mimeType && (
          <DetailRow label="MIME type" value={<span className="font-mono text-xs">{document.mimeType}</span>} />
        )}
        {document.description && (
          <div className="col-span-2 flex gap-2 min-w-0">
            <span className="text-xs text-nhs-grey-3 shrink-0 w-36">Description</span>
            <span className="text-xs text-nhs-grey-1 min-w-0">{document.description}</span>
          </div>
        )}
        {document.url && (
          <div className="col-span-2 flex gap-2 min-w-0">
            <span className="text-xs text-nhs-grey-3 shrink-0 w-36">URL</span>
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-nhs-blue underline hover:no-underline truncate"
            >
              {document.url}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

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
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.documents}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No documents found in this bundle"
        expandedContent={document => <DocumentDetail document={document} />}
      />
    </div>
  )
}
