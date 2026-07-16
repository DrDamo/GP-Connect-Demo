import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
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
  } catch {}
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

  // Load per-user progress from Supabase on login.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return
    let cancelled = false
    ;(async () => {
      const [{ data: tourRows }, { data: hintRows }] = await Promise.all([
        supabase!.from('user_tour_progress').select('tour_id').eq('user_id', user.id),
        supabase!.from('user_hint_dismissals').select('hint_id').eq('user_id', user.id),
      ])
      if (cancelled) return
      if (tourRows) setCompletedTours(new Set(tourRows.map((r: { tour_id: string }) => r.tour_id)))
      if (hintRows) setDismissedHints(new Set(hintRows.map((r: { hint_id: string }) => r.hint_id)))
    })()
    return () => { cancelled = true }
  }, [user])

  const isTourCompleted = useCallback((tourId: TourId) => completedTours.has(tourId), [completedTours])
  const isHintDismissed = useCallback((hintId: string) => dismissedHints.has(hintId), [dismissedHints])

  const markTourCompleted = useCallback((tourId: TourId) => {
    setCompletedTours(prev => {
      const next = new Set(prev)
      next.add(tourId)
      if (!isSupabaseConfigured) writeLocalSet(LOCAL_TOURS_KEY, next)
      return next
    })
    if (isSupabaseConfigured && supabase && user) {
      supabase.from('user_tour_progress').insert({ user_id: user.id, tour_id: tourId }).then(() => {})
    }
  }, [user])

  const startTour = useCallback((tourId: TourId) => {
    setActive(prev => (prev ? prev : { tourId, stepIndex: 0 }))
  }, [])

  const restartTour = useCallback((tourId: TourId) => {
    setCompletedTours(prev => {
      const next = new Set(prev)
      next.delete(tourId)
      if (!isSupabaseConfigured) writeLocalSet(LOCAL_TOURS_KEY, next)
      return next
    })
    if (isSupabaseConfigured && supabase && user) {
      supabase.from('user_tour_progress').delete().eq('user_id', user.id).eq('tour_id', tourId).then(() => {})
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
      if (!isSupabaseConfigured) writeLocalSet(LOCAL_HINTS_KEY, next)
      return next
    })
    if (isSupabaseConfigured && supabase && user) {
      supabase.from('user_hint_dismissals').insert({ user_id: user.id, hint_id: hintId }).then(() => {})
    }
  }, [user])

  const resetAllHints = useCallback(() => {
    const ids = [...dismissedHints]
    setDismissedHints(new Set())
    if (!isSupabaseConfigured) writeLocalSet(LOCAL_HINTS_KEY, new Set())
    if (isSupabaseConfigured && supabase && user && ids.length > 0) {
      supabase.from('user_hint_dismissals').delete().eq('user_id', user.id).then(() => {})
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
