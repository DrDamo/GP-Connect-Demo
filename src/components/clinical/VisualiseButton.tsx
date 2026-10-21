import { useMemo, useState } from 'react'
import type * as fhir3 from 'fhir/r3'
import type { RelationshipGraph } from '../../fhir/relationshipGraph'
import type { GpConnectBundle } from '../../fhir/types'
import type { DomainId } from './domains'
import { RelationshipVisualiser } from './RelationshipVisualiser'

interface Props {
  record: GpConnectBundle
  /** Builds the graph on first open; returns undefined if the resource can't be found */
  build: (fhir: fhir3.Bundle) => RelationshipGraph | undefined
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  className?: string
}

/** Opens the relationship visualiser. Hidden for records with no source
 * Bundle attached (e.g. the builder's preview). */
export function VisualiseButton({ record, build, onJumpToSource, onJumpToRecord, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  // Built only once opened, then kept for this record.
  const graph = useMemo(() => (open && record.fhir ? build(record.fhir) : undefined), [open, record.fhir]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!record.fhir) return null
  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        title="Show how this connects to other resources"
        className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-nhs-grey-4 bg-white text-nhs-grey-2 hover:border-nhs-blue hover:text-nhs-blue dark:hover:border-accent dark:hover:text-accent ${className}`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" />
          <path d="M8.3 6.4l7.4.4M7.2 8.2l3.7 7.6M16.9 9.2l-3.8 6.6" />
        </svg>
        Visualise
      </button>
      {open && graph && (
        <RelationshipVisualiser
          graph={graph}
          record={record}
          onClose={() => setOpen(false)}
          onJumpToSource={onJumpToSource}
          onJumpToRecord={onJumpToRecord}
        />
      )}
    </>
  )
}
