import { useState } from 'react'
import type React from 'react'

// ---------------------------------------------------------------------------
// FormSection — collapsible NHS-styled card section
// ---------------------------------------------------------------------------

export interface FormSectionProps {
  title: string
  count?: number
  children: React.ReactNode
  defaultOpen?: boolean
}

export function FormSection({ title, count, children, defaultOpen = true }: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-nhs-grey-5 dark:bg-gray-800 hover:bg-nhs-grey-4 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-nhs-grey-1 dark:text-nhs-grey-5">{title}</span>
          {count !== undefined && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-nhs-blue text-white">
              {count}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-nhs-grey-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-4 bg-white dark:bg-gray-900">
          {children}
        </div>
      )}
    </div>
  )
}
