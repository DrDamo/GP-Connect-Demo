import type { GpConnectBundle, GpConnectInvestigation } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectInvestigation>[] = [
  { label: 'Date', render: item => item.date ?? '—' },
  {
    label: 'Investigation',
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">{item.name}</div>
        {item.snomedCode && (
          <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{item.snomedCode}</div>
        )}
      </div>
    ),
  },
  {
    label: 'Result',
    render: item => {
      const parts = [item.result, item.unit].filter(Boolean)
      return parts.length > 0 ? parts.join(' ') : '—'
    },
  },
  { label: 'Reference range', render: item => item.referenceRange ?? '—' },
  { label: 'Interpretation',  render: item => item.interpretation ?? '—' },
  { label: 'Performer',       render: item => item.performer ?? '—' },
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
  if (v === 'high' || v === 'h' || v === 'hh' || v === 'critically high') return 'text-red-700 font-semibold'
  if (v === 'low' || v === 'l' || v === 'll' || v === 'critically low') return 'text-blue-700 font-semibold'
  if (v === 'normal' || v === 'n') return 'text-green-700'
  return ''
}

function InvestigationDetail({ investigation }: { investigation: GpConnectInvestigation }) {
  const resultText = [investigation.result, investigation.unit].filter(Boolean).join(' ') || undefined
  const intClass = interpretationClass(investigation.interpretation)
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{investigation.name}</h3>
        {investigation.interpretation && (
          <StatusBadge value={investigation.interpretation} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {investigation.snomedCode && (
          <DetailRow label="SNOMED code" value={<span className="font-mono">{investigation.snomedCode}</span>} />
        )}
        <DetailRow label="Date"            value={investigation.date} />
        {resultText && (
          <DetailRow label="Result" value={
            <span className={intClass || undefined}>{resultText}</span>
          } />
        )}
        {investigation.referenceRange && (
          <DetailRow label="Reference range" value={investigation.referenceRange} />
        )}
        {investigation.interpretation && (
          <DetailRow label="Interpretation" value={
            <span className={intClass || undefined}>{investigation.interpretation}</span>
          } />
        )}
        <DetailRow label="Performer" value={investigation.performer} />
      </div>
    </div>
  )
}

export function InvestigationsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.investigations.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Investigations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
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
        expandedContent={investigation => <InvestigationDetail investigation={investigation} />}
      />
    </div>
  )
}
