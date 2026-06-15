import { useState } from 'react'
import type { DraftRecord, DraftDocument } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'

// ---------------------------------------------------------------------------
// DocumentForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const STATUS_OPTS = [
  { value: 'current', label: 'Current' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'entered-in-error', label: 'Entered in error' },
]

const MIME_TYPE_OPTS = [
  { value: 'application/pdf', label: 'PDF (application/pdf)' },
  { value: 'text/html', label: 'HTML (text/html)' },
  { value: 'text/plain', label: 'Plain text (text/plain)' },
  { value: 'application/xml', label: 'XML (application/xml)' },
  { value: 'image/jpeg', label: 'JPEG image (image/jpeg)' },
  { value: 'image/png', label: 'PNG image (image/png)' },
]

function statusBadgeClass(status: string | undefined): string {
  if (!status) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  if (status === 'current') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (status === 'superseded') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  if (status === 'entered-in-error') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function DocumentDisplayRow({
  doc,
  onEdit,
  onDelete,
}: {
  doc: DraftDocument
  onEdit: () => void
  onDelete: () => void
}) {
  const metaParts = [
    doc.date || null,
    doc.mimeType || null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">
            {doc.type || doc.description || 'Unnamed document'}
          </span>
          {doc.status && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadgeClass(doc.status)}`}>
              {doc.status}
            </span>
          )}
        </div>
        {metaParts && (
          <div className="text-xs text-nhs-grey-3 mt-0.5">{metaParts}</div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs text-nhs-blue hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
      </div>
    </div>
  )
}

function DocumentCard({
  doc,
  draft,
  dispatch,
  isModal,
}: {
  doc: DraftDocument
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftDocument>) =>
    dispatch({ type: 'UPDATE_DOCUMENT', payload: { _tempId: doc._tempId, updates } })

  const orgName = draft.organisation.name || 'Organisation'
  const expanded = isModal ? true : open

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      {!isModal && (
        <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <svg
              className={`w-3.5 h-3.5 text-nhs-grey-3 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-sm font-medium text-nhs-grey-1">
              {doc.type || doc.description || 'New document'}
            </span>
            {doc.date && (
              <span className="text-xs text-nhs-grey-3">{doc.date}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_DOCUMENT', payload: doc._tempId })}
            className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
          >
            Remove
          </button>
        </div>
      )}

      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Document type" value={doc.type ?? ''} onChange={v => upd({ type: v })} placeholder="Discharge summary" required />
            <Field label="Date" type="date" value={doc.date ?? ''} onChange={v => upd({ date: v })} />
          </div>

          <Field label="Description" value={doc.description ?? ''} onChange={v => upd({ description: v })} />

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Status"
              value={doc.status ?? ''}
              onChange={v => upd({ status: v })}
              options={STATUS_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="MIME type"
              value={doc.mimeType ?? ''}
              onChange={v => upd({ mimeType: v })}
              options={MIME_TYPE_OPTS}
              placeholder="— Select —"
            />
          </div>

          <Field label="URL" value={doc.url ?? ''} onChange={v => upd({ url: v })} placeholder="https://example.com/document.pdf" />

          <PractitionerSelect
            label="Author"
            draft={draft}
            value={doc.authorTempId}
            onChange={v => upd({ authorTempId: v })}
          />

          {/* Custodian org — display only */}
          <div>
            <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">
              Custodian organisation
            </label>
            <div className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm text-nhs-grey-3 dark:text-nhs-grey-3 bg-nhs-grey-5 dark:bg-gray-800">
              {orgName}
            </div>
          </div>
          <LinkSection
            draft={draft}
            linkedProblemTempIds={doc.linkedProblemTempIds ?? []}
            linkedConsultationTempId={doc.linkedConsultationTempId}
            onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
            onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
          />
        </div>
      )}
    </div>
  )
}

export function DocumentForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_DOCUMENT_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  const handleEdit = (doc: DraftDocument) => {
    const snap = structuredClone(draft)
    setModalState({ tempId: doc._tempId, snapshot: snap })
  }

  const handleDone = () => setModalState(null)

  const handleCancel = () => {
    if (modalState) dispatch({ type: 'LOAD_DRAFT', payload: modalState.snapshot })
    setModalState(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_DOCUMENT', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeDoc = modalState
    ? draft.documents.find(d => d._tempId === modalState.tempId) ?? null
    : null

  const deleteDoc = deleteTarget
    ? draft.documents.find(d => d._tempId === deleteTarget) ?? null
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Documents</span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add document
        </button>
      </div>

      {draft.documents.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No documents added yet.</p>
      )}

      {draft.documents.map(doc => (
        <DocumentDisplayRow
          key={doc._tempId}
          doc={doc}
          onEdit={() => handleEdit(doc)}
          onDelete={() => setDeleteTarget(doc._tempId)}
        />
      ))}

      {modalState && activeDoc && (
        <BuilderModal
          title={activeDoc.type ? `Edit: ${activeDoc.type}` : 'Add Document'}
          onDone={handleDone}
          onCancel={handleCancel}
        >
          <DocumentCard
            doc={activeDoc}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && deleteDoc && (
        <DeleteConfirmDialog
          label={deleteDoc.type || deleteDoc.description || 'this document'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
