import { useState } from 'react'
import type { DraftRecord, DraftDiaryEntry } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { NotesList } from './shared/NotesList'
import { SnomedPicker } from './shared/SnomedPicker'

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

function DiaryEntryCard({
  entry,
  draft,
  dispatch,
}: {
  entry: DraftDiaryEntry
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftDiaryEntry>) =>
    dispatch({ type: 'UPDATE_DIARY_ENTRY', payload: { _tempId: entry._tempId, updates } })

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
            {entry.description || 'New diary entry'}
          </span>
          {entry.date && (
            <span className="text-xs text-nhs-grey-3">{entry.date}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_DIARY_ENTRY', payload: entry._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <Field label="Description" value={entry.description ?? ''} onChange={v => upd({ description: v })} required />
          <SnomedPicker
            code={entry.snomedCode}
            display={entry.description}
            semanticTag="procedure"
            onSelect={({ code, display }) => upd({
              snomedCode: code || undefined,
              ...(display ? { description: display } : {}),
            })}
          />

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

          <NotesList
            notes={entry.notes ?? []}
            onChange={notes => upd({ notes })}
          />
        </div>
      )}
    </div>
  )
}

export function DiaryEntryForm({ draft, dispatch }: Props) {
  return (
    <div>
      {draft.diaryEntries.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No diary entries added yet.</p>
      )}
      {draft.diaryEntries.map(entry => (
        <DiaryEntryCard key={entry._tempId} entry={entry} draft={draft} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_DIARY_ENTRY' })}
        className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
      >
        + Add diary entry
      </button>
    </div>
  )
}
