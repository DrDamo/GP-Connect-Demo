import type React from 'react'

// ---------------------------------------------------------------------------
// FormField — labeled wrapper
// ---------------------------------------------------------------------------

export interface FormFieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, children, className }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-nhs-grey-3 dark:text-nhs-grey-4 uppercase tracking-wide mb-0.5">
        {label}
        {required && <span className="text-nhs-red ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field — labeled input shorthand
// ---------------------------------------------------------------------------

const INPUT_CLS =
  'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
  'text-nhs-grey-1 dark:text-nhs-grey-5 dark:bg-gray-800 ' +
  'focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'

export interface FieldProps {
  label: string
  type?: 'text' | 'date' | 'number' | 'email' | 'tel'
  value?: string | number
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  className,
}: FieldProps) {
  return (
    <FormField label={label} required={required} className={className}>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={INPUT_CLS}
      />
    </FormField>
  )
}
