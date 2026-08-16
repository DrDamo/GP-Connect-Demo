import { useEffect, useRef, useState } from 'react'
import { FormField, INPUT_CLS } from './FormField'

// ---------------------------------------------------------------------------
// DateField — FHIR partial-date input
//
// Accepts no date, year only (YYYY), month+year (YYYY-MM) or a full date
// (YYYY-MM-DD) — the value set FHIR's `date`/`dateTime` types allow — typed
// directly or via the native calendar picker (which always fills a full
// date). Only valid partial dates (or empty) are propagated to onChange;
// invalid text stays local and is flagged until corrected.
// ---------------------------------------------------------------------------

export interface DateFieldProps {
  label: string
  value?: string
  onChange: (val: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
}

function isValidPartialDate(s: string): boolean {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(s)
  if (!m) return false
  const year = Number(m[1])
  if (year < 1000 || year > 2999) return false
  if (m[2] !== undefined) {
    const month = Number(m[2])
    if (month < 1 || month > 12) return false
    if (m[3] !== undefined) {
      const day = Number(m[3])
      if (day < 1 || day > new Date(year, month, 0).getDate()) return false
    }
  }
  return true
}

// Tidy near-miss input: "2020/5/6" → "2020-05-06", "2020-1" → "2020-01"
function normalise(s: string): string {
  const parts = s.trim().replace(/[/.]/g, '-').split('-').filter(Boolean)
  if (parts.length === 0 || parts.length > 3) return s.trim()
  if (!/^\d{4}$/.test(parts[0])) return s.trim()
  return parts
    .map((p, i) => (i > 0 && /^\d$/.test(p) ? `0${p}` : p))
    .join('-')
}

export function DateField({ label, value, onChange, required, disabled, className }: DateFieldProps) {
  const [text, setText] = useState(value ?? '')
  const pickerRef = useRef<HTMLInputElement>(null)

  // External changes (status toggles clearing a date, draft reload) win over
  // any uncommitted local text.
  useEffect(() => {
    setText(value ?? '')
  }, [value])

  const invalid = text !== '' && !isValidPartialDate(text)

  const commit = (raw: string) => {
    setText(raw)
    if (raw === '' || isValidPartialDate(raw)) onChange(raw)
  }

  const handleBlur = () => {
    if (text === '' || isValidPartialDate(text)) return
    const tidied = normalise(text)
    if (isValidPartialDate(tidied)) commit(tidied)
  }

  const openPicker = () => {
    const picker = pickerRef.current
    if (!picker) return
    // Seed the picker with the current value where it's a full date so the
    // calendar opens on it; partial dates open on today instead.
    picker.value = isValidPartialDate(text) && text.length === 10 ? text : ''
    if (typeof picker.showPicker === 'function') picker.showPicker()
    else picker.click()
  }

  return (
    <FormField label={label} required={required && !disabled} className={className}>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={e => commit(e.target.value)}
          onBlur={handleBlur}
          placeholder="YYYY-MM-DD"
          required={required && !disabled}
          disabled={disabled}
          pattern="\d{4}(-\d{2}(-\d{2})?)?"
          title="Enter a year (YYYY), month (YYYY-MM) or full date (YYYY-MM-DD)"
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
        {/* Hidden native input drives the calendar popup only; its value is
            transferred to the text input on selection. */}
        <input
          ref={pickerRef}
          type="date"
          onChange={e => { if (e.target.value) commit(e.target.value) }}
          className="sr-only absolute bottom-0 right-0 w-px h-px"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {invalid && (
        <p className="mt-0.5 text-xs text-nhs-red">Use YYYY, YYYY-MM or YYYY-MM-DD</p>
      )}
    </FormField>
  )
}
