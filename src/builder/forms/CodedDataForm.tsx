import { useState } from 'react'
import type { DraftRecord, DraftCodedDataItem } from '../types'
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
// CodedDataForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const OBS_STATUS_OPTS = [
  { value: 'final', label: 'Final' },
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'registered', label: 'Registered' },
  { value: 'amended', label: 'Amended' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'entered-in-error', label: 'Entered in error' },
]

const INTERPRETATION_OPTS = [
  { value: 'normal', label: 'Normal' },
  { value: 'abnormal', label: 'Abnormal' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'critical', label: 'Critical' },
]

function statusBadgeClass(status: string | undefined): string {
  if (!status) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  if (status === 'final') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (status === 'preliminary') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
  if (status === 'cancelled') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  if (status === 'amended') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function CodedDataDisplayRow({
  item,
  onEdit,
  onDelete,
}: {
  item: DraftCodedDataItem
  onEdit: () => void
  onDelete: () => void
}) {
  const valueParts = [
    item.value,
    item.unit,
  ].filter(Boolean).join(' ')

  const metaParts = [
    valueParts || null,
    item.date || null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">
            {item.description || 'Unnamed coded data'}
          </span>
          {item.status && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadgeClass(item.status)}`}>
              {item.status}
            </span>
          )}
        </div>
        {metaParts && (
          <div className="text-xs text-nhs-grey-3 mt-0.5">{metaParts}</div>
        )}
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

function CodedDataCard({
  item,
  draft,
  dispatch,
  isModal,
}: {
  item: DraftCodedDataItem
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftCodedDataItem>) =>
    dispatch({ type: 'UPDATE_CODED_DATA', payload: { _tempId: item._tempId, updates } })

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
              {item.description || 'New coded data item'}
            </span>
            {item.date && (
              <span className="text-xs text-nhs-grey-3">{item.date}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_CODED_DATA', payload: item._tempId })}
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
            value={item.description ?? ''}
            code={item.snomedCode}
            onChange={({ value, code }) => upd({ description: value, snomedCode: code })}
            required
          />
          <Field label="Associated text" value={item.comment ?? ''} onChange={v => upd({ comment: v })} />

          <div className="grid grid-cols-3 gap-2">
            <Field label="Date" type="date" value={item.date ?? ''} onChange={v => upd({ date: v })} />
            <Field label="Value" value={item.value ?? ''} onChange={v => upd({ value: v })} />
            <Field label="Unit" value={item.unit ?? ''} onChange={v => upd({ unit: v })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Status"
              value={item.status ?? ''}
              onChange={v => upd({ status: v })}
              options={OBS_STATUS_OPTS}
              required
            />
            <SelectField
              label="Interpretation"
              value={item.interpretation ?? ''}
              onChange={v => upd({ interpretation: v })}
              options={INTERPRETATION_OPTS}
            />
          </div>

          <PractitionerSelect
            label="Performer"
            draft={draft}
            value={item.performerTempId}
            onChange={v => upd({ performerTempId: v })}
          />

          <ConfidentialityCheckboxes
            confidential={item.confidential}
            notForPfs={item.notForPfs}
            onChange={upd}
          />

          <LinkSection
            draft={draft}
            linkedProblemTempIds={item.linkedProblemTempIds ?? []}
            linkedConsultationTempId={item.linkedConsultationTempId}
            onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
            onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
          />
        </div>
      )}
    </div>
  )
}

export function CodedDataForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_CODED_DATA_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  const handleEdit = (item: DraftCodedDataItem) => {
    const snap = structuredClone(draft)
    setModalState({ tempId: item._tempId, snapshot: snap })
  }

  const handleDone = () => setModalState(null)

  const handleCancel = () => {
    if (modalState) dispatch({ type: 'LOAD_DRAFT', payload: modalState.snapshot })
    setModalState(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_CODED_DATA', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeItem = modalState
    ? draft.codedData.find(i => i._tempId === modalState.tempId) ?? null
    : null

  const deleteItem = deleteTarget
    ? draft.codedData.find(i => i._tempId === deleteTarget) ?? null
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Coded Data</span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add coded data item
        </button>
      </div>

      {draft.codedData.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No coded data items added yet.</p>
      )}

      {draft.codedData.map(item => (
        <CodedDataDisplayRow
          key={item._tempId}
          item={item}
          onEdit={() => handleEdit(item)}
          onDelete={() => setDeleteTarget(item._tempId)}
        />
      ))}

      {modalState && activeItem && (
        <BuilderModal
          title={activeItem.description ? `Edit: ${activeItem.description}` : 'Add Coded Data Item'}
          onDone={handleDone}
          onCancel={handleCancel}
        >
          <CodedDataCard
            item={activeItem}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && deleteItem && (
        <DeleteConfirmDialog
          label={deleteItem.description || 'this coded data item'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
