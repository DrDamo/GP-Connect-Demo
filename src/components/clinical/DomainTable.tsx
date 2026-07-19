import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'
import { SNOMED_SYSTEM } from '../../fhir/snomedDegrade'
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown'

export interface DomainColumn<T> {
  label: string
  className?: string
  render: (item: T) => React.ReactNode
}

const STATUS_CLASSES: Record<string, string> = {
  active:             'bg-green-100 text-green-800 border-green-300',
  confirmed:          'bg-green-100 text-green-800 border-green-300',
  completed:          'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4',
  resolved:           'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4',
  inactive:           'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4',
  cancelled:          'bg-red-100 text-red-800 border-red-300',
  'entered-in-error': 'bg-red-100 text-red-800 border-red-300',
  stat:               'bg-red-100 text-red-800 border-red-300',
  draft:              'bg-blue-100 text-blue-800 border-blue-300',
  intended:           'bg-blue-100 text-blue-800 border-blue-300',
  'not-done':         'bg-yellow-100 text-yellow-800 border-yellow-300',
  'on-hold':          'bg-yellow-100 text-yellow-800 border-yellow-300',
  urgent:             'bg-orange-100 text-orange-800 border-orange-300',
  asap:               'bg-orange-100 text-orange-800 border-orange-300',
}

const FALLBACK_CLASS = 'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4'

export function StatusBadge({ value }: { value: string }) {
  const key = value.toLowerCase()
  const cls = STATUS_CLASSES[key] ?? FALLBACK_CLASS
  const label = value.charAt(0).toUpperCase() + value.slice(1)
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${cls}`}>
      {label}
    </span>
  )
}

// Tags any item carrying a NOPAT security label (see src/fhir/utils.ts hasNopatSecurity) —
// shown wherever the record was withheld from patient-facing services.
export function NotForPfsBadge() {
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-semibold rounded border bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700"
      title="Tagged with a NOPAT security label — withheld from patient-facing services"
    >
      Not for PFS
    </span>
  )
}

// Matches the marker degradeCoding() (src/fhir/snomedDegrade.ts) appends to
// CodeableConcept.text when a SNOMED CT concept ID can't be verified — kept
// in the FHIR text itself so the original code/term survives even outside
// this app, and parsed back out here purely for display styling.
const DEGRADED_TEXT_PATTERN = /^(.*) \(degraded from SNOMED CT (\d+)\)$/

// Amber "Degrade" tag — matches the pre-existing badge used elsewhere for
// GP2GP records that arrived already degraded (see CodedDataView.tsx /
// InvestigationsView.tsx), reused here for codes THIS app degraded on
// import. Hovering it reveals the original coding; positioned via a portal
// (position: fixed, viewport coordinates from useAnchoredDropdown) so it
// isn't clipped by an ancestor with overflow:hidden/auto — a plain
// `position: absolute` tooltip was getting cut off inside scrollable panels.
function DegradeBadge({ originalCode, originalTerm }: { originalCode: string; originalTerm: string }) {
  const [hovered, setHovered] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const pos = useAnchoredDropdown(anchorRef, hovered)

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-block ml-1.5 cursor-help text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium leading-none align-middle"
      >
        Degrade
      </span>
      {hovered && pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="pointer-events-none z-50 w-80 rounded-md border border-nhs-grey-4 bg-white p-2.5 text-xs font-normal leading-snug text-nhs-grey-1 shadow-lg dark:border-nhs-grey-2 dark:bg-gray-800 dark:text-gray-200"
        >
          <span className="block font-semibold text-nhs-grey-1 dark:text-gray-100">Original coding, before conversion</span>
          <span className="mt-1 block">This SNOMED CT code could not be verified against the terminology server, so it was converted to a transfer-degraded coding:</span>
          <pre className="mt-1.5 whitespace-pre-wrap rounded border border-nhs-grey-4 bg-nhs-grey-5 p-1.5 font-mono text-[11px] text-nhs-grey-1 dark:border-nhs-grey-2 dark:bg-gray-900 dark:text-gray-200">
{JSON.stringify({ system: SNOMED_SYSTEM, code: originalCode, display: originalTerm }, null, 2)}
          </pre>
        </div>,
        document.body
      )}
    </>
  )
}

// Renders a display string plain (same colour as everything else) when it
// carries the transfer-degrade marker, with a "Degrade" tag alongside it —
// lets users tell a converted code apart from one that was always this way,
// and recover the original code via the tag's hover tooltip.
export function DegradedTermText({ text }: { text?: string }) {
  if (!text) return <>{text}</>
  const match = text.match(DEGRADED_TEXT_PATTERN)
  if (!match) return <>{text}</>
  const [, originalTerm, originalCode] = match
  return (
    <>
      {originalTerm}
      <DegradeBadge originalCode={originalCode} originalTerm={originalTerm} />
    </>
  )
}

export function DomainTable<T extends { id: string; notForPfs?: boolean }>({
  columns,
  items,
  selectedId,
  onSelect,
  emptyMessage = 'No records found',
  expandedContent,
}: {
  columns: DomainColumn<T>[]
  items: T[]
  selectedId?: string
  onSelect?: (id: string) => void
  emptyMessage?: string
  expandedContent?: (item: T) => React.ReactNode
}) {
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (selectedId && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedId])

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-nhs-grey-3">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  // Auto-added to every domain table (rather than each view defining its own)
  // so "Not for PFS" tagging stays consistent — only shown when at least one
  // row actually has it, so tables with no NOPAT items are unaffected.
  const showNotForPfsColumn = items.some(item => item.notForPfs)
  const effectiveColumns: DomainColumn<T>[] = showNotForPfsColumn
    ? [...columns, { label: '', className: 'w-px whitespace-nowrap', render: item => item.notForPfs ? <NotForPfsBadge /> : null }]
    : columns

  return (
    <div className="border border-nhs-grey-5 rounded-lg overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-nhs-grey-5 text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
            {effectiveColumns.map((col, idx) => (
              <th key={col.label || `col-${idx}`} className={`py-2 px-3 ${col.className ?? ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const isSelected = item.id === selectedId
            return (
              <Fragment key={item.id}>
                <tr
                  ref={isSelected ? selectedRowRef : undefined}
                  onClick={() => onSelect?.(item.id)}
                  className={`transition-colors ${
                    isSelected && expandedContent ? '' : 'border-b border-nhs-grey-5'
                  } ${
                    onSelect ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-blue-50'
                      : onSelect
                        ? 'hover:bg-blue-50'
                        : ''
                  }`}
                >
                  {effectiveColumns.map((col, idx) => (
                    <td key={col.label || `col-${idx}`} className={`py-2.5 px-3 text-sm text-nhs-grey-2 ${col.className ?? ''}`}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
                {isSelected && expandedContent && (
                  <tr className="border-b border-nhs-grey-5">
                    <td colSpan={effectiveColumns.length} className="px-3 pb-3 pt-0">
                      {expandedContent(item)}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
