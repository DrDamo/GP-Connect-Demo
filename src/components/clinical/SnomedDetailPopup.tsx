import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredDropdown, widenDropdown } from '../../hooks/useAnchoredDropdown'
import { fetchSnomedDetail } from '../../fhir/snomedLookup'
import type { SnomedDetail, CodeStatus } from '../../fhir/types'
import { CodeStatusBadge } from './DomainTable'

const SNOMED_SYSTEM = 'http://snomed.info/sct'

type LookupState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: SnomedDetail }

function ActiveIndicator({ inactive }: { inactive?: boolean }) {
  if (inactive === undefined) return null
  return inactive ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-nhs-grey-2 dark:text-gray-400">
      <span className="w-2 h-2 rounded-full bg-nhs-grey-3 dark:bg-gray-500" />
      Inactive
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      Active
    </span>
  )
}

// Shared popup body for both trigger mechanisms: hovering a code in the
// Clinical view (SnomedCodeChip below) and the "Lookup SNOMED Code" option
// on a numbers-only text selection in the raw source view (RawSourceViewer).
export function SnomedDetailContent({ code, state, onClose }: { code: string; state: LookupState; onClose?: () => void }) {
  const body = (() => {
    if (state.status === 'loading') {
      return <div className="p-3 text-xs text-nhs-grey-3 dark:text-gray-400">Looking up {code}…</div>
    }
    if (state.status === 'error') {
      return <div className="p-3 text-xs text-red-700 dark:text-red-400">{state.message}</div>
    }
    const { detail } = state
    const fsn = detail.designations.find(d => d.use?.toLowerCase().includes('fully specified'))
    // The terminology server returns one designation per language dialect —
    // several of which are often the identical term repeated (e.g. the same
    // preferred term for en-GB and en-US) — dedupe by term text so "all
    // synonyms" doesn't mean the same word five times.
    const seen = new Set<string>(fsn ? [fsn.value] : [])
    const synonyms = detail.designations.filter(d => {
      if (seen.has(d.value)) return false
      seen.add(d.value)
      return true
    })
    return (
      <div className="p-3 text-xs text-nhs-grey-1 dark:text-gray-200 space-y-2.5 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-nhs-grey-3 dark:text-gray-400">{detail.code}</span>
          <ActiveIndicator inactive={detail.inactive} />
        </div>
        {detail.resolvedFromDescriptionId && (
          <div className="text-[10px] text-nhs-grey-3 dark:text-gray-500 italic">
            Resolved from description ID {detail.resolvedFromDescriptionId} to its concept
          </div>
        )}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-nhs-grey-3 dark:text-gray-500 mb-0.5">
            Fully specified name
          </div>
          <div className="font-medium">{fsn?.value ?? detail.display}</div>
        </div>
        {synonyms.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-nhs-grey-3 dark:text-gray-500 mb-0.5">
              Synonyms
            </div>
            <ul className="space-y-1">
              {synonyms.map((d, i) => (
                <li key={i}>
                  {d.value}
                  {d.use && <span className="text-nhs-grey-3 dark:text-gray-500"> ({d.use})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {detail.attributes.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-nhs-grey-3 dark:text-gray-500 mb-0.5">
              Attributes
            </div>
            <ul className="space-y-0.5">
              {detail.attributes.map((a, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span className="text-nhs-grey-2 dark:text-gray-300 min-w-0">{a.attributeName}</span>
                  <span className="text-right shrink-0">{a.valueDisplay ?? a.valueCode ?? a.valueNumber}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={() => window.open(`https://termbrowser.nhs.uk/?perspective=full&conceptId1=${detail.code}`, '_blank', 'noopener,noreferrer')}
          className="mt-1 w-full text-center px-2 py-1.5 rounded border border-nhs-blue text-nhs-blue text-xs font-medium hover:bg-nhs-blue hover:text-white transition-colors"
        >
          View in SNOMED CT Browser ↗
        </button>
      </div>
    )
  })()

  if (!onClose) return body

  return (
    <div className="relative">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded text-nhs-grey-3 hover:bg-nhs-grey-5 hover:text-nhs-grey-1 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        ✕
      </button>
      {body}
    </div>
  )
}

// Clinical-view replacement for a plain `<span className="font-mono">{code}</span>`
// SNOMED/dm+d code — hovering reveals terminology detail fetched from the
// server, positioned via a portal (see useAnchoredDropdown) so it isn't
// clipped by a scrollable ancestor, matching DegradeBadge's pattern.
export function SnomedCodeChip({ code, system = SNOMED_SYSTEM, status }: { code: string; system?: string; status?: CodeStatus }) {
  const [open, setOpen] = useState(false)
  const [lookup, setLookup] = useState<LookupState>({ status: 'loading' })

  const anchorRef = useRef<HTMLSpanElement>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Aborts any still-in-flight lookup when a new hover session starts, so a
  // slow response from an earlier hover can never land after (and overwrite)
  // a newer one — same fix as SnomedPicker's search race condition.
  const abortRef = useRef<AbortController | null>(null)

  const pos = useAnchoredDropdown(anchorRef, open)

  const cancelHide = () => {
    if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null }
  }
  const scheduleHide = () => {
    cancelHide()
    hideTimeoutRef.current = setTimeout(() => setOpen(false), 200)
  }

  const handleEnter = () => {
    cancelHide()
    setOpen(true)
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    // Short delay before actually dispatching the request — skips the call
    // entirely for a quick mouse pass-over, not just a debounce on typing.
    fetchTimeoutRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLookup({ status: 'loading' })
      fetchSnomedDetail(code, system, controller.signal)
        .then(detail => { if (abortRef.current === controller) setLookup({ status: 'ready', detail }) })
        .catch((e: Error) => {
          if (e.name === 'AbortError') return
          if (abortRef.current === controller) setLookup({ status: 'error', message: e.message })
        })
    }, 150)
  }

  useEffect(() => () => {
    cancelHide()
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    abortRef.current?.abort()
  }, [])

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={handleEnter}
        onMouseLeave={scheduleHide}
        className="font-mono cursor-help border-b border-dotted border-nhs-grey-3 dark:border-gray-500"
      >
        {code}
      </span>
      <CodeStatusBadge status={status} />
      {open && pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: widenDropdown(pos, 340) }}
          className="z-50 rounded-md border border-nhs-grey-4 bg-white shadow-lg dark:border-nhs-grey-2 dark:bg-gray-800"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <SnomedDetailContent code={code} state={lookup} />
        </div>,
        document.body,
      )}
    </>
  )
}
