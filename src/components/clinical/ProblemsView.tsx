import { useMemo, useState } from 'react'
import type { GpConnectBundle, GpConnectProblem } from '../../fhir/types'
import { DomainTable, StatusBadge, DegradedTermText, CodeStatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { SearchFilterBox } from './SearchFilterBox'

function problemSearchText(p: GpConnectProblem): string {
  return [
    p.problem, p.significance, p.clinicalStatus, p.startDate, p.endDate, p.snomedCode, p.snomedDisplay,
    p.assertedDate, p.asserter, ...p.notes, ...p.linkedItems.map(li => li.description),
  ].filter(Boolean).join(' ').toLowerCase()
}

// EMIS/TPP group/combine/evolve events (Extension-CareConnect-RelatedProblemHeader-1)
// link problems into a parent + children tree — see [[docs/emis-tpp-medicus-variations]].
// A problem is a "root" if nothing declares it a child, or if the problem it names as
// parent isn't actually present in this bundle (defensive: don't silently drop it).
function buildProblemChildrenMap(allProblems: GpConnectProblem[]): Map<string, GpConnectProblem[]> {
  const byId = new Map(allProblems.map(p => [p.id, p]))
  const map = new Map<string, GpConnectProblem[]>()
  for (const p of allProblems) {
    const childIds = p.relatedProblems.filter(r => r.type === 'child').map(r => r.targetId)
    const children = childIds.map(id => byId.get(id)).filter((c): c is GpConnectProblem => !!c)
    if (children.length > 0) map.set(p.id, children)
  }
  return map
}

function getParentId(p: GpConnectProblem): string | undefined {
  return p.relatedProblems.find(r => r.type === 'parent')?.targetId
}

function isRootProblem(p: GpConnectProblem, byId: Map<string, GpConnectProblem>): boolean {
  const parentId = getParentId(p)
  return !parentId || !byId.has(parentId)
}

// Walks parent pointers up from a problem to collect every ancestor id above it (in practice
// at most one, since RelatedProblemHeader is a flat parent+children tree) — used to force those
// ancestors' tree toggles open when navigating straight to a nested child.
function getAncestorIds(id: string, byId: Map<string, GpConnectProblem>): string[] {
  const ancestors: string[] = []
  let current = byId.get(id)
  const seen = new Set<string>()
  while (current) {
    const parentId = getParentId(current)
    if (!parentId || !byId.has(parentId) || seen.has(parentId)) break
    seen.add(parentId)
    ancestors.push(parentId)
    current = byId.get(parentId)
  }
  return ancestors
}

const RELATED_PROBLEM_LABELS: Record<GpConnectProblem['relatedProblems'][number]['type'], string> = {
  parent: 'Parent', child: 'Child', sibling: 'Sibling',
}

// A root matches a search if it matches itself, or any of its (nested) children do —
// otherwise searching for a term that's only in a collapsed child would hide the whole group.
function rootMatchesQuery(root: GpConnectProblem, query: string, childrenMap: Map<string, GpConnectProblem[]>): boolean {
  if (problemSearchText(root).includes(query)) return true
  return (childrenMap.get(root.id) ?? []).some(child => rootMatchesQuery(child, query, childrenMap))
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  Observation: 'Observation', Encounter: 'Encounter', MedicationRequest: 'Medication',
  MedicationStatement: 'Medication', Condition: 'Condition', AllergyIntolerance: 'Allergy',
  DiagnosticReport: 'Report', ReferralRequest: 'Referral',
}

const RESOURCE_TYPE_TO_DOMAIN: Partial<Record<string, DomainId>> = {
  Observation: 'coded-data', Encounter: 'consultations',
  MedicationRequest: 'medications', MedicationStatement: 'medications',
  Condition: 'problems', AllergyIntolerance: 'allergies',
  DiagnosticReport: 'investigations', ReferralRequest: 'referrals',
}

function SignificanceBadge({ value }: { value?: string }) {
  if (!value) return null
  const isMajor = value.toLowerCase() === 'major'
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${
      isMajor
        ? 'bg-amber-100 text-amber-800 border border-amber-300'
        : 'bg-nhs-grey-5 text-nhs-grey-2 border border-nhs-grey-4'
    }`}>
      {value}
    </span>
  )
}

const ACTIVE_COLUMNS: DomainColumn<GpConnectProblem>[] = [
  { label: 'Start date',      className: 'w-28', render: item => item.startDate ?? 'Unknown' },
  {
    label: 'Problem',
    render: item => <span className="font-medium text-nhs-grey-1"><DegradedTermText text={item.problem} /></span>,
  },
  { label: 'Significance',    className: 'w-28', render: item => <SignificanceBadge value={item.significance} /> },
  { label: 'Clinical status', className: 'w-28', render: item => <StatusBadge value={item.clinicalStatus} /> },
]

const PAST_COLUMNS: DomainColumn<GpConnectProblem>[] = [
  { label: 'Start date',      className: 'w-28', render: item => item.startDate ?? 'Unknown' },
  {
    label: 'Problem',
    render: item => <span className="font-medium text-nhs-grey-1"><DegradedTermText text={item.problem} /></span>,
  },
  { label: 'Significance',    className: 'w-28', render: item => <SignificanceBadge value={item.significance} /> },
  { label: 'Clinical status', className: 'w-28', render: item => <StatusBadge value={item.clinicalStatus} /> },
  { label: 'End date',        className: 'w-28', render: item => item.endDate ?? '—' },
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

function ProblemDetail({ problem, bundle, byId, onJumpToSource, onJumpToRecord, onJumpToProblem }: {
  problem: GpConnectProblem; bundle: GpConnectBundle; byId: Map<string, GpConnectProblem>
  onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void
  /** Same-domain navigation to another problem — expands its ancestor tree first if it's a
   * collapsed grouped/combined/evolved child, then selects it. */
  onJumpToProblem?: (id: string) => void
}) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const refs = [
    problem.asserterId  ? { type: 'Practitioner' as const, id: problem.asserterId,  label: 'Asserter'  } : null,
    problem.encounterId ? { type: 'Encounter'    as const, id: problem.encounterId, label: 'Encounter' } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{problem.problem}</h3>
        <div className="flex gap-2 items-center">
          <SignificanceBadge value={problem.significance} />
          <StatusBadge value={problem.clinicalStatus} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {problem.snomedCode && (
          <DetailRow label="SNOMED code" value={
            <>
              <span className="font-mono">{problem.snomedCode}</span>
              <CodeStatusBadge status={bundle.snomedStatus?.[problem.snomedCode]} />
            </>
          } />
        )}
        {problem.snomedDisplay && (
          <DetailRow label="SNOMED display" value={problem.snomedDisplay} />
        )}
        <DetailRow label="Start date"    value={problem.startDate} />
        {problem.endDate && <DetailRow label="End date" value={problem.endDate} />}
        <DetailRow label="Asserted date" value={problem.assertedDate} />
        <DetailRow label="Asserter" value={
          problem.asserter
            ? problem.asserterId
              ? <ReferenceChip label={problem.asserter} onClick={() => toggle(problem.asserterId!)} active={openResourceId === problem.asserterId} />
              : problem.asserter
            : undefined
        } />
      </div>
      {problem.notes.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Notes</span>
          {problem.notes.map((note, i) => (
            <p key={i} className="text-xs text-nhs-grey-1">{note}</p>
          ))}
        </div>
      )}
      {problem.linkedItems.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Linked Items</span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {problem.linkedItems.map((item, i) => {
              const domain = RESOURCE_TYPE_TO_DOMAIN[item.resourceType]
              const typeLabel = item.resourceType === 'Observation'
                ? (bundle.codedData.find(c => c.id === item.id)?.category ?? RESOURCE_TYPE_LABELS['Observation'])
                : RESOURCE_TYPE_LABELS[item.resourceType] ?? item.resourceType
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      item.linkType === 'actual'
                        ? 'bg-nhs-blue/10 text-nhs-blue border border-nhs-blue/20'
                        : 'bg-nhs-grey-5 text-nhs-grey-2 border border-nhs-grey-4'
                    }`}>
                      {item.linkType === 'actual' ? 'Actual' : typeLabel}
                    </span>
                    <span className="text-xs text-nhs-grey-1 min-w-0 truncate">
                      {item.description ?? <span className="text-nhs-grey-3 font-mono text-[10px]">{item.id}</span>}
                    </span>
                  </div>
                  <div className="flex gap-2 pl-px">
                    {domain && onJumpToRecord && (
                      <button
                        onClick={() => onJumpToRecord(domain, item.id)}
                        className="text-[11px] text-nhs-blue hover:underline"
                      >
                        Go to item →
                      </button>
                    )}
                    {onJumpToSource && (
                      <button
                        onClick={() => onJumpToSource(item.id)}
                        className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline"
                      >
                        View FHIR ↗
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {problem.relatedProblems.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Related Problems</span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {problem.relatedProblems.map((rel, i) => {
              const target = byId.get(rel.targetId)
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      rel.type === 'parent'
                        ? 'bg-nhs-blue/10 text-nhs-blue border border-nhs-blue/20'
                        : 'bg-nhs-grey-5 text-nhs-grey-2 border border-nhs-grey-4'
                    }`}>
                      {RELATED_PROBLEM_LABELS[rel.type]}
                    </span>
                    <span className="text-xs text-nhs-grey-1 min-w-0 truncate">
                      {target ? <DegradedTermText text={target.problem} /> : <span className="text-nhs-grey-3 font-mono text-[10px]">{rel.targetId}</span>}
                    </span>
                    {target && <StatusBadge value={target.clinicalStatus} />}
                  </div>
                  <div className="flex gap-2 pl-px">
                    {onJumpToProblem && (
                      <button
                        onClick={() => onJumpToProblem(rel.targetId)}
                        className="text-[11px] text-nhs-blue hover:underline"
                      >
                        Go to item →
                      </button>
                    )}
                    {onJumpToSource && (
                      <button
                        onClick={() => onJumpToSource(rel.targetId)}
                        className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline"
                      >
                        View FHIR ↗
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
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

function ProblemSection({
  title, description, problems, columns, selectedId, onSelect, onJumpToSource, onJumpToRecord, onJumpToProblem,
  bundle, byId, childrenMap, forceExpandIds,
}: {
  title: string; description: string; problems: GpConnectProblem[]
  columns: DomainColumn<GpConnectProblem>[]
  selectedId?: string; onSelect?: (id: string) => void; onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  onJumpToProblem: (id: string) => void
  bundle: GpConnectBundle
  byId: Map<string, GpConnectProblem>
  childrenMap: Map<string, GpConnectProblem[]>
  forceExpandIds: string[]
}) {
  if (problems.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="border-b border-nhs-grey-4 pb-1">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{title}</h3>
        <p className="text-xs text-nhs-grey-3">{description}</p>
      </div>
      <DomainTable
        columns={columns}
        items={problems}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No records in this section"
        expandedContent={problem => (
          <ProblemDetail
            problem={problem} bundle={bundle} byId={byId}
            onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} onJumpToProblem={onJumpToProblem}
          />
        )}
        getChildren={problem => childrenMap.get(problem.id)}
        treeColumnIndex={1}
        forceExpandIds={forceExpandIds}
      />
    </div>
  )
}

export function ProblemsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const { problems } = bundle
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()

  // Grouped/combined/evolved problems (EMIS/TPP RelatedProblemHeader) are displayed as a
  // single parent row with its children nested underneath, collapsed by default — never as
  // separate top-level rows. Sections and counts below are built from roots only.
  const childrenMap = useMemo(() => buildProblemChildrenMap(problems), [problems])
  const byId = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])
  const rootProblems = useMemo(() => problems.filter(p => isRootProblem(p, byId)), [problems, byId])

  // Ids force-opened by a "Go to item →" jump onto a related problem (Parent/Child/Sibling,
  // from ProblemDetail's Related Problems section) that landed on a currently-collapsed child —
  // its ancestor row(s) must be expanded before the target can actually be selected/scrolled to.
  const [forceExpandIds, setForceExpandIds] = useState<string[]>([])
  const handleJumpToProblem = (targetId: string) => {
    const ancestorIds = getAncestorIds(targetId, byId)
    if (ancestorIds.length > 0) {
      setForceExpandIds(prev => Array.from(new Set([...prev, ...ancestorIds])))
    }
    onJumpToRecord?.('problems', targetId)
  }

  const filteredRoots = trimmedQuery
    ? rootProblems.filter(root => rootMatchesQuery(root, trimmedQuery, childrenMap))
    : rootProblems

  const active          = filteredRoots
    .filter(p => p.clinicalStatus === 'active')
    .sort((a, b) => {
      const order = (s?: string) => s?.toLowerCase() === 'major' ? 0 : 1
      return order(a.significance) - order(b.significance)
    })
  const significantPast = filteredRoots.filter(p => p.clinicalStatus !== 'active' && p.significance?.toLowerCase() === 'major')
  const minorPast       = filteredRoots.filter(p => p.clinicalStatus !== 'active' && p.significance?.toLowerCase() !== 'major')

  const total = rootProblems.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Problems</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {total} record{total !== 1 ? 's' : ''} —{' '}
            {active.length} active · {significantPast.length} significant past · {minorPast.length} minor past
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>

      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search problems…"
        matchCount={filteredRoots.length}
        totalCount={total}
      />

      <ProblemSection
        title="Active" description="Current ongoing problems"
        problems={active} columns={ACTIVE_COLUMNS}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord}
        onJumpToProblem={handleJumpToProblem} bundle={bundle} byId={byId} childrenMap={childrenMap} forceExpandIds={forceExpandIds}
      />
      <ProblemSection
        title="Significant Past" description="Resolved problems of major clinical significance"
        problems={significantPast} columns={PAST_COLUMNS}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord}
        onJumpToProblem={handleJumpToProblem} bundle={bundle} byId={byId} childrenMap={childrenMap} forceExpandIds={forceExpandIds}
      />
      <ProblemSection
        title="Minor Past" description="Resolved problems of minor clinical significance"
        problems={minorPast} columns={PAST_COLUMNS}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord}
        onJumpToProblem={handleJumpToProblem} bundle={bundle} byId={byId} childrenMap={childrenMap} forceExpandIds={forceExpandIds}
      />

      {total === 0 && (
        <p className="text-sm text-nhs-grey-3 text-center py-8">No problem records found in this bundle</p>
      )}
    </div>
  )
}
