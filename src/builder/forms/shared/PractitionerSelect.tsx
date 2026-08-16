import type { DraftRecord } from '../../types'

// ---------------------------------------------------------------------------
// PractitionerSelect — select from draft.practitioners
// ---------------------------------------------------------------------------

const SELECT_CLS =
  'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
  'text-nhs-grey-1 dark:bg-gray-800 ' +
  'focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'

export interface PractitionerSelectProps {
  label: string
  draft: DraftRecord
  value?: string
  onChange: (tempId: string | undefined) => void
  required?: boolean
}

export function PractitionerSelect({ label, draft, value, onChange, required }: PractitionerSelectProps) {
  const options = [
    { value: '', label: '— None —' },
    ...draft.practitioners.map(p => ({
      value: p._tempId,
      label: [p.prefix, p.givenName, p.familyName].filter(Boolean).join(' ') || 'Unnamed',
    })),
  ]

  return (
    <div>
      <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">
        {label}
        {required && <span className="text-nhs-red ml-0.5">*</span>}
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || undefined)}
        required={required}
        className={SELECT_CLS}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {required && draft.practitioners.length === 0 && (
        <p className="mt-0.5 text-xs text-nhs-red">No practitioners yet — add one in Admin first</p>
      )}
    </div>
  )
}
