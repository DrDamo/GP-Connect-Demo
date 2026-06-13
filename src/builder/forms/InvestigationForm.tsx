import { useState } from 'react'
import type { DraftRecord, DraftInvestigation, DraftInvestigationResult } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'

// ---------------------------------------------------------------------------
// InvestigationForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const DIAG_STATUS_OPTS = [
  { value: 'final', label: 'Final' },
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'registered', label: 'Registered' },
  { value: 'partial', label: 'Partial' },
  { value: 'amended', label: 'Amended' },
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

function ResultRow({
  result,
  invTempId,
  dispatch,
}: {
  result: DraftInvestigationResult
  invTempId: string
  dispatch: React.Dispatch<DraftAction>
}) {
  const upd = (updates: Partial<DraftInvestigationResult>) =>
    dispatch({
      type: 'UPDATE_INVESTIGATION_RESULT',
      payload: { invTempId, resultTempId: result._tempId, updates },
    })

  return (
    <div className="border border-nhs-grey-5 dark:border-nhs-grey-4 rounded p-2 mb-1.5 bg-white dark:bg-gray-900">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-2">
        <Field label="Result name" value={result.name ?? ''} onChange={v => upd({ name: v })} required />
        <SnomedPicker
          code={result.snomedCode}
          display={result.name}
          semanticTag="observable entity"
          onSelect={({ code, display }) => upd({
            snomedCode: code || undefined,
            ...(display ? { name: display } : {}),
          })}
        />
        <div className="flex gap-1">
          <Field label="Value" value={result.value ?? ''} onChange={v => upd({ value: v })} className="flex-1" />
          <Field label="Unit" value={result.unit ?? ''} onChange={v => upd({ unit: v })} className="w-20" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Ref range low" value={result.referenceRangeLow ?? ''} onChange={v => upd({ referenceRangeLow: v })} />
        <Field label="Ref range high" value={result.referenceRangeHigh ?? ''} onChange={v => upd({ referenceRangeHigh: v })} />
        <SelectField
          label="Interpretation"
          value={result.interpretation ?? ''}
          onChange={v => upd({ interpretation: v })}
          options={INTERPRETATION_OPTS}
          placeholder="— Select —"
        />
        <Field label="Comment" value={result.comment ?? ''} onChange={v => upd({ comment: v })} />
      </div>
      <div className="flex justify-end mt-1">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'REMOVE_INVESTIGATION_RESULT',
              payload: { invTempId, resultTempId: result._tempId },
            })
          }
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity"
        >
          Remove result
        </button>
      </div>
    </div>
  )
}

function InvestigationCard({
  inv,
  draft,
  dispatch,
}: {
  inv: DraftInvestigation
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftInvestigation>) =>
    dispatch({ type: 'UPDATE_INVESTIGATION', payload: { _tempId: inv._tempId, updates } })

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
            {inv.name || 'New investigation'}
          </span>
          {inv.date && <span className="text-xs text-nhs-grey-3">{inv.date}</span>}
          <span className="text-xs text-nhs-grey-3">({inv.results.length} results)</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_INVESTIGATION', payload: inv._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <Field label="Test name" value={inv.name ?? ''} onChange={v => upd({ name: v })} required />
          <SnomedPicker
            code={inv.snomedCode}
            display={inv.name}
            semanticTag="observable entity"
            onSelect={({ code, display }) => upd({
              snomedCode: code || undefined,
              ...(display ? { name: display } : {}),
            })}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SelectField
              label="Status"
              value={inv.status ?? ''}
              onChange={v => upd({ status: v })}
              options={DIAG_STATUS_OPTS}
              placeholder="— Select —"
              required
            />
            <Field label="Date" type="date" value={inv.date ?? ''} onChange={v => upd({ date: v })} required />
            <PractitionerSelect
              label="Performer"
              draft={draft}
              value={inv.performerTempId}
              onChange={v => upd({ performerTempId: v })}
            />
          </div>

          {/* Results */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
                Results ({inv.results.length})
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'ADD_INVESTIGATION_RESULT', payload: inv._tempId })}
                className="text-xs text-nhs-blue hover:underline"
              >
                + Add result
              </button>
            </div>
            {inv.results.map(result => (
              <ResultRow key={result._tempId} result={result} invTempId={inv._tempId} dispatch={dispatch} />
            ))}
            {inv.results.length === 0 && (
              <p className="text-xs text-nhs-grey-3">No results added yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function InvestigationForm({ draft, dispatch }: Props) {
  return (
    <div>
      {draft.investigations.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No investigations added yet.</p>
      )}
      {draft.investigations.map(inv => (
        <InvestigationCard key={inv._tempId} inv={inv} draft={draft} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_INVESTIGATION' })}
        className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
      >
        + Add investigation
      </button>
    </div>
  )
}
