import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HINTS } from './hintContent'
import { useGuideNav } from './GuideNavContext'
import { useAnchoredDropdown } from '../hooks/useAnchoredDropdown'

interface Props {
  topic: keyof typeof HINTS | string
  className?: string
}

const TOOLTIP_WIDTH = 224 // px — matches the w-56 class below
const VIEWPORT_MARGIN = 8

export function InfoHint({ topic, className }: Props) {
  const [open, setOpen] = useState(false)
  const guideNav = useGuideNav()
  const hint = HINTS[topic]
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Rendered via a portal + viewport-fixed position (like Builder's SNOMED/dm+d
  // dropdowns) instead of `position: absolute` in the normal DOM flow — otherwise
  // an ancestor with `overflow: auto/hidden` (e.g. a horizontally-scrolling
  // results table) clips the tooltip instead of letting it float above everything.
  const anchorPos = useAnchoredDropdown(buttonRef, open)
  if (!hint) return null

  const left = anchorPos
    ? Math.min(
        Math.max(VIEWPORT_MARGIN, anchorPos.left + anchorPos.width / 2 - TOOLTIP_WIDTH / 2),
        window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN,
      )
    : 0

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      <button
        ref={buttonRef}
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
      {open && anchorPos && createPortal(
        <div
          id={`hint-${topic}`}
          role="tooltip"
          style={{ position: 'fixed', top: anchorPos.top, left }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="z-[900] w-56 bg-white dark:bg-gray-900 text-left rounded-lg shadow-lg border border-nhs-grey-4 dark:border-gray-700 p-3 not-italic font-normal normal-case"
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
        </div>,
        document.body,
      )}
    </span>
  )
}
