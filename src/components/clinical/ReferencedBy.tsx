import { useState } from 'react'
import type { GpConnectBundle, IncomingRef } from '../../fhir/types'
import type { DomainId } from './domains'
import { findRecordLocation } from './recordLocation'

const GROUP_PREVIEW = 25

interface Props {
  record: GpConnectBundle
  /** `Type/id` of the resource being shown */
  self: string | undefined
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

/** Lists the resources that reference this one — the reverse of
 * ReferencedResources. Grouped by resource type because some targets
 * (a Practitioner, an Encounter) are referenced hundreds of times. */
export function ReferencedBy({ record, self, onJumpToSource, onJumpToRecord }: Props) {
  const incoming = self ? record.incomingRefs?.[self] : undefined
  if (!incoming?.length) return null

  const groups = new Map<string, IncomingRef[]>()
  for (const r of incoming) {
    const g = groups.get(r.sourceType)
    if (g) g.push(r)
    else groups.set(r.sourceType, [r])
  }

  return (
    <div className="mt-4 pt-4 border-t border-nhs-grey-4 space-y-2">
      <p className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
        Referenced by ({incoming.length})
      </p>
      {[...groups.entries()].map(([type, refs]) => (
        <ReferencedByGroup
          key={type}
          type={type}
          refs={refs}
          record={record}
          onJumpToSource={onJumpToSource}
          onJumpToRecord={onJumpToRecord}
        />
      ))}
    </div>
  )
}

function ReferencedByGroup({ type, refs, record, onJumpToSource, onJumpToRecord }: {
  type: string
  refs: IncomingRef[]
  record: GpConnectBundle
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const [open, setOpen] = useState(refs.length <= 5)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? refs : refs.slice(0, GROUP_PREVIEW)

  return (
    <div className="rounded border border-nhs-grey-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-nhs-grey-1 hover:bg-nhs-grey-5"
      >
        <span className="font-medium">{type}</span>
        <span className="flex items-center gap-1.5 text-nhs-grey-3">
          {refs.length}
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>
      {open && (
        <ul className="border-t border-nhs-grey-4 divide-y divide-nhs-grey-5">
          {shown.map((r, i) => {
            const target = onJumpToRecord ? findRecordLocation(r, record) : undefined
            const canJump = !!target || (!!onJumpToSource && !!r.sourceId)
            const jump = () => {
              if (target) onJumpToRecord!(target.domain, target.id)
              else if (r.sourceId) onJumpToSource?.(r.sourceId)
            }
            return (
              <li key={`${r.sourceId}-${r.path}-${i}`} className="px-2.5 py-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-nhs-grey-1 break-words">
                    {r.label ?? <span className="italic text-nhs-grey-3">{type}</span>}
                    {r.contained && <span className="ml-1.5 text-[10px] text-nhs-grey-3">(contained)</span>}
                  </div>
                  <div className="font-mono text-[10px] text-nhs-grey-3 break-all">{r.path}</div>
                </div>
                {canJump && (
                  <button
                    type="button"
                    onClick={jump}
                    className="text-xs text-nhs-blue hover:underline shrink-0"
                    title={target ? 'Show in record' : 'Show FHIR source'}
                  >
                    {target ? 'View →' : 'FHIR ↗'}
                  </button>
                )}
              </li>
            )
          })}
          {refs.length > shown.length && (
            <li className="px-2.5 py-1.5">
              <button type="button" onClick={() => setShowAll(true)} className="text-xs text-nhs-blue hover:underline">
                Show all {refs.length}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
