import { useState, useRef, useEffect } from 'react'
import { useOnboarding } from './OnboardingContext'
import { TOURS, type TourId } from './tourDefinitions'
import type { OnboardingTab } from './tourDefinitions'

const TAB_TO_TOUR: Partial<Record<OnboardingTab | 'home', TourId>> = {
  home: 'home',
  clinical: 'clinical-view',
  inspector: 'inspector',
  builder: 'builder',
}

interface Props {
  // 'home' represents the landing/get-started screen, shown whenever no
  // bundle is loaded — distinct from the `tab` state, which keeps its last
  // value (e.g. 'clinical') while the home screen is visible.
  currentTab: OnboardingTab | 'home'
  onOpenGuide: () => void
}

export function HelpMenu({ currentTab, onOpenGuide }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { restartTour } = useOnboarding()
  const tourForTab = TAB_TO_TOUR[currentTab]

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref} data-tour="header-help">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-white opacity-70 hover:opacity-100 border border-white/40 hover:border-white/80 p-1.5 rounded transition-all"
        title="Help"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.451.999-1.451 1.827v.5m.75 3h.008v.008h-.008V16.5zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-900 text-nhs-grey-1 dark:text-gray-100 rounded-lg shadow-xl border border-nhs-grey-4 dark:border-gray-700 py-1 z-50">
          {tourForTab && (
            <button
              onClick={() => { setOpen(false); restartTour(tourForTab) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-nhs-grey-5 dark:hover:bg-gray-800"
            >
              Restart tour: {TOURS[tourForTab].label}
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onOpenGuide() }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-nhs-grey-5 dark:hover:bg-gray-800"
          >
            Open App Guide
          </button>
        </div>
      )}
    </div>
  )
}
