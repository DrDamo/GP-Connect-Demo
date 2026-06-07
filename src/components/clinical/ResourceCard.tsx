import { useState, useEffect } from 'react'
import type { GpConnectPractitioner, GpConnectOrganisation, GpConnectHealthcareService, GpConnectLocation, GpConnectConsultation, GpConnectFhirMedication, GpConnectDocument } from '../../fhir/types'
import { type DomainId } from './domains'

export type ResourceRef = {
  type: 'Practitioner' | 'Organisation' | 'HealthcareService' | 'Location' | 'Encounter' | 'Medication' | 'Document'
  id: string
  label: string
}

const RECORD_DOMAIN: Record<ResourceRef['type'], DomainId | null> = {
  Encounter:         'consultations',
  Practitioner:      'supporting-resources',
  Organisation:      'supporting-resources',
  HealthcareService: 'supporting-resources',
  Medication:        'supporting-resources',
  Location:          'supporting-resources',
  Document:          'documents',
}

interface ResourceCardProps {
  ref_: ResourceRef
  practitioners: GpConnectPractitioner[]
  organisations: GpConnectOrganisation[]
  healthcareServices: GpConnectHealthcareService[]
  locations?: GpConnectLocation[]
  consultations?: GpConnectConsultation[]
  fhirMedications?: GpConnectFhirMedication[]
  documents?: GpConnectDocument[]
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  forceOpen?: boolean
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-nhs-grey-3 w-32 shrink-0">{label}</span>
      <span className="text-nhs-grey-1">{value}</span>
    </div>
  )
}

type DetailProps<T> = { data: T; onJumpToSource?: (id: string) => void; onJumpToRecord?: () => void; recordLabel?: string }

function RecordLinks({ id, onJumpToSource, onJumpToRecord, recordLabel }: { id: string; onJumpToSource?: (id: string) => void; onJumpToRecord?: () => void; recordLabel?: string }) {
  if (!onJumpToSource && !onJumpToRecord) return null
  return (
    <div className="flex gap-3 mt-1 flex-wrap">
      {onJumpToRecord && (
        <button onClick={onJumpToRecord} className="text-xs text-nhs-blue hover:underline">
          {recordLabel ?? 'View in GP Record'} →
        </button>
      )}
      {onJumpToSource && (
        <button onClick={() => onJumpToSource(id)} className="text-xs text-nhs-grey-2 hover:underline">
          View in FHIR source ↗
        </button>
      )}
    </div>
  )
}

function PractitionerDetail({ data: p, onJumpToSource, onJumpToRecord }: DetailProps<GpConnectPractitioner>) {
  return (
    <div className="space-y-1">
      <Row label="Name" value={p.name} />
      <Row label="SDS User ID" value={p.sdsUserId} />
      <Row label="SDS Role Profile ID" value={p.sdsRoleProfileId} />
      <Row label="Gender" value={p.gender} />
      <Row label="Resource ID" value={p.id} />
      <RecordLinks id={`Practitioner/${p.id}`} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} recordLabel="View in Supporting Resources" />
    </div>
  )
}

function OrganisationDetail({ data: o, onJumpToSource, onJumpToRecord }: DetailProps<GpConnectOrganisation>) {
  return (
    <div className="space-y-1">
      <Row label="Name" value={o.name} />
      <Row label="ODS Code" value={o.odsCode} />
      <Row label="Phone" value={o.phone} />
      <Row label="Address" value={o.address} />
      <Row label="Resource ID" value={o.id} />
      <RecordLinks id={`Organization/${o.id}`} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} recordLabel="View in Supporting Resources" />
    </div>
  )
}

function HealthcareServiceDetail({ data: h, onJumpToSource, onJumpToRecord }: DetailProps<GpConnectHealthcareService>) {
  return (
    <div className="space-y-1">
      <Row label="Name" value={h.name} />
      <Row label="Specialty" value={h.specialty} />
      <Row label="Provided By" value={h.providedBy} />
      <Row label="Comment" value={h.comment} />
      <Row label="Resource ID" value={h.id} />
      <RecordLinks id={`HealthcareService/${h.id}`} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} recordLabel="View in Supporting Resources" />
    </div>
  )
}

function LocationDetail({ data: l, onJumpToSource, onJumpToRecord }: DetailProps<GpConnectLocation>) {
  return (
    <div className="space-y-1">
      <Row label="Name"        value={l.name} />
      <Row label="Address"     value={l.address} />
      <Row label="Resource ID" value={l.id} />
      <RecordLinks id={`Location/${l.id}`} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} recordLabel="View in Supporting Resources" />
    </div>
  )
}

function DocumentDetail({ data: d, onJumpToSource, onJumpToRecord }: DetailProps<GpConnectDocument>) {
  return (
    <div className="space-y-1">
      <Row label="Type"        value={d.type} />
      <Row label="Description" value={d.description} />
      <Row label="Date"        value={d.date} />
      <Row label="Status"      value={d.status} />
      <Row label="Author"      value={d.author} />
      <Row label="Custodian"   value={d.custodian} />
      <Row label="MIME type"   value={d.mimeType} />
      <Row label="Resource ID" value={d.id} />
      <RecordLinks id={`DocumentReference/${d.id}`} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} recordLabel="View in Documents" />
    </div>
  )
}

function MedicationResourceDetail({ data: m, onJumpToSource, onJumpToRecord }: DetailProps<GpConnectFhirMedication>) {
  return (
    <div className="space-y-1">
      <Row label="Name"        value={m.name} />
      <Row label="SNOMED code" value={m.snomedCode} />
      <Row label="Resource ID" value={m.id} />
      <RecordLinks id={`Medication/${m.id}`} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} recordLabel="View in Supporting Resources" />
    </div>
  )
}

function EncounterDetail({ data: c, onJumpToSource, onJumpToRecord }: DetailProps<GpConnectConsultation>) {
  return (
    <div className="space-y-1">
      <Row label="Date"         value={c.date} />
      <Row label="Type"         value={c.type} />
      <Row label="Clinician"    value={c.clinician} />
      <Row label="Organisation" value={c.organisation} />
      <Row label="Resource ID"  value={c.id} />
      <RecordLinks id={`Encounter/${c.id}`} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} recordLabel="View in Consultations" />
    </div>
  )
}

export function ResourceCard({ ref_, practitioners, organisations, healthcareServices, locations, consultations, fhirMedications, documents, onJumpToSource, onJumpToRecord, forceOpen }: ResourceCardProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (forceOpen) setOpen(true) }, [forceOpen])

  const domain = RECORD_DOMAIN[ref_.type]
  const jumpToRecord = domain && onJumpToRecord ? () => onJumpToRecord(domain, ref_.id) : undefined

  let summary = ref_.id
  let detail: React.ReactNode = null

  if (ref_.type === 'Practitioner') {
    const p = practitioners.find(x => x.id === ref_.id)
    if (p) {
      summary = p.name
      detail = <PractitionerDetail data={p} onJumpToSource={onJumpToSource} onJumpToRecord={jumpToRecord} />
    } else {
      detail = (
        <div className="space-y-1">
          <Row label="Resource ID" value={ref_.id} />
          <p className="text-xs text-nhs-grey-3 italic">Not included in this bundle</p>
          {onJumpToSource && (
            <button onClick={() => onJumpToSource(ref_.id)} className="text-xs text-nhs-grey-2 hover:underline">View in FHIR source ↗</button>
          )}
        </div>
      )
    }
  } else if (ref_.type === 'Organisation') {
    const o = organisations.find(x => x.id === ref_.id)
    if (o) {
      summary = o.name
      detail = <OrganisationDetail data={o} onJumpToSource={onJumpToSource} onJumpToRecord={jumpToRecord} />
    }
  } else if (ref_.type === 'Location') {
    const l = (locations ?? []).find(x => x.id === ref_.id)
    if (l) {
      summary = l.name
      detail = <LocationDetail data={l} onJumpToSource={onJumpToSource} onJumpToRecord={jumpToRecord} />
    }
  } else if (ref_.type === 'Encounter') {
    const c = (consultations ?? []).find(x => x.id === ref_.id)
    if (c) {
      summary = [c.date, c.type].filter(Boolean).join(' · ') || ref_.id
      detail = <EncounterDetail data={c} onJumpToSource={onJumpToSource} onJumpToRecord={jumpToRecord} />
    } else {
      detail = (
        <div className="space-y-1">
          <Row label="Resource ID" value={ref_.id} />
          <p className="text-xs text-nhs-grey-3 italic">Not included in this bundle</p>
          {onJumpToSource && (
            <button onClick={() => onJumpToSource(ref_.id)} className="text-xs text-nhs-grey-2 hover:underline">View in FHIR source ↗</button>
          )}
        </div>
      )
    }
  } else if (ref_.type === 'Medication') {
    const m = (fhirMedications ?? []).find(x => x.id === ref_.id)
    if (m) {
      summary = m.name
      detail = <MedicationResourceDetail data={m} onJumpToSource={onJumpToSource} onJumpToRecord={jumpToRecord} />
    }
  } else if (ref_.type === 'Document') {
    const d = (documents ?? []).find(x => x.id === ref_.id)
    if (d) {
      summary = d.description ?? d.type ?? ref_.id
      detail = <DocumentDetail data={d} onJumpToSource={onJumpToSource} onJumpToRecord={jumpToRecord} />
    }
  } else {
    const h = healthcareServices.find(x => x.id === ref_.id)
    if (h) {
      summary = h.name ?? ref_.id
      detail = <HealthcareServiceDetail data={h} onJumpToSource={onJumpToSource} onJumpToRecord={jumpToRecord} />
    }
  }

  if (!detail) return null

  return (
    <div className="border border-nhs-grey-4 rounded text-xs">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-nhs-grey-5 transition-colors"
      >
        <span className="text-nhs-grey-3 text-[10px]">{open ? '▼' : '▶'}</span>
        <span className="text-nhs-grey-3 w-24 shrink-0">{ref_.label}</span>
        <span className="text-nhs-grey-1 font-medium">{summary}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-nhs-grey-4 bg-nhs-grey-5">
          {detail}
        </div>
      )}
    </div>
  )
}

interface ReferenceChipProps {
  label: string
  onClick: () => void
  active?: boolean
}

export function ReferenceChip({ label, onClick, active }: ReferenceChipProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-colors ${
        active
          ? 'bg-nhs-blue text-white border-nhs-blue'
          : 'bg-white text-nhs-blue border-nhs-blue hover:bg-nhs-blue hover:text-white'
      }`}
    >
      {label}
      <span className="text-[10px]">↗</span>
    </button>
  )
}
