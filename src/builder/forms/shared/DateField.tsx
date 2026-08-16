import { useEffect, useRef, useState } from 'react'
import { FormField, INPUT_CLS } from './FormField'

// ---------------------------------------------------------------------------
// DateField — UK-format partial date input
//
// Displays and accepts UK order (DD-MM-YYYY), with the shorter precisions
// FHIR date/dateTime allow:
//   (blank)      → no date
//   YYYY         → year only          e.g. 2027
//   MM-YYYY      → month and year     e.g. 03-2027
//   DD-MM-YYYY   → full date          e.g. 16-08-2026
//
// Values are stored ISO ("2027", "2027-03", "2026-08-16") so the generated
// FHIR keeps the precision the user actually entered. Separators -, / and .
// are interchangeable on entry, and ISO input is accepted too (a 4-digit
// leading part is unambiguously a year), so pasted ISO dates still work.
// ---------------------------------------------------------------------------

export interface DateFieldProps {
  label: string
  value?: string
  onChange: (val: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
}

const pad = (s: string) => (s.length === 1 ? `0${s}` : s)

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Parse user text into an ISO partial date. Returns null when unparseable.
export function parseToIso(input: string): string | null {
  const text = input.trim()
  if (text === '') return ''

  const parts = text.split(/[-/. ]+/).filter(Boolean)
  if (parts.length === 0 || parts.length > 3) return null
  if (!parts.every(p => /^\d{1,4}$/.test(p))) return null

  // A 4-digit leading part means ISO order was typed; otherwise UK order.
  const isoOrder = parts[0].length === 4
  let year: string, month: string | undefined, day: string | undefined
  if (isoOrder) {
    [year, month, day] = parts
  } else {
    if (parts.length === 1) return null // a bare 1-2 digit number isn't a date
    const last = parts[parts.length - 1]
    if (last.length !== 4) return null  // year must be 4 digits
    year = last
    if (parts.length === 2) month = parts[0]
    else { day = parts[0]; month = parts[1] }
  }

  if (!/^\d{4}$/.test(year)) return null
  const y = Number(year)
  if (y < 1000 || y > 2999) return null
  if (month === undefined) return year

  const m = Number(month)
  if (!Number.isInteger(m) || m < 1 || m > 12) return null
  if (day === undefined) return `${year}-${pad(String(m))}`

  const d = Number(day)
  if (!Number.isInteger(d) || d < 1 || d > daysInMonth(y, m)) return null
  return `${year}-${pad(String(m))}-${pad(String(d))}`
}

// Render a stored ISO partial date in UK order for display.
export function isoToDisplay(iso: string | undefined): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[1]}-${parts[0]}`
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

export function DateField({ label, value, onChange, required, disabled, className }: DateFieldProps) {
  const [text, setText] = useState(() => isoToDisplay(value ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  // Tracks the last value this field emitted, so edits made here don't get
  // reformatted mid-typing while genuine external changes (a status toggle
  // clearing the date, loading a draft) still refresh the display.
  const lastEmitted = useRef(value ?? '')

  useEffect(() => {
    const incoming = value ?? ''
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming
      setText(isoToDisplay(incoming))
    }
  }, [value])

  const parsed = parseToIso(text)
  const invalid = parsed === null

  // Unparseable text needs to block Save even when the field isn't marked
  // required — the `required` attribute alone only catches empty values.
  // setCustomValidity plugs into the same native constraint-validation pass
  // the modal's <form> submit runs, so a garbled date is treated the same
  // as a missing required one: submit is blocked and the browser focuses
  // this field with the message below.
  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? 'Enter DD-MM-YYYY, MM-YYYY or YYYY' : '')
  }, [invalid])

  const commit = (raw: string) => {
    setText(raw)
    const iso = parseToIso(raw)
    if (iso !== null && iso !== lastEmitted.current) {
      lastEmitted.current = iso
      onChange(iso)
    }
  }

  // Tidy valid input to canonical UK form once the user leaves the field;
  // unparseable text is left alone so the error stays visible and their
  // typing isn't thrown away.
  const handleBlur = () => {
    if (parsed) setText(isoToDisplay(parsed))
  }

  const openPicker = () => {
    const picker = pickerRef.current
    if (!picker) return
    picker.value = parsed && parsed.length === 10 ? parsed : ''
    if (typeof picker.showPicker === 'function') picker.showPicker()
    else picker.click()
  }

  return (
    <FormField label={label} required={required && !disabled} className={className}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={e => commit(e.target.value)}
          onBlur={handleBlur}
          placeholder="DD-MM-YYYY"
          required={required && !disabled}
          disabled={disabled}
          title="Enter DD-MM-YYYY, MM-YYYY for month and year, or YYYY for year only"
          className={`${INPUT_CLS} pr-8 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-nhs-grey-5 dark:disabled:bg-gray-800 ${
            invalid ? 'border-nhs-red focus:border-nhs-red focus:ring-nhs-red' : ''
          }`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          tabIndex={-1}
          title="Pick a date"
          aria-label={`Pick ${label.toLowerCase()} from calendar`}
          className="absolute inset-y-0 right-0 px-2 text-nhs-grey-3 hover:text-nhs-blue disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        {/* Hidden native input drives the calendar popup only; whatever the
            user picks is a full date, converted to UK display on commit. */}
        <input
          ref={pickerRef}
          type="date"
          onChange={e => { if (e.target.value) commit(isoToDisplay(e.target.value)) }}
          className="sr-only absolute bottom-0 right-0 w-px h-px"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {invalid && (
        <p className="mt-0.5 text-xs text-nhs-red">Use DD-MM-YYYY, MM-YYYY or YYYY</p>
      )}
    </FormField>
  )
}
