import { useState } from 'react'
import type { DraftRecord, DraftAllergy } from '../types'
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
// AllergyForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const CATEGORY_OPTS = [
  { value: 'food', label: 'Food' },
  { value: 'medication', label: 'Medication' },
  { value: 'environment', label: 'Environment' },
  { value: 'biologic', label: 'Biologic' },
]

const CRITICALITY_OPTS = [
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
  { value: 'unable-to-assess', label: 'Unable to assess' },
]

const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
]

function AllergyCard({
  allergy,
  draft,
  dispatch,
  isModal,
}: {
  allergy: DraftAllergy
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftAllergy>) =>
    dispatch({ type: 'UPDATE_ALLERGY', payload: { _tempId: allergy._tempId, updates } })

  const isResolved = allergy.status === 'resolved'
  const expanded = isModal ? true : open

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
        {isModal ? (
          <span className="text-sm font-medium text-nhs-grey-1 flex-1">
            {allergy.causativeAgent || 'New allergy'}
          </span>
        ) : (
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
              {allergy.causativeAgent || 'New allergy'}
            </span>
            {allergy.status && (
              <span className="text-xs text-nhs-grey-3">{allergy.status}</span>
            )}
          </button>
        )}
        {!isModal && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_ALLERGY', payload: allergy._tempId })}
            className="text-nhs-red hover:opacity-70 p-0.5"
            title="Remove"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <SnomedPicker
            label="Causative agent"
            value={allergy.causativeAgent ?? ''}
            code={allergy.snomedCode}
            semanticTag="substance,product,allergy"
            onChange={({ value, code }) => upd({ causativeAgent: value, snomedCode: code })}
            required
          />
          <Field label="Associated text" value={allergy.associatedText ?? ''} onChange={v => upd({ associatedText: v })} />

          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="Category"
              value={allergy.category ?? ''}
              onChange={v => upd({ category: v as DraftAllergy['category'] })}
              options={CATEGORY_OPTS}
              placeholder="— Select —"
            />
            <SelectField
              label="Criticality"
              value={allergy.criticality ?? ''}
              onChange={v => upd({ criticality: v as DraftAllergy['criticality'] })}
              options={CRITICALITY_OPTS}
              placeholder="— Select —"
            />
            <SelectField
              label="Status"
              value={allergy.status ?? ''}
              onChange={v => upd({ status: v as DraftAllergy['status'] })}
              options={STATUS_OPTS}
              placeholder="— Select —"
              required
            />
          </div>

          <SnomedPicker
            label="Reaction"
            value={allergy.reaction ?? ''}
            code={allergy.reactionCode}
            semanticTag="finding,disorder"
            onChange={({ value, code }) => upd({ reaction: value, reactionCode: code })}
          />

          <div className="grid grid-cols-2 gap-2">
            <Field label="Asserted date" type="date" value={allergy.assertedDate ?? ''} onChange={v => upd({ assertedDate: v })} />
            <Field label="Onset date" type="date" value={allergy.onsetDate ?? ''} onChange={v => upd({ onsetDate: v })} />
          </div>

          {isResolved && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="End date" type="date" value={allergy.endDate ?? ''} onChange={v => upd({ endDate: v })} />
              <Field label="End reason" value={allergy.endReason ?? ''} onChange={v => upd({ endReason: v })} />
            </div>
          )}

          <PractitionerSelect
            label="Recorder"
            draft={draft}
            value={allergy.recorderTempId}
            onChange={v => upd({ recorderTempId: v })}
          />

          <ConfidentialityCheckboxes
            confidential={allergy.confidential}
            notForPfs={allergy.notForPfs}
            onChange={upd}
          />

          <LinkSection
            draft={draft}
            linkedProblemTempIds={allergy.linkedProblemTempIds ?? []}
            linkedConsultationTempId={allergy.linkedConsultationTempId}
            onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
            onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
          />
        </div>
      )}
    </div>
  )
}

function AllergyDisplayRow({
  allergy,
  onEdit,
  onDelete,
}: {
  allergy: DraftAllergy
  onEdit: () => void
  onDelete: () => void
}) {
  const status = allergy.status ?? ''
  const criticality = allergy.criticality ?? ''

  const statusBadge = (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}>{status || 'no status'}</span>
  )

  const criticalityBadge = criticality ? (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      criticality === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
      criticality === 'low' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}>{criticality}</span>
  ) : null

  const datePart = allergy.onsetDate
    ? `onset ${allergy.onsetDate}`
    : allergy.assertedDate
    ? `asserted ${allergy.assertedDate}`
    : null

  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">
            {allergy.causativeAgent || 'Unnamed allergy'}
          </span>
          {statusBadge}
          {criticalityBadge}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {allergy.category && (
            <span className="text-xs text-nhs-grey-3">{allergy.category}</span>
          )}
          {allergy.reaction && (
            <span className="text-xs text-nhs-grey-3">{allergy.reaction}</span>
          )}
          {datePart && (
            <span className="text-xs text-nhs-grey-3">{datePart}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onEdit} className="text-xs border border-nhs-blue text-nhs-blue px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">Edit</button>
        <button type="button" onClick={onDelete} className="text-nhs-red hover:opacity-70 p-0.5" title="Delete">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

export function AllergyForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_ALLERGY_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  const handleEdit = (allergy: DraftAllergy) => {
    const snap = structuredClone(draft)
    setModalState({ tempId: allergy._tempId, snapshot: snap })
  }

  const handleDone = () => {
    setModalState(null)
  }

  const handleCancel = () => {
    if (modalState) {
      dispatch({ type: 'LOAD_DRAFT', payload: modalState.snapshot })
    }
    setModalState(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_ALLERGY', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeAllergy = modalState
    ? draft.allergies.find(a => a._tempId === modalState.tempId)
    : null

  const deleteTargetAllergy = deleteTarget
    ? draft.allergies.find(a => a._tempId === deleteTarget)
    : null

  const modalTitle = activeAllergy
    ? (activeAllergy.causativeAgent ? `Edit: ${activeAllergy.causativeAgent}` : 'Edit Allergy')
    : 'Add Allergy'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Allergies</span>
        <button
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add allergy
        </button>
      </div>

      {draft.allergies.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No allergies added yet.</p>
      )}

      {draft.allergies.map(allergy => (
        <AllergyDisplayRow
          key={allergy._tempId}
          allergy={allergy}
          onEdit={() => handleEdit(allergy)}
          onDelete={() => setDeleteTarget(allergy._tempId)}
        />
      ))}

      {modalState && activeAllergy && (
        <BuilderModal title={modalTitle} onDone={handleDone} onCancel={handleCancel}>
          <AllergyCard
            allergy={activeAllergy}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && deleteTargetAllergy && (
        <DeleteConfirmDialog
          label={deleteTargetAllergy.causativeAgent || 'this allergy'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
