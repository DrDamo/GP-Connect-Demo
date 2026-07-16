import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useOnboarding } from './OnboardingContext'
import { TOURS } from './tourDefinitions'
import type { OnboardingTab } from './tourDefinitions'

interface Props {
  currentTab: OnboardingTab
  setTab: (tab: OnboardingTab) => void
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 6

export function TourOverlay({ currentTab, setTab }: Props) {
  const { activeTour, activeStepIndex, nextStep, prevStep, skipTour } = useOnboarding()
  const [rect, setRect] = useState<Rect | null>(null)

  const tour = activeTour ? TOURS[activeTour] : null
  const step = tour ? tour.steps[activeStepIndex] : null

  const measure = useCallback(() => {
    if (!step) { setRect(null); return }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step])

  // Switch tab if this step requires one, then poll briefly for the target to mount.
  useEffect(() => {
    if (!step) return
    if (step.tab && step.tab !== currentTab) {
      setTab(step.tab)
    }
  }, [step, currentTab, setTab])

  useEffect(() => {
    if (!step) { setRect(null); return }
    let cancelled = false
    let attempts = 0
    const tryMeasure = () => {
      if (cancelled) return
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el) {
        measure()
      } else if (attempts < 20) {
        attempts += 1
        requestAnimationFrame(tryMeasure)
      } else {
        // Target never appeared (e.g. empty domain, hidden feature) — skip this step.
        nextStep()
      }
    }
    tryMeasure()
    return () => { cancelled = true }
  }, [step, measure, nextStep])

  useEffect(() => {
    if (!rect) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [rect, measure])

  useEffect(() => {
    if (!tour) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skipTour() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour, skipTour])

  if (!tour || !step || !rect) return null

  const isLast = activeStepIndex === tour.steps.length - 1

  const popoverStyle: React.CSSProperties = (() => {
    const placement = step.placement ?? 'bottom'
    const gap = 12
    switch (placement) {
      case 'top': return { left: rect.left, top: Math.max(8, rect.top - gap), transform: 'translateY(-100%)' }
      case 'left': return { left: Math.max(8, rect.left - gap), top: rect.top, transform: 'translateX(-100%)' }
      case 'right': return { left: rect.left + rect.width + gap, top: rect.top }
      default: return { left: rect.left, top: rect.top + rect.height + gap }
    }
  })()

  return createPortal(
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* 4-rect dimmed curtain with a spotlight cutout around the target */}
      <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }} onClick={skipTour} />
      <div className="absolute bg-black/50" style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} onClick={skipTour} />
      <div className="absolute bg-black/50" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} onClick={skipTour} />
      <div className="absolute bg-black/50" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} onClick={skipTour} />
      <div
        className="absolute rounded-lg ring-2 ring-nhs-blue pointer-events-none"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />

      <div
        className="absolute w-72 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-nhs-grey-4 dark:border-gray-700 p-4"
        style={popoverStyle}
      >
        <p className="text-[11px] font-semibold text-nhs-blue uppercase tracking-wide mb-1">
          Step {activeStepIndex + 1} of {tour.steps.length}
        </p>
        <h4 className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100 mb-1">{step.title}</h4>
        <p className="text-xs text-nhs-grey-2 dark:text-gray-300 leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between">
          <button onClick={skipTour} className="text-xs text-nhs-grey-3 dark:text-gray-500 hover:underline">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {activeStepIndex > 0 && (
              <button onClick={prevStep} className="text-xs px-2.5 py-1.5 rounded border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 hover:border-nhs-blue hover:text-nhs-blue">
                Back
              </button>
            )}
            <button onClick={nextStep} className="text-xs px-2.5 py-1.5 rounded bg-nhs-blue text-white font-medium hover:bg-nhs-dark-blue">
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
