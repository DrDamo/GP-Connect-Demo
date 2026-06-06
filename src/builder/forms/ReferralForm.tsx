import { useState } from 'react'
import type { DraftRecord, DraftReferral } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { NotesList } from './shared/NotesList'

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

function ReferralCard({
  referral,
  draft,
  dispatch,
}: {
  referral: DraftReferral
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftReferral>) =>
    dispatch({ type: 'UPDATE_REFERRAL', payload: { _tempId: referral._tempId, updates } })

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
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-nhs-grey-5">
            {referral.recipientName || 'New referral'}
          </span>
          {referral.priority && (
            <span className="text-xs text-nhs-grey-3">{referral.priority}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_REFERRAL', payload: referral._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" type="date" value={referral.date ?? ''} onChange={v => upd({ date: v })} />
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

          <PractitionerSelect
            label="Requester"
            draft={draft}
            value={referral.requesterTempId}
            onChange={v => upd({ requesterTempId: v })}
          />

          <NotesList
            notes={referral.notes ?? []}
            onChange={notes => upd({ notes })}
          />
        </div>
      )}
    </div>
  )
}

export function ReferralForm({ draft, dispatch }: Props) {
  return (
    <div>
      {draft.referrals.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No referrals added yet.</p>
      )}
      {draft.referrals.map(referral => (
        <ReferralCard key={referral._tempId} referral={referral} draft={draft} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_REFERRAL' })}
        className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
      >
        + Add referral
      </button>
    </div>
  )
}
