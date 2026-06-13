import { useState } from 'react'
import type { GpConnectBundle, GpConnectInvestigation, GpConnectTestGroup, GpConnectInvestigationResult, GpConnectSpecimen, GpConnectProcedureRequest } from '../../fhir/types'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const COLUMNS: DomainColumn<GpConnectInvestigation>[] = [
  { label: 'Date', className: 'w-28', render: item => item.date ?? 'Unknown' },
  {
    label: 'Report',
    render: item => <span className="font-medium text-nhs-grey-1">{item.name}</span>,
  },
  {
    label: 'Flag',
    className: 'w-36',
    render: item => item.interpretation
      ? <span className={interpretationClass(item.interpretation)}>{item.interpretation}</span>
      : <span>—</span>,
  },
  { label: 'Performer', render: item => item.performer ?? '—' },
]

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex gap-2 min-w-0">
      <span className="text-xs text-nhs-grey-3 shrink-0 w-36">{label}</span>
      <span className="text-xs text-nhs-grey-1 min-w-0">{value}</span>
    </div>
  )
}

function interpretationClass(value?: string): string {
  if (!value) return ''
  const v = value.toLowerCase()
  if (v === 'h' || v === 'hh' || v === 'critically high' || v.includes('above') || v.includes('high ref')) return 'text-red-700 font-semibold'
  if (v === 'l' || v === 'll' || v === 'critically low' || v.includes('below') || v.includes('low ref')) return 'text-blue-700 font-semibold'
  if (v === 'high') return 'text-red-700 font-semibold'
  if (v === 'low') return 'text-blue-700 font-semibold'
  if (v === 'normal' || v === 'n') return 'text-green-700'
  if (v.includes('outside') || v.includes('abnormal') || v.includes('potentially')) return 'text-amber-700 font-semibold'
  return ''
}

// Render text with newlines preserved
function CommentText({ text, className }: { text: string; className?: string }) {
  const cleaned = text.replace(/\r\n?/g, '\n').trim()
  if (!cleaned) return null
  return (
    <pre className={`whitespace-pre-wrap font-sans text-xs text-nhs-grey-2 leading-relaxed ${className ?? ''}`}>
      {cleaned}
    </pre>
  )
}

function ResultsTable({
  results,
  onJumpToSource,
}: {
  results: GpConnectInvestigationResult[]
  onJumpToSource?: (id: string) => void
}) {
  if (results.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-nhs-blue/20">
            <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Result</th>
            <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Value</th>
            <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Range</th>
            <th className="text-left py-1.5 text-nhs-grey-3 font-medium">Flag</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => {
            if (r.isSubHeader) {
              return (
                <tr key={r.id} className="bg-nhs-grey-5/60 border-b border-nhs-blue/10">
                  <td colSpan={4} className="py-1 px-2 text-xs font-medium text-nhs-grey-2">{r.name}</td>
                </tr>
              )
            }
            const valueText = [r.value, r.unit].filter(Boolean).join(' ') || '—'
            const intClass = interpretationClass(r.interpretation)
            return (
              <>
                <tr key={r.id} className="border-b border-nhs-blue/10 last:border-0">
                  <td className="py-1.5 pr-4 text-nhs-grey-1">
                    <div>
                      {r.name}
                      {r.isTransferDegraded && (
                        <span className="inline-block ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium leading-none align-middle">Degrade</span>
                      )}
                    </div>
                    {onJumpToSource && (
                      <button
                        onClick={e => { e.stopPropagation(); onJumpToSource(`Observation/${r.id}`) }}
                        className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline mt-0.5"
                      >
                        View FHIR ↗
                      </button>
                    )}
                  </td>
                  <td className={`py-1.5 pr-4 font-medium ${intClass}`}>{valueText}</td>
                  <td className="py-1.5 pr-4 text-nhs-grey-2">{r.referenceRange ?? '—'}</td>
                  <td className={`py-1.5 ${intClass}`}>{r.interpretation ?? '—'}</td>
                </tr>
                {r.components?.map((c, ci) => (
                  <tr key={`${r.id}-c${ci}`} className="border-b border-nhs-blue/10 last:border-0 bg-white/40">
                    <td className="py-1 pr-4 pl-4 text-nhs-grey-2 italic">{c.name}</td>
                    <td className={`py-1 pr-4 ${interpretationClass(c.interpretation)}`}>
                      {[c.value, c.unit].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="py-1 pr-4 text-nhs-grey-3">{c.referenceRange ?? '—'}</td>
                    <td className={`py-1 ${interpretationClass(c.interpretation)}`}>{c.interpretation ?? '—'}</td>
                  </tr>
                ))}
                {r.comment && (
                  <tr key={`${r.id}-note`} className="border-b border-nhs-blue/10 last:border-0">
                    <td colSpan={4} className="py-1 pr-4">
                      <CommentText text={r.comment} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SpecimenSection({ specimen, onJumpToSource }: { specimen: GpConnectSpecimen; onJumpToSource?: (id: string) => void }) {
  return (
    <div className="p-3 rounded-lg bg-nhs-grey-5/50 border border-nhs-blue/15 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">Specimen</p>
        {onJumpToSource && specimen.id && (
          <button onClick={() => onJumpToSource(`Specimen/${specimen.id}`)} className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline">
            View FHIR ↗
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {specimen.type && (
          <div className="flex gap-1.5 items-baseline">
            <span className="text-xs text-nhs-grey-3 shrink-0">Type</span>
            <span className="text-xs font-medium text-nhs-grey-1">{specimen.type}</span>
          </div>
        )}
        {specimen.collectedDateTime && (
          <div className="flex gap-1.5 items-baseline">
            <span className="text-xs text-nhs-grey-3 shrink-0">Collected</span>
            <span className="text-xs text-nhs-grey-1">{specimen.collectedDateTime}</span>
          </div>
        )}
        {specimen.receivedTime && (
          <div className="flex gap-1.5 items-baseline">
            <span className="text-xs text-nhs-grey-3 shrink-0">Received</span>
            <span className="text-xs text-nhs-grey-1">{specimen.receivedTime}</span>
          </div>
        )}
        {specimen.status && (
          <div className="flex gap-1.5 items-baseline">
            <span className="text-xs text-nhs-grey-3 shrink-0">Status</span>
            <span className="text-xs text-nhs-grey-1 capitalize">{specimen.status}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ProcedureRequestSection({ pr, onJumpToSource }: { pr: GpConnectProcedureRequest; onJumpToSource?: (id: string) => void }) {
  return (
    <div className="p-3 rounded-lg bg-nhs-grey-5/50 border border-nhs-blue/15 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">Test request</p>
        {onJumpToSource && pr.id && (
          <button onClick={() => onJumpToSource(`ProcedureRequest/${pr.id}`)} className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline">
            View FHIR ↗
          </button>
        )}
      </div>
      {pr.name && (
        <p className="text-xs font-medium text-nhs-grey-1">{pr.name}</p>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {pr.requester && (
          <div className="flex gap-1.5 items-baseline">
            <span className="text-xs text-nhs-grey-3 shrink-0">Requested by</span>
            <span className="text-xs text-nhs-grey-1">{pr.requester}</span>
          </div>
        )}
        {pr.performer && (
          <div className="flex gap-1.5 items-baseline">
            <span className="text-xs text-nhs-grey-3 shrink-0">Perform at</span>
            <span className="text-xs text-nhs-grey-1">{pr.performer}</span>
          </div>
        )}
        {pr.status && (
          <div className="flex gap-1.5 items-baseline">
            <span className="text-xs text-nhs-grey-3 shrink-0">Status</span>
            <span className="text-xs text-nhs-grey-1 capitalize">{pr.status}</span>
          </div>
        )}
      </div>
      {pr.notes && pr.notes.length > 0 && (
        <div className="space-y-0.5 pt-0.5">
          {pr.notes.map((note, i) => (
            <p key={i} className="text-xs text-nhs-grey-2 italic">{note}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function TestGroupSection({
  group,
  onJumpToSource,
}: {
  group: GpConnectTestGroup
  onJumpToSource?: (id: string) => void
}) {
  return (
    <div className="rounded border border-nhs-blue/20 bg-white/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-3">
          {group.name && (
            <span className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
              {group.name}
              {group.isTransferDegraded && (
                <span className="inline-block ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium leading-none align-middle normal-case tracking-normal">Degrade</span>
              )}
            </span>
          )}
          {group.date && <span className="text-xs text-nhs-grey-3">{group.date}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onJumpToSource && (
            <button onClick={() => onJumpToSource(`Observation/${group.id}`)} className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline">
              View FHIR ↗
            </button>
          )}
          <span className="text-[10px] font-medium text-nhs-blue/50 uppercase tracking-wider">Test group</span>
        </div>
      </div>
      {group.comment && (
        <CommentText
          text={group.comment}
          className="p-2 rounded bg-white/60 border border-nhs-blue/10"
        />
      )}
      <ResultsTable
        results={group.results}
        onJumpToSource={onJumpToSource}
      />
    </div>
  )
}

function InvestigationDetail({ investigation, bundle, onJumpToSource, onJumpToRecord }: {
  investigation: GpConnectInvestigation
  bundle: GpConnectBundle
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const refs = [
    investigation.performerId ? { type: 'Practitioner' as const, id: investigation.performerId, label: 'Performer' } : null,
    investigation.encounterId ? { type: 'Encounter' as const, id: investigation.encounterId, label: 'Encounter' } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  const hasGroups = investigation.testGroups.length > 0
  const singleUnnamedGroup = investigation.testGroups.length === 1 && !investigation.testGroups[0].name
  // When the sole group's name just repeats the report name it adds no information —
  // the group header is an artefact of the implicit TPP/EMIS ordering convention
  // (first obs = test-type descriptor, remainder = analyte results). Suppress the
  // redundant header and render the results flat, same as singleUnnamedGroup.
  const soleGroupRepeatsReportName =
    investigation.testGroups.length === 1 &&
    !!investigation.testGroups[0].name &&
    investigation.testGroups[0].name.toLowerCase() === investigation.name.toLowerCase()
  const showFlat = singleUnnamedGroup || soleGroupRepeatsReportName

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{investigation.name}</h3>
        <div className="flex gap-2 shrink-0">
          {investigation.status && <StatusBadge value={investigation.status} />}
        </div>
      </div>

      {/* Report metadata */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {investigation.category && <DetailRow label="Category" value={investigation.category} />}
        <DetailRow label="Date" value={investigation.date} />
        <DetailRow label="Performer" value={
          investigation.performer
            ? investigation.performerId
              ? <ReferenceChip label={investigation.performer} onClick={() => toggle(investigation.performerId!)} active={openResourceId === investigation.performerId} />
              : investigation.performer
            : undefined
        } />
      </div>

      {/* Specimen */}
      {investigation.specimen && (
        <SpecimenSection specimen={investigation.specimen} onJumpToSource={onJumpToSource} />
      )}

      {/* Test request (ProcedureRequest) */}
      {investigation.procedureRequest && (
        <ProcedureRequestSection pr={investigation.procedureRequest} onJumpToSource={onJumpToSource} />
      )}

      {/* Test groups */}
      {hasGroups && (
        <div className={`space-y-4 ${!showFlat ? 'pt-1 border-t border-nhs-blue/20' : ''}`}>
          {showFlat ? (
            // Flat rendering: either a single unnamed group, or a sole group whose name
            // merely repeats the report title (inferred TPP/EMIS test-type descriptor).
            // Show any group-level comment, then the results directly.
            <>
              {investigation.testGroups[0].comment && (
                <CommentText
                  text={investigation.testGroups[0].comment}
                  className="p-2 rounded bg-white/60 border border-nhs-blue/10"
                />
              )}
              <ResultsTable
                results={investigation.testGroups[0].results}
                onJumpToSource={onJumpToSource}
              />
            </>
          ) : (
            // Named groups: render each as a labelled section
            investigation.testGroups.map(group => (
              <TestGroupSection
                key={group.id}
                group={group}
                onJumpToSource={onJumpToSource}
              />
            ))
          )}
        </div>
      )}

      {/* Filing comment */}
      {investigation.filingComment && (
        <div className="space-y-1.5 pt-1 border-t border-nhs-blue/20">
          <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">Filing comment</p>
          <CommentText text={investigation.filingComment} />
          {(investigation.filingCommentPerformer || investigation.filingCommentDate) && (
            <p className="text-[11px] text-nhs-grey-3">
              {investigation.filingCommentPerformer && <span>Filed by {investigation.filingCommentPerformer}</span>}
              {investigation.filingCommentPerformer && investigation.filingCommentDate && <span> · </span>}
              {investigation.filingCommentDate && <span>{investigation.filingCommentDate}</span>}
            </p>
          )}
        </div>
      )}

      <ReferencedResources
        refs={refs}
        practitioners={bundle.practitioners}
        organisations={bundle.organisations}
        healthcareServices={bundle.healthcareServices}
        consultations={bundle.consultations}
        highlightedId={openResourceId ?? undefined}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />
    </div>
  )
}

export function InvestigationsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const count = bundle.investigations.length
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Investigations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} report{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.investigations}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No investigation records found in this bundle"
        expandedContent={investigation => (
          <InvestigationDetail
            investigation={investigation}
            bundle={bundle}
            onJumpToSource={onJumpToSource}
            onJumpToRecord={onJumpToRecord}
          />
        )}
      />
    </div>
  )
}
