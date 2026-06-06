import { useState } from 'react'
import type { DraftRecord, DraftCodedDataItem } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'

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

function CodedDataCard({
  item,
  draft,
  dispatch,
}: {
  item: DraftCodedDataItem
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftCodedDataItem>) =>
    dispatch({ type: 'UPDATE_CODED_DATA', payload: { _tempId: item._tempId, updates } })

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
            {item.description || 'New coded data item'}
          </span>
          {item.date && (
            <span className="text-xs text-nhs-grey-3">{item.date}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_CODED_DATA', payload: item._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <Field label="Description" value={item.description ?? ''} onChange={v => upd({ description: v })} required />
          <SnomedPicker
            code={item.snomedCode}
            display={item.description}
            semanticTag="observable entity,finding"
            onSelect={({ code, display }) => upd({
              snomedCode: code || undefined,
              ...(display ? { description: display } : {}),
            })}
          />

          <div className="grid grid-cols-3 gap-2">
            <Field label="Date" type="date" value={item.date ?? ''} onChange={v => upd({ date: v })} />
            <Field label="Value" value={item.value ?? ''} onChange={v => upd({ value: v })} placeholder="120" />
            <Field label="Unit" value={item.unit ?? ''} onChange={v => upd({ unit: v })} placeholder="mmHg" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="Status"
              value={item.status ?? ''}
              onChange={v => upd({ status: v })}
              options={OBS_STATUS_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="Interpretation"
              value={item.interpretation ?? ''}
              onChange={v => upd({ interpretation: v })}
              options={INTERPRETATION_OPTS}
              placeholder="— Select —"
            />
            <Field label="Comment" value={item.comment ?? ''} onChange={v => upd({ comment: v })} />
          </div>

          <PractitionerSelect
            label="Performer"
            draft={draft}
            value={item.performerTempId}
            onChange={v => upd({ performerTempId: v })}
          />
        </div>
      )}
    </div>
  )
}

export function CodedDataForm({ draft, dispatch }: Props) {
  return (
    <div>
      {draft.codedData.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No coded data items added yet.</p>
      )}
      {draft.codedData.map(item => (
        <CodedDataCard key={item._tempId} item={item} draft={draft} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_CODED_DATA' })}
        className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
      >
        + Add coded data item
      </button>
    </div>
  )
}
