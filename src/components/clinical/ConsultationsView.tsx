import { useState } from 'react'
import type {
  GpConnectBundle,
  GpConnectConsultation,
  GpConnectConsultationItem,
  GpConnectConsultationTopic,
} from '../../fhir/types'
import { DomainTable } from './DomainTable'
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

const RESOURCE_TYPE_TO_DOMAIN: Partial<Record<string, DomainId>> = {
  Observation:        'coded-data',
  MedicationStatement:'medications',
  MedicationRequest:  'medications',
  Condition:          'problems',
  AllergyIntolerance: 'allergies',
  DiagnosticReport:   'investigations',
  ReferralRequest:    'referrals',
  ProcedureRequest:   'diary-entries',
  Immunization:       'immunisations',
  DocumentReference:  'documents',
  Encounter:          'consultations',
}

const RESOURCE_TYPE_BADGE: Record<string, string> = {
  Observation:        'Observation',
  MedicationStatement:'Medication',
  MedicationRequest:  'Medication',
  Condition:          'Problem',
  AllergyIntolerance: 'Allergy',
  DiagnosticReport:   'Investigation',
  ReferralRequest:    'Referral',
  ProcedureRequest:   'Diary',
  Immunization:       'Immunisation',
  DocumentReference:  'Document',
  Encounter:          'Encounter',
}

interface ItemContent {
  label: string
  badge: string
  fields: Array<{ key: string; value: string }>
  navId: string
  navDomain?: DomainId
}

function resolveContent(bundle: GpConnectBundle, item: GpConnectConsultationItem): ItemContent {
  const { resourceType, resourceId, display } = item
  const fallback: ItemContent = {
    label: display ?? resourceId,
    badge: RESOURCE_TYPE_BADGE[resourceType] ?? resourceType,
    fields: [],
    navId: resourceId,
    navDomain: RESOURCE_TYPE_TO_DOMAIN[resourceType],
  }

  switch (resourceType) {
    case 'MedicationStatement':
    case 'MedicationRequest': {
      const med = resourceType === 'MedicationRequest'
        ? bundle.medications.find(m => m.medicationRequestIds.includes(resourceId))
        : bundle.medications.find(m => m.id === resourceId)
      if (!med) return fallback
      return {
        label: med.drugName,
        badge: 'Medication',
        navId: med.id,
        navDomain: 'medications',
        fields: [
          med.dose             ? { key: 'Dose',     value: med.dose }             : null,
          med.status           ? { key: 'Status',   value: med.status }           : null,
          med.prescriptionType ? { key: 'Type',     value: med.prescriptionType } : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'Condition': {
      const prob = bundle.problems.find(p => p.id === resourceId)
      if (!prob) return fallback
      return {
        label: prob.problem,
        badge: 'Problem',
        navId: prob.id,
        navDomain: 'problems',
        fields: [
          prob.clinicalStatus ? { key: 'Status',       value: prob.clinicalStatus } : null,
          prob.significance   ? { key: 'Significance', value: prob.significance }   : null,
          prob.startDate      ? { key: 'Start',        value: prob.startDate }      : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'AllergyIntolerance': {
      const allergy = bundle.allergies.find(a => a.id === resourceId)
      if (!allergy) return fallback
      return {
        label: allergy.causativeAgent,
        badge: 'Allergy',
        navId: allergy.id,
        navDomain: 'allergies',
        fields: [
          allergy.criticality ? { key: 'Criticality', value: allergy.criticality } : null,
          allergy.reaction    ? { key: 'Reaction',    value: allergy.reaction }    : null,
          allergy.status      ? { key: 'Status',      value: allergy.status }      : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'Observation': {
      // Check coded-data first, then fall through to investigation results
      const coded = bundle.codedData.find(c => c.id === resourceId)
      if (coded) {
        const valueText = [coded.value, coded.unit].filter(Boolean).join(' ')
        return {
          label: coded.description,
          badge: coded.category ?? 'Observation',
          navId: coded.id,
          navDomain: 'coded-data',
          fields: [
            valueText    ? { key: 'Value', value: valueText }  : null,
            coded.date   ? { key: 'Date',  value: coded.date } : null,
          ].filter((f): f is { key: string; value: string } => f !== null),
        }
      }
      // Try as an investigation result observation
      for (const inv of bundle.investigations) {
        const result = inv.results.find(r => r.id === resourceId)
        if (result) {
          const valueText = [result.value, result.unit].filter(Boolean).join(' ')
          return {
            label: result.name,
            badge: 'Investigation',
            navId: result.reportId,
            navDomain: 'investigations',
            fields: [
              valueText  ? { key: 'Value',  value: valueText }   : null,
              inv.name   ? { key: 'Report', value: inv.name }    : null,
              inv.date   ? { key: 'Date',   value: inv.date }    : null,
            ].filter((f): f is { key: string; value: string } => f !== null),
          }
        }
      }
      // Narrative text (Comment note — displayed inline, not as coded data)
      if (item.narrativeText !== undefined) {
        return {
          label: item.narrativeText || '(no text)',
          badge: 'Note',
          fields: [],
          navId: resourceId,
          navDomain: undefined,
        }
      }
      return fallback
    }
    case 'DiagnosticReport': {
      const inv = bundle.investigations.find(i => i.id === resourceId)
      if (!inv) return fallback
      return {
        label: inv.name,
        badge: 'Investigation',
        navId: inv.id,
        navDomain: 'investigations',
        fields: [
          inv.date      ? { key: 'Date',      value: inv.date }      : null,
          inv.performer ? { key: 'Performer', value: inv.performer } : null,
          inv.results.length > 0
            ? { key: 'Results', value: String(inv.results.length) }
            : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'ReferralRequest': {
      const ref = bundle.referrals.find(r => r.id === resourceId)
      if (!ref) return fallback
      return {
        label: ref.recipient ?? ref.description ?? ref.reason ?? 'Referral',
        badge: 'Referral',
        navId: ref.id,
        navDomain: 'referrals',
        fields: [
          ref.priority ? { key: 'Priority', value: ref.priority } : null,
          ref.reason   ? { key: 'Reason',   value: ref.reason }   : null,
          ref.status   ? { key: 'Status',   value: ref.status }   : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'ProcedureRequest': {
      const diary = bundle.diaryEntries.find(d => d.id === resourceId)
      if (!diary) return fallback
      return {
        label: diary.description,
        badge: 'Diary',
        navId: diary.id,
        navDomain: 'diary-entries',
        fields: [
          diary.occurrenceStart ? { key: 'Date',     value: diary.occurrenceStart } : null,
          diary.status          ? { key: 'Status',   value: diary.status }          : null,
          diary.priority        ? { key: 'Priority', value: diary.priority }        : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'Immunization': {
      const imm = bundle.immunisations.find(i => i.id === resourceId)
      if (!imm) return fallback
      return {
        label: imm.vaccine,
        badge: 'Immunisation',
        navId: imm.id,
        navDomain: 'immunisations',
        fields: [
          imm.dateGiven                 ? { key: 'Date given',      value: imm.dateGiven }                 : null,
          imm.administeringPractitioner ? { key: 'Administered by', value: imm.administeringPractitioner } : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'DocumentReference': {
      const doc = bundle.documents.find(d => d.id === resourceId)
      if (!doc) return fallback
      return {
        label: doc.description ?? doc.type ?? 'Document',
        badge: 'Document',
        navId: doc.id,
        navDomain: 'documents',
        fields: [
          doc.date   ? { key: 'Date',   value: doc.date }   : null,
          doc.author ? { key: 'Author', value: doc.author } : null,
          doc.status ? { key: 'Status', value: doc.status } : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    case 'Encounter': {
      const con = bundle.consultations.find(c => c.id === resourceId)
      if (!con) return fallback
      return {
        label: con.type ?? 'Consultation',
        badge: 'Encounter',
        navId: con.id,
        navDomain: 'consultations',
        fields: [
          con.date      ? { key: 'Date',      value: con.date }      : null,
          con.clinician ? { key: 'Clinician', value: con.clinician } : null,
        ].filter((f): f is { key: string; value: string } => f !== null),
      }
    }
    default:
      return fallback
  }
}

function ConsultationItemCard({
  item,
  bundle,
  onJumpToSource,
  onJumpToRecord,
}: {
  item: GpConnectConsultationItem
  bundle: GpConnectBundle
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const content = resolveContent(bundle, item)
  return (
    <div className="rounded border border-nhs-grey-4 bg-white p-2.5 space-y-1.5">
      <div className="flex items-start gap-2 min-w-0">
        <span className="shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-nhs-blue/10 text-nhs-blue border border-nhs-blue/20 font-semibold">
          {content.badge}
        </span>
        {item.narrativeText !== undefined ? (
          <span className="text-xs text-nhs-grey-1 min-w-0 whitespace-pre-wrap break-words">{content.label}</span>
        ) : (
          <span className="text-xs font-medium text-nhs-grey-1 min-w-0">{content.label}</span>
        )}
      </div>
      {content.fields.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-0">
          {content.fields.map(f => (
            <span key={f.key} className="text-[10px] text-nhs-grey-3">
              {f.key}: <span className="text-nhs-grey-2">{f.value}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        {content.navDomain && onJumpToRecord && (
          <button
            onClick={() => onJumpToRecord(content.navDomain!, content.navId)}
            className="text-[11px] text-nhs-blue hover:underline"
          >
            Go to record →
          </button>
        )}
        {onJumpToSource && item.resourceId && (
          <button
            onClick={() => onJumpToSource(item.resourceId)}
            className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline"
          >
            View FHIR ↗
          </button>
        )}
      </div>
    </div>
  )
}

function TopicSection({
  topic,
  bundle,
  onJumpToSource,
  onJumpToRecord,
}: {
  topic: GpConnectConsultationTopic
  bundle: GpConnectBundle
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const hasCategories = topic.categories.length > 0
  const hasDirectItems = topic.items.length > 0
  if (!hasCategories && !hasDirectItems) return null

  return (
    <div className="space-y-2">
      {topic.title && (
        <div className="text-xs font-semibold text-nhs-grey-2 border-b border-nhs-grey-4 pb-1">{topic.title}</div>
      )}
      {hasCategories ? (
        topic.categories.map(cat => (
          <div key={cat.id} className="space-y-1.5">
            {cat.title && (
              <div className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">{cat.title}</div>
            )}
            <div className="space-y-1.5">
              {cat.items.map((item, i) => (
                <ConsultationItemCard
                  key={item.resourceId || i}
                  item={item}
                  bundle={bundle}
                  onJumpToSource={onJumpToSource}
                  onJumpToRecord={onJumpToRecord}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="space-y-1.5">
          {topic.items.map((item, i) => (
            <ConsultationItemCard
              key={item.resourceId || i}
              item={item}
              bundle={bundle}
              onJumpToSource={onJumpToSource}
              onJumpToRecord={onJumpToRecord}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const COLUMNS: DomainColumn<GpConnectConsultation>[] = [
  { label: 'Date',         className: 'w-28', render: item => item.date ?? 'Unknown' },
  { label: 'Type',                            render: item => item.type ?? '—' },
  { label: 'Clinician',                       render: item => item.clinician ?? '—' },
  { label: 'Organisation',                    render: item => item.organisation ?? '—' },
  {
    label: 'Items',
    className: 'w-16',
    render: item => {
      const n = item.topics.reduce(
        (sum, t) => sum + t.items.length + t.categories.reduce((s, c) => s + c.items.length, 0),
        0,
      )
      return n > 0 ? <span className="text-nhs-grey-2">{n}</span> : <span className="text-nhs-grey-4">—</span>
    },
  },
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

function ConsultationDetail({
  consultation,
  bundle,
  onJumpToSource,
  onJumpToRecord,
}: {
  consultation: GpConnectConsultation
  bundle: GpConnectBundle
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => (prev === id ? null : id))

  const refs = [
    consultation.clinicianId    ? { type: 'Practitioner' as const, id: consultation.clinicianId,    label: 'Clinician' }    : null,
    consultation.organisationId ? { type: 'Organisation' as const, id: consultation.organisationId, label: 'Organisation' } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  const hasContent = consultation.topics.some(
    t => t.items.length > 0 || t.categories.some(c => c.items.length > 0)
  )

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{consultation.type ?? 'Consultation'}</h3>
        {consultation.date && <span className="text-xs text-nhs-grey-3">{consultation.date}</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        <DetailRow label="Date"     value={consultation.date} />
        <DetailRow label="End date" value={consultation.endDate} />
        <DetailRow label="Type"     value={consultation.type} />
        {consultation.encounterClass  && <DetailRow label="Class"  value={consultation.encounterClass} />}
        {consultation.encounterStatus && <DetailRow label="Status" value={consultation.encounterStatus} />}
        <DetailRow label="Clinician" value={
          consultation.clinician
            ? consultation.clinicianId
              ? <ReferenceChip label={consultation.clinician} onClick={() => toggle(consultation.clinicianId!)} active={openResourceId === consultation.clinicianId} />
              : consultation.clinician
            : undefined
        } />
        <DetailRow label="Organisation" value={
          consultation.organisation
            ? consultation.organisationId
              ? <ReferenceChip label={consultation.organisation} onClick={() => toggle(consultation.organisationId!)} active={openResourceId === consultation.organisationId} />
              : consultation.organisation
            : undefined
        } />
      </div>
      <ReferencedResources
        refs={refs}
        practitioners={bundle.practitioners}
        organisations={bundle.organisations}
        healthcareServices={bundle.healthcareServices}
        highlightedId={openResourceId ?? undefined}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />
      {hasContent && (
        <div className="border-t border-nhs-blue/20 pt-3 space-y-4">
          <h4 className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">Recorded content</h4>
          {consultation.topics.map(topic => (
            <TopicSection
              key={topic.id}
              topic={topic}
              bundle={bundle}
              onJumpToSource={onJumpToSource}
              onJumpToRecord={onJumpToRecord}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ConsultationsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const count = bundle.consultations.length
  return (
    <div className="space-y-4">
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
        expandedContent={consultation => (
          <ConsultationDetail
            consultation={consultation}
            bundle={bundle}
            onJumpToSource={onJumpToSource}
            onJumpToRecord={onJumpToRecord}
          />
        )}
      />
    </div>
  )
}
