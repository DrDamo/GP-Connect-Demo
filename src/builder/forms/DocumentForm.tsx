import { useState } from 'react'
import type { DraftRecord, DraftDocument } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'

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

function DocumentCard({
  doc,
  draft,
  dispatch,
}: {
  doc: DraftDocument
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftDocument>) =>
    dispatch({ type: 'UPDATE_DOCUMENT', payload: { _tempId: doc._tempId, updates } })

  const orgName = draft.organisation.name || 'Organisation'

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
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

      {open && (
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
        </div>
      )}
    </div>
  )
}

export function DocumentForm({ draft, dispatch }: Props) {
  return (
    <div>
      {draft.documents.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No documents added yet.</p>
      )}
      {draft.documents.map(doc => (
        <DocumentCard key={doc._tempId} doc={doc} draft={draft} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_DOCUMENT' })}
        className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
      >
        + Add document
      </button>
    </div>
  )
}
