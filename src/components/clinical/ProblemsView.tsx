import type { GpConnectBundle, GpConnectProblem } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectProblem>[] = [
  {
    label: 'Problem',
    render: item => <div className="font-medium text-nhs-grey-1">{item.problem}</div>,
  },
  {
    label: 'SNOMED code',
    render: item => item.snomedCode
      ? <span className="font-mono text-xs text-nhs-grey-2">{item.snomedCode}</span>
      : <span className="text-nhs-grey-3">—</span>,
  },
  {
    label: 'Clinical status',
    render: item => <StatusBadge value={item.clinicalStatus} />,
  },
  {
    label: 'Significance',
    render: item => item.significance
      ? item.significance.charAt(0).toUpperCase() + item.significance.slice(1)
      : '—',
  },
  { label: 'Start date', render: item => item.startDate ?? '—' },
  { label: 'End date',   render: item => item.endDate ?? '—' },
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

function ProblemDetail({ problem }: { problem: GpConnectProblem }) {
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{problem.problem}</h3>
        <StatusBadge value={problem.clinicalStatus} />
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {problem.snomedCode && (
          <DetailRow label="SNOMED code" value={<span className="font-mono">{problem.snomedCode}</span>} />
        )}
        {problem.significance && (
          <DetailRow
            label="Significance"
            value={problem.significance.charAt(0).toUpperCase() + problem.significance.slice(1)}
          />
        )}
        <DetailRow label="Start date" value={problem.startDate} />
        {problem.endDate && <DetailRow label="End date" value={problem.endDate} />}
      </div>
    </div>
  )
}

export function ProblemsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.problems.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Problems</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.problems}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No problem records found in this bundle"
        expandedContent={problem => <ProblemDetail problem={problem} />}
      />
    </div>
  )
}
