import { useState } from 'react'
import type { GpConnectBundle, GpConnectProblem } from '../../fhir/types'
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
    render: item => <span className="font-medium text-nhs-grey-1">{item.problem}</span>,
  },
  { label: 'Significance',    className: 'w-28', render: item => <SignificanceBadge value={item.significance} /> },
  { label: 'Clinical status', className: 'w-28', render: item => <StatusBadge value={item.clinicalStatus} /> },
]

const PAST_COLUMNS: DomainColumn<GpConnectProblem>[] = [
  { label: 'Start date',      className: 'w-28', render: item => item.startDate ?? 'Unknown' },
  {
    label: 'Problem',
    render: item => <span className="font-medium text-nhs-grey-1">{item.problem}</span>,
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

function ProblemDetail({ problem, bundle, onJumpToSource, onJumpToRecord }: {
  problem: GpConnectProblem; bundle: GpConnectBundle
  onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void
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
          <DetailRow label="SNOMED code" value={<span className="font-mono">{problem.snomedCode}</span>} />
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
  title, description, problems, columns, selectedId, onSelect, onJumpToSource, onJumpToRecord, bundle,
}: {
  title: string; description: string; problems: GpConnectProblem[]
  columns: DomainColumn<GpConnectProblem>[]
  selectedId?: string; onSelect?: (id: string) => void; onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  bundle: GpConnectBundle
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
        expandedContent={problem => <ProblemDetail problem={problem} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}

export function ProblemsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const { problems } = bundle

  const active          = problems
    .filter(p => p.clinicalStatus === 'active')
    .sort((a, b) => {
      const order = (s?: string) => s?.toLowerCase() === 'major' ? 0 : 1
      return order(a.significance) - order(b.significance)
    })
  const significantPast = problems.filter(p => p.clinicalStatus !== 'active' && p.significance?.toLowerCase() === 'major')
  const minorPast       = problems.filter(p => p.clinicalStatus !== 'active' && p.significance?.toLowerCase() !== 'major')

  const total = problems.length

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

      <ProblemSection
        title="Active" description="Current ongoing problems"
        problems={active} columns={ACTIVE_COLUMNS}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} bundle={bundle}
      />
      <ProblemSection
        title="Significant Past" description="Resolved problems of major clinical significance"
        problems={significantPast} columns={PAST_COLUMNS}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} bundle={bundle}
      />
      <ProblemSection
        title="Minor Past" description="Resolved problems of minor clinical significance"
        problems={minorPast} columns={PAST_COLUMNS}
        selectedId={selectedId} onSelect={onSelect} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} bundle={bundle}
      />

      {total === 0 && (
        <p className="text-sm text-nhs-grey-3 text-center py-8">No problem records found in this bundle</p>
      )}
    </div>
  )
}
