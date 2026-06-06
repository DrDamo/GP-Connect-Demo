import { useState } from 'react'
import type { DraftRecord, DraftProblem } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { NotesList } from './shared/NotesList'
import { SnomedPicker } from './shared/SnomedPicker'

// ---------------------------------------------------------------------------
// ProblemForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const CLINICAL_STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'resolved', label: 'Resolved' },
]

const SIGNIFICANCE_OPTS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
]

function ProblemCard({
  problem,
  draft,
  dispatch,
}: {
  problem: DraftProblem
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftProblem>) =>
    dispatch({ type: 'UPDATE_PROBLEM', payload: { _tempId: problem._tempId, updates } })

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
            {problem.problem || 'New problem'}
          </span>
          {problem.clinicalStatus && (
            <span className="text-xs text-nhs-grey-3">{problem.clinicalStatus}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_PROBLEM', payload: problem._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <Field label="Problem description" value={problem.problem ?? ''} onChange={v => upd({ problem: v })} required />
          <SnomedPicker
            code={problem.snomedCode}
            display={problem.problem}
            semanticTag="disorder,finding"
            onSelect={({ code, display }) => upd({
              snomedCode: code || undefined,
              ...(display ? { problem: display } : {}),
            })}
          />

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Clinical status"
              value={problem.clinicalStatus ?? ''}
              onChange={v => upd({ clinicalStatus: v as DraftProblem['clinicalStatus'] })}
              options={CLINICAL_STATUS_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="Significance"
              value={problem.significance ?? ''}
              onChange={v => upd({ significance: v as DraftProblem['significance'] })}
              options={SIGNIFICANCE_OPTS}
              placeholder="— Select —"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Start date" type="date" value={problem.startDate ?? ''} onChange={v => upd({ startDate: v })} />
            <Field label="End date" type="date" value={problem.endDate ?? ''} onChange={v => upd({ endDate: v })} />
            <Field label="Asserted date" type="date" value={problem.assertedDate ?? ''} onChange={v => upd({ assertedDate: v })} />
          </div>

          <PractitionerSelect
            label="Asserter"
            draft={draft}
            value={problem.asserterTempId}
            onChange={v => upd({ asserterTempId: v })}
          />

          <NotesList
            notes={problem.notes ?? []}
            onChange={notes => upd({ notes })}
          />
        </div>
      )}
    </div>
  )
}

export function ProblemForm({ draft, dispatch }: Props) {
  return (
    <div>
      {draft.problems.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No problems added yet.</p>
      )}
      {draft.problems.map(problem => (
        <ProblemCard key={problem._tempId} problem={problem} draft={draft} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_PROBLEM' })}
        className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
      >
        + Add problem
      </button>
    </div>
  )
}
