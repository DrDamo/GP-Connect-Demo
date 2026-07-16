import { useState } from 'react'
import { DomainTable, StatusBadge, type DomainColumn } from './DomainTable'
import type { GpConnectBundle, GpConnectDocument } from '../../fhir/types'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { SearchFilterBox } from './SearchFilterBox'

function documentSearchText(d: GpConnectDocument): string {
  return [
    d.date, d.type, d.description, d.author, d.mimeType, d.status, d.custodian, d.attachmentTitle, d.url,
  ].filter(Boolean).join(' ').toLowerCase()
}

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
  { label: 'Date',        className: 'w-28', render: d => d.date ?? 'Unknown' },
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

function formatFileSize(bytes?: number): string | undefined {
  if (bytes === undefined) return undefined
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentDetail({ document, bundle, onJumpToSource, onJumpToRecord }: { document: GpConnectDocument; bundle: GpConnectBundle; onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void }) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const refs = [
    document.authorId     ? { type: 'Practitioner' as const, id: document.authorId,     label: 'Author'    } : null,
    document.custodianId  ? { type: 'Organisation' as const, id: document.custodianId,  label: 'Custodian' } : null,
    document.encounterId  ? { type: 'Encounter'    as const, id: document.encounterId,  label: 'Encounter' } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{document.type}</h3>
        <StatusBadge value={document.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        <DetailRow label="Date" value={document.date} />
        <DetailRow label="Author" value={
          document.author
            ? document.authorId
              ? <ReferenceChip label={document.author} onClick={() => toggle(document.authorId!)} active={openResourceId === document.authorId} />
              : document.author
            : undefined
        } />
        <DetailRow label="Custodian" value={
          document.custodian
            ? document.custodianId
              ? <ReferenceChip label={document.custodian} onClick={() => toggle(document.custodianId!)} active={openResourceId === document.custodianId} />
              : document.custodian
            : undefined
        } />
        <DetailRow label="Format"     value={document.mimeType ? mimeLabel(document.mimeType) : undefined} />
        {document.mimeType && (
          <DetailRow label="MIME type" value={<span className="font-mono text-xs">{document.mimeType}</span>} />
        )}
        <DetailRow label="File size" value={formatFileSize(document.attachmentSize)} />
        {document.description && (
          <div className="col-span-2 flex gap-2 min-w-0">
            <span className="text-xs text-nhs-grey-3 shrink-0 w-36">Description</span>
            <span className="text-xs text-nhs-grey-1 min-w-0">{document.description}</span>
          </div>
        )}
        {document.attachmentTitle && (
          <div className="col-span-2 flex gap-2 items-start min-w-0 bg-amber-50 border border-amber-300 rounded px-3 py-2">
            <span className="text-amber-600 text-sm leading-none mt-0.5">⚠</span>
            <span className="text-xs text-amber-800">{document.attachmentTitle}</span>
          </div>
        )}
        {document.url && (
          <div className="col-span-2 flex gap-2 min-w-0">
            <span className="text-xs text-nhs-grey-3 shrink-0 w-36">URL</span>
            <a href={document.url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-nhs-blue underline hover:no-underline truncate">
              {document.url}
            </a>
          </div>
        )}
      </div>
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

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

export function DocumentsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredDocuments = trimmedQuery
    ? bundle.documents.filter(d => documentSearchText(d).includes(trimmedQuery))
    : bundle.documents
  return (
    <div className="space-y-4">
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
      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search documents…"
        matchCount={filteredDocuments.length}
        totalCount={bundle.documents.length}
      />
      <DomainTable
        columns={COLUMNS}
        items={filteredDocuments}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No documents found in this bundle"
        expandedContent={document => <DocumentDetail document={document} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}
