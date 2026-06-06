// ---------------------------------------------------------------------------
// SelectField — labeled <select> with NHS styling
// ---------------------------------------------------------------------------

const SELECT_CLS =
  'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
  'text-nhs-grey-1 dark:text-nhs-grey-5 dark:bg-gray-800 ' +
  'focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'

export interface SelectFieldProps {
  label: string
  value?: string
  onChange: (val: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: SelectFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-nhs-grey-3 dark:text-nhs-grey-4 uppercase tracking-wide mb-0.5">
        {label}
        {required && <span className="text-nhs-red ml-0.5">*</span>}
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        required={required}
        className={SELECT_CLS}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
