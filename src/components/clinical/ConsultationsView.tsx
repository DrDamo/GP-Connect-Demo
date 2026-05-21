import type { GpConnectBundle, GpConnectConsultation } from '../../fhir/types'
import { PatientBanner } from './PatientBanner'
import { DomainTable } from './DomainTable'
import type { DomainColumn } from './DomainTable'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
}

const COLUMNS: DomainColumn<GpConnectConsultation>[] = [
  { label: 'Date',         render: item => item.date ?? '—' },
  { label: 'Type',         render: item => item.type ?? '—' },
  { label: 'Clinician',    render: item => item.clinician ?? '—' },
  { label: 'Organisation', render: item => item.organisation ?? '—' },
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

function ConsultationDetail({ consultation }: { consultation: GpConnectConsultation }) {
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">
          {consultation.type ?? 'Consultation'}
        </h3>
        {consultation.date && (
          <span className="text-xs text-nhs-grey-3">{consultation.date}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        <DetailRow label="Date"         value={consultation.date} />
        <DetailRow label="Type"         value={consultation.type} />
        <DetailRow label="Clinician"    value={consultation.clinician} />
        <DetailRow label="Organisation" value={consultation.organisation} />
      </div>
    </div>
  )
}

export function ConsultationsView({ bundle, selectedId, onSelect }: Props) {
  const count = bundle.consultations.length
  return (
    <div className="space-y-4">
      <PatientBanner patient={bundle.patient} practiceOrganisation={bundle.practiceOrganisation} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Consultations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.consultations}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No consultation records found in this bundle"
        expandedContent={consultation => <ConsultationDetail consultation={consultation} />}
      />
    </div>
  )
}
