import { useState } from 'react'
import type { DraftRecord, DraftDiaryEntry } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'
import { ConfidentialityCheckboxes } from './shared/ConfidentialityCheckboxes'
import { TrashIcon } from '../components/Icons'

// ---------------------------------------------------------------------------
// DiaryEntryForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const PRIORITY_OPTS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'Stat' },
]

const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const INTENT_OPTS = [
  { value: 'plan', label: 'Plan' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'order', label: 'Order' },
]

function statusBadgeClass(status: string | undefined): string {
  if (!status) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  if (status === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (status === 'completed') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  if (status === 'cancelled') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function DiaryEntryDisplayRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: DraftDiaryEntry
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">
            {entry.description || 'Unnamed diary entry'}
          </span>
          {entry.status && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadgeClass(entry.status)}`}>
              {entry.status}
            </span>
          )}
        </div>
        <div className="text-xs text-nhs-grey-3 mt-0.5">
          {entry.date && <span>{entry.date}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs border border-nhs-blue text-nhs-blue px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">Edit</button>
        <button type="button" onClick={onDelete} className="text-nhs-red hover:opacity-70 p-0.5" title="Delete">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

function DiaryEntryCard({
  entry,
  draft,
  dispatch,
  isModal,
}: {
  entry: DraftDiaryEntry
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftDiaryEntry>) =>
    dispatch({ type: 'UPDATE_DIARY_ENTRY', payload: { _tempId: entry._tempId, updates } })

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
              {entry.description || 'New diary entry'}
            </span>
            {entry.date && (
              <span className="text-xs text-nhs-grey-3">{entry.date}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_DIARY_ENTRY', payload: entry._tempId })}
            className="text-nhs-red hover:opacity-70 p-0.5"
            title="Remove"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <SnomedPicker
            label="Description"
            value={entry.description ?? ''}
            code={entry.snomedCode}
            semanticTag="procedure"
            onChange={({ value, code }) => upd({ description: value, snomedCode: code })}
            required
          />
          <Field label="Associated text" value={entry.associatedText ?? ''} onChange={v => upd({ associatedText: v })} />

          <div className="grid grid-cols-3 gap-2">
            <Field label="Date" type="date" value={entry.date ?? ''} onChange={v => upd({ date: v })} />
            <Field label="Occurrence start" type="date" value={entry.occurrenceStart ?? ''} onChange={v => upd({ occurrenceStart: v })} />
            <Field label="Occurrence end" type="date" value={entry.occurrenceEnd ?? ''} onChange={v => upd({ occurrenceEnd: v })} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="Priority"
              value={entry.priority ?? ''}
              onChange={v => upd({ priority: v })}
              options={PRIORITY_OPTS}
              placeholder="— Select —"
            />
            <SelectField
              label="Status"
              value={entry.status ?? ''}
              onChange={v => upd({ status: v })}
              options={STATUS_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="Intent"
              value={entry.intent ?? ''}
              onChange={v => upd({ intent: v })}
              options={INTENT_OPTS}
              placeholder="— Select —"
              required
            />
          </div>

          <PractitionerSelect
            label="Clinician"
            draft={draft}
            value={entry.clinicianTempId}
            onChange={v => upd({ clinicianTempId: v })}
          />

          <ConfidentialityCheckboxes
            confidential={entry.confidential}
            notForPfs={entry.notForPfs}
            onChange={upd}
          />

          <LinkSection
            draft={draft}
            linkedProblemTempIds={entry.linkedProblemTempIds ?? []}
            linkedConsultationTempId={entry.linkedConsultationTempId}
            onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
            onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
          />
        </div>
      )}
    </div>
  )
}

export function DiaryEntryForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_DIARY_ENTRY_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  const handleEdit = (entry: DraftDiaryEntry) => {
    const snap = structuredClone(draft)
    setModalState({ tempId: entry._tempId, snapshot: snap })
  }

  const handleDone = () => setModalState(null)

  const handleCancel = () => {
    if (modalState) dispatch({ type: 'LOAD_DRAFT', payload: modalState.snapshot })
    setModalState(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_DIARY_ENTRY', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeEntry = modalState
    ? draft.diaryEntries.find(e => e._tempId === modalState.tempId) ?? null
    : null

  const deleteEntry = deleteTarget
    ? draft.diaryEntries.find(e => e._tempId === deleteTarget) ?? null
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Diary Entries</span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add diary entry
        </button>
      </div>

      {draft.diaryEntries.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No diary entries added yet.</p>
      )}

      {draft.diaryEntries.map(entry => (
        <DiaryEntryDisplayRow
          key={entry._tempId}
          entry={entry}
          onEdit={() => handleEdit(entry)}
          onDelete={() => setDeleteTarget(entry._tempId)}
        />
      ))}

      {modalState && activeEntry && (
        <BuilderModal
          title={activeEntry.description ? `Edit: ${activeEntry.description}` : 'Add Diary Entry'}
          onDone={handleDone}
          onCancel={handleCancel}
        >
          <DiaryEntryCard
            entry={activeEntry}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && deleteEntry && (
        <DeleteConfirmDialog
          label={deleteEntry.description || 'this diary entry'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
