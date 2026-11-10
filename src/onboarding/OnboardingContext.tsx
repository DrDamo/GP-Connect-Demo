import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, isAuthEnabled } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { TOURS, type TourId } from './tourDefinitions'

const LOCAL_TOURS_KEY = 'gpc-tour-completed'
const LOCAL_HINTS_KEY = 'gpc-hint-dismissed'

function readLocalSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function writeLocalSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch { /* storage unavailable */ }
}

interface OnboardingContextValue {
  isTourCompleted: (tourId: TourId) => boolean
  activeTour: TourId | null
  activeStepIndex: number
  startTour: (tourId: TourId) => void
  restartTour: (tourId: TourId) => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  finishTour: () => void
  isHintDismissed: (hintId: string) => boolean
  dismissHint: (hintId: string) => void
  resetAllHints: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

// activeTour + activeStepIndex are kept as one state object, updated only via
// single, non-nested setState calls. Nesting a second setState call inside a
// setState updater function is unsafe: React (Strict Mode, dev) invokes
// updater functions twice to check for impurity, so a nested call fires
// twice too, silently double-advancing the step. See useOnboarding() below —
// activeTour/activeStepIndex are still exposed as separate fields so callers
// don't need to change.
interface ActiveTourState {
  tourId: TourId
  stepIndex: number
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [completedTours, setCompletedTours] = useState<Set<string>>(() => readLocalSet(LOCAL_TOURS_KEY))
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(() => readLocalSet(LOCAL_HINTS_KEY))
  const [active, setActive] = useState<ActiveTourState | null>(null)
  const activeTour = active?.tourId ?? null
  const activeStepIndex = active?.stepIndex ?? 0

  // Load per-user progress from the server on login.
  useEffect(() => {
    if (!isAuthEnabled || !user) return
    let cancelled = false
    api.get<{ tours: string[]; hints: string[] }>('/me/onboarding')
      .then(({ tours, hints }) => {
        if (cancelled) return
        setCompletedTours(new Set(tours))
        setDismissedHints(new Set(hints))
      })
      .catch(() => { /* keep the defaults; progress is a convenience */ })
    return () => { cancelled = true }
  }, [user])

  const isTourCompleted = useCallback((tourId: TourId) => completedTours.has(tourId), [completedTours])
  const isHintDismissed = useCallback((hintId: string) => dismissedHints.has(hintId), [dismissedHints])

  const markTourCompleted = useCallback((tourId: TourId) => {
    setCompletedTours(prev => {
      const next = new Set(prev)
      next.add(tourId)
      if (!isAuthEnabled) writeLocalSet(LOCAL_TOURS_KEY, next)
      return next
    })
    if (isAuthEnabled && user) {
      api.put(`/me/tours/${encodeURIComponent(tourId)}`).catch(() => {})
    }
  }, [user])

  const startTour = useCallback((tourId: TourId) => {
    setActive(prev => (prev ? prev : { tourId, stepIndex: 0 }))
  }, [])

  const restartTour = useCallback((tourId: TourId) => {
    setCompletedTours(prev => {
      const next = new Set(prev)
      next.delete(tourId)
      if (!isAuthEnabled) writeLocalSet(LOCAL_TOURS_KEY, next)
      return next
    })
    if (isAuthEnabled && user) {
      api.delete(`/me/tours/${encodeURIComponent(tourId)}`).catch(() => {})
    }
    setActive({ tourId, stepIndex: 0 })
  }, [user])

  // nextStep/skipTour/finishTour call markTourCompleted (itself a setState)
  // directly against the current `active` value from closure, rather than
  // from inside setActive's updater — see the ActiveTourState comment above
  // for why nesting a second setState call in there is unsafe.
  const nextStep = useCallback(() => {
    if (!active) return
    const steps = TOURS[active.tourId].steps
    if (active.stepIndex + 1 >= steps.length) {
      markTourCompleted(active.tourId)
      setActive(null)
    } else {
      setActive({ tourId: active.tourId, stepIndex: active.stepIndex + 1 })
    }
  }, [active, markTourCompleted])

  const prevStep = useCallback(() => {
    setActive(current => (current ? { ...current, stepIndex: Math.max(0, current.stepIndex - 1) } : current))
  }, [])

  const skipTour = useCallback(() => {
    if (active) markTourCompleted(active.tourId)
    setActive(null)
  }, [active, markTourCompleted])

  const finishTour = useCallback(() => {
    if (active) markTourCompleted(active.tourId)
    setActive(null)
  }, [active, markTourCompleted])

  const dismissHint = useCallback((hintId: string) => {
    setDismissedHints(prev => {
      const next = new Set(prev)
      next.add(hintId)
      if (!isAuthEnabled) writeLocalSet(LOCAL_HINTS_KEY, next)
      return next
    })
    if (isAuthEnabled && user) {
      api.put(`/me/hints/${encodeURIComponent(hintId)}`).catch(() => {})
    }
  }, [user])

  const resetAllHints = useCallback(() => {
    const ids = [...dismissedHints]
    setDismissedHints(new Set())
    if (!isAuthEnabled) writeLocalSet(LOCAL_HINTS_KEY, new Set())
    if (isAuthEnabled && user && ids.length > 0) {
      api.delete('/me/hints').catch(() => {})
    }
  }, [dismissedHints, user])

  return (
    <OnboardingContext.Provider
      value={{
        isTourCompleted, activeTour, activeStepIndex, startTour, restartTour,
        nextStep, prevStep, skipTour, finishTour, isHintDismissed, dismissHint, resetAllHints,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider')
  return ctx
}
