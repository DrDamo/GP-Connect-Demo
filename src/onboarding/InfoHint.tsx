import { useState } from 'react'
import { HINTS } from './hintContent'
import { useGuideNav } from './GuideNavContext'

interface Props {
  topic: keyof typeof HINTS | string
  className?: string
}

export function InfoHint({ topic, className }: Props) {
  const [open, setOpen] = useState(false)
  const guideNav = useGuideNav()
  const hint = HINTS[topic]
  if (!hint) return null

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      <button
        type="button"
        tabIndex={0}
        aria-describedby={`hint-${topic}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={e => e.stopPropagation()}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[9px] leading-none opacity-60 hover:opacity-100 focus:opacity-100 focus:outline-none"
      >
        i
      </button>
      {open && (
        <div
          id={`hint-${topic}`}
          role="tooltip"
          className="absolute z-[900] left-1/2 -translate-x-1/2 top-full mt-1.5 w-56 bg-white dark:bg-gray-900 text-left rounded-lg shadow-lg border border-nhs-grey-4 dark:border-gray-700 p-3 not-italic font-normal normal-case"
        >
          <p className="text-xs font-semibold text-nhs-grey-1 dark:text-gray-100 mb-1">{hint.title}</p>
          <p className="text-xs text-nhs-grey-2 dark:text-gray-300 leading-relaxed mb-2">{hint.body}</p>
          {guideNav && (
            <button
              onClick={e => { e.stopPropagation(); guideNav.openGuide(hint.guideFile, hint.guideAnchor) }}
              className="text-xs text-nhs-blue hover:underline"
            >
              Learn more →
            </button>
          )}
        </div>
      )}
    </span>
  )
}
