import { useState } from 'react'
import type { DraftRecord, DraftReferral } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { DateField, isoToDisplay } from './shared/DateField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'
import { ConfidentialityCheckboxes } from './shared/ConfidentialityCheckboxes'
import { TrashIcon } from '../components/Icons'

// ---------------------------------------------------------------------------
// ReferralForm
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

const INTENT_OPTS = [
  { value: 'order', label: 'Order' },
  { value: 'plan', label: 'Plan' },
  { value: 'proposal', label: 'Proposal' },
]

const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function priorityBadgeClass(priority: string | undefined): string {
  if (!priority) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  if (['urgent', 'asap', 'stat'].includes(priority))
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
}

function ReferralDisplayRow({
  referral,
  onEdit,
  onDelete,
}: {
  referral: DraftReferral
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">
            {referral.recipientName || 'Unnamed referral'}
          </span>
          {referral.priority && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityBadgeClass(referral.priority)}`}>
              {referral.priority}
            </span>
          )}
        </div>
        <div className="text-xs text-nhs-grey-3 mt-0.5 flex items-center gap-2">
          {referral.date && <span>{isoToDisplay(referral.date)}</span>}
          {referral.status && <span>{referral.status}</span>}
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

function ReferralCard({
  referral,
  draft,
  dispatch,
  isModal,
}: {
  referral: DraftReferral
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftReferral>) =>
    dispatch({ type: 'UPDATE_REFERRAL', payload: { _tempId: referral._tempId, updates } })

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
              {referral.recipientName || 'New referral'}
            </span>
            {referral.priority && (
              <span className="text-xs text-nhs-grey-3">{referral.priority}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_REFERRAL', payload: referral._tempId })}
            className="text-nhs-red hover:opacity-70 p-0.5"
            title="Remove"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <DateField label="Date" value={referral.date ?? ''} onChange={v => upd({ date: v })} />
            <Field label="Recipient name" value={referral.recipientName ?? ''} onChange={v => upd({ recipientName: v })} required />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="Priority"
              value={referral.priority ?? ''}
              onChange={v => upd({ priority: v as DraftReferral['priority'] })}
              options={PRIORITY_OPTS}
              placeholder="— Select —"
            />
            <SelectField
              label="Intent"
              value={referral.intent ?? ''}
              onChange={v => upd({ intent: v })}
              options={INTENT_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="Status"
              value={referral.status ?? ''}
              onChange={v => upd({ status: v })}
              options={STATUS_OPTS}
              placeholder="— Select —"
              required
            />
          </div>

          <Field label="Reason" value={referral.reason ?? ''} onChange={v => upd({ reason: v })} />
          <Field label="Description" value={referral.description ?? ''} onChange={v => upd({ description: v })} required />
          <Field label="Associated text" value={referral.associatedText ?? ''} onChange={v => upd({ associatedText: v })} />

          <PractitionerSelect
            label="Requester"
            draft={draft}
            value={referral.requesterTempId}
            onChange={v => upd({ requesterTempId: v })}
            required
          />

          <ConfidentialityCheckboxes
            confidential={referral.confidential}
            notForPfs={referral.notForPfs}
            onChange={upd}
          />

          <LinkSection
            draft={draft}
            linkedProblemTempIds={referral.linkedProblemTempIds ?? []}
            linkedConsultationTempId={referral.linkedConsultationTempId}
            onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
            onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
          />
        </div>
      )}
    </div>
  )
}

export function ReferralForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_REFERRAL_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  const handleEdit = (referral: DraftReferral) => {
    const snap = structuredClone(draft)
    setModalState({ tempId: referral._tempId, snapshot: snap })
  }

  const handleDone = () => setModalState(null)

  const handleCancel = () => {
    if (modalState) dispatch({ type: 'LOAD_DRAFT', payload: modalState.snapshot })
    setModalState(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_REFERRAL', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeReferral = modalState
    ? draft.referrals.find(r => r._tempId === modalState.tempId) ?? null
    : null

  const deleteReferral = deleteTarget
    ? draft.referrals.find(r => r._tempId === deleteTarget) ?? null
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Referrals</span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add referral
        </button>
      </div>

      {draft.referrals.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No referrals added yet.</p>
      )}

      {draft.referrals.map(referral => (
        <ReferralDisplayRow
          key={referral._tempId}
          referral={referral}
          onEdit={() => handleEdit(referral)}
          onDelete={() => setDeleteTarget(referral._tempId)}
        />
      ))}

      {modalState && activeReferral && (
        <BuilderModal
          title={activeReferral.recipientName ? `Edit: ${activeReferral.recipientName}` : 'Add Referral'}
          onDone={handleDone}
          onCancel={handleCancel}
        >
          <ReferralCard
            referral={activeReferral}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && deleteReferral && (
        <DeleteConfirmDialog
          label={deleteReferral.recipientName || 'this referral'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
