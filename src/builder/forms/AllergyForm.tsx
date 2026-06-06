import { useState } from 'react'
import type { DraftRecord, DraftAllergy } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { NotesList } from './shared/NotesList'
import { SnomedPicker } from './shared/SnomedPicker'

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
}: {
  allergy: DraftAllergy
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftAllergy>) =>
    dispatch({ type: 'UPDATE_ALLERGY', payload: { _tempId: allergy._tempId, updates } })

  const isResolved = allergy.status === 'resolved'

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
            {allergy.causativeAgent || 'New allergy'}
          </span>
          {allergy.status && (
            <span className="text-xs text-nhs-grey-3">{allergy.status}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_ALLERGY', payload: allergy._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <Field label="Causative agent" value={allergy.causativeAgent ?? ''} onChange={v => upd({ causativeAgent: v })} required />
          <SnomedPicker
            code={allergy.snomedCode}
            display={allergy.causativeAgent}
            semanticTag="substance,product"
            onSelect={({ code, display }) => upd({
              snomedCode: code || undefined,
              ...(display ? { causativeAgent: display } : {}),
            })}
          />

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

          <Field label="Reaction" value={allergy.reaction ?? ''} onChange={v => upd({ reaction: v })} placeholder="Anaphylaxis" />

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

          <NotesList
            notes={allergy.notes ?? []}
            onChange={notes => upd({ notes })}
          />
        </div>
      )}
    </div>
  )
}

export function AllergyForm({ draft, dispatch }: Props) {
  return (
    <div>
      {draft.allergies.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No allergies added yet.</p>
      )}
      {draft.allergies.map(allergy => (
        <AllergyCard key={allergy._tempId} allergy={allergy} draft={draft} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_ALLERGY' })}
        className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
      >
        + Add allergy
      </button>
    </div>
  )
}
