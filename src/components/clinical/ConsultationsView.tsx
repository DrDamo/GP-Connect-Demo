import { useState } from 'react'
import type {
  GpConnectBundle,
  GpConnectConsultation,
  GpConnectConsultationCategory,
  GpConnectConsultationItem,
  GpConnectConsultationTopic,
} from '../../fhir/types'
import { formatCodedDataValue } from '../../fhir/utils'
import { DomainTable } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { InfoHint } from '../../onboarding/InfoHint'
import { SearchFilterBox } from './SearchFilterBox'

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
  value?: string
  comment?: string
  fields: Array<{ key: string; value: string }>
  navId: string
  navDomain?: DomainId
  variant?: 'warning'
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
        return {
          label: coded.description,
          badge: coded.category ?? 'Observation',
          navId: coded.id,
          navDomain: 'coded-data',
          value: formatCodedDataValue(coded),
          comment: coded.comment,
          fields: [
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
            value: valueText || undefined,
            comment: result.comment,
            fields: [
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
    case 'Unsupported':
      // Display-only placeholder: the provider system couldn't export this
      // clinical item type (GP Connect "Unsupported Clinical Items in Consultations").
      return {
        label: display ?? '(item not supported by provider system)',
        badge: 'Not supported',
        fields: [],
        navId: resourceId,
        navDomain: undefined,
        variant: 'warning',
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

// Fields whose value duplicates the consultation's own encounter date are
// redundant within recorded content and are hidden.
const DATE_FIELD_KEYS = new Set(['Date', 'Date given'])

function itemContentText(bundle: GpConnectBundle, item: GpConnectConsultationItem): string {
  const content = resolveContent(bundle, item)
  return [
    content.label, content.value, content.comment, content.badge, item.narrativeText,
    ...content.fields.map(f => f.value),
  ].filter(Boolean).join(' ')
}

function consultationSearchText(con: GpConnectConsultation, bundle: GpConnectBundle): string {
  const itemTexts = con.topics.flatMap(t => [
    t.title,
    ...t.items.map(i => itemContentText(bundle, i)),
    ...t.categories.flatMap(c => [c.title, ...c.items.map(i => itemContentText(bundle, i))]),
  ])
  return [
    con.type, con.clinician, con.organisation, con.date, con.endDate,
    con.encounterClass, con.encounterStatus, ...itemTexts,
  ].filter(Boolean).join(' ').toLowerCase()
}

function ConsultationItemCard({
  item,
  bundle,
  encounterDate,
  onJumpToSource,
  onJumpToRecord,
}: {
  item: GpConnectConsultationItem
  bundle: GpConnectBundle
  encounterDate?: string
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const content = resolveContent(bundle, item)
  const fields = content.fields.filter(
    f => !(DATE_FIELD_KEYS.has(f.key) && encounterDate && f.value === encounterDate)
  )

  const canJumpToSource = !!(onJumpToSource && item.resourceId)
  const canJumpToRecord = !!(content.navDomain && onJumpToRecord)

  return (
    <div
      onClick={canJumpToSource ? () => onJumpToSource!(item.resourceId) : undefined}
      className={`rounded border border-nhs-grey-4 bg-white p-2.5 ${canJumpToSource ? 'cursor-pointer hover:border-nhs-blue/40 hover:bg-blue-50/40 transition-colors' : ''}`}
      title={canJumpToSource ? 'Click to view FHIR source' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {item.narrativeText !== undefined ? (
            <span className="text-xs text-nhs-grey-1 min-w-0 whitespace-pre-wrap break-words block">{content.label}</span>
          ) : (
            <span className="text-xs text-nhs-grey-1 min-w-0 block">
              <span className="font-medium">{content.label}</span>
              {content.value && <span className="font-semibold"> {content.value}</span>}
              {content.comment && <span className="italic text-nhs-grey-3"> — {content.comment}</span>}
            </span>
          )}
          {fields.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {fields.map(f => (
                <span key={f.key} className="text-[10px] text-nhs-grey-3">
                  {f.key}: <span className="text-nhs-grey-2">{f.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <span
          onClick={canJumpToRecord ? e => { e.stopPropagation(); onJumpToRecord!(content.navDomain!, content.navId) } : undefined}
          className={`shrink-0 inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${
            content.variant === 'warning'
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-nhs-blue/10 text-nhs-blue border border-nhs-blue/20'
          } ${canJumpToRecord ? 'cursor-pointer hover:bg-nhs-blue/20' : ''}`}
          title={canJumpToRecord ? 'Click to go to record' : undefined}
        >
          {content.badge}
        </span>
      </div>
    </div>
  )
}

const CIRCLED_DIGITS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']

function circledNumber(n: number): string {
  return CIRCLED_DIGITS[n - 1] ?? `(${n})`
}

// Some source systems split a topic's categories across several List
// resources with the same title (e.g. "Additional" appearing 3 times,
// interspersed with other categories). Merge same-titled categories into
// one group, in order of first appearance, so all items of a category
// display together instead of as scattered, disjoint blocks.
function groupCategoriesByTitle(categories: GpConnectConsultationCategory[]): GpConnectConsultationCategory[] {
  const order: string[] = []
  const groups = new Map<string, GpConnectConsultationCategory>()
  for (const cat of categories) {
    const key = cat.title ?? ''
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(...cat.items)
    } else {
      order.push(key)
      groups.set(key, { id: cat.id, title: cat.title, items: [...cat.items] })
    }
  }
  return order.map(key => groups.get(key)!)
}

function TopicSection({
  topic,
  topicNumber,
  bundle,
  encounterDate,
  onJumpToSource,
  onJumpToRecord,
}: {
  topic: GpConnectConsultationTopic
  topicNumber?: number
  bundle: GpConnectBundle
  encounterDate?: string
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const hasCategories = topic.categories.length > 0
  const hasDirectItems = topic.items.length > 0
  if (!hasCategories && !hasDirectItems) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-nhs-grey-4 pb-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-nhs-grey-2">
          {topicNumber && (
            <span className="inline-flex items-center gap-1 text-nhs-blue" aria-label={`Topic ${topicNumber}`}>
              {circledNumber(topicNumber)}
              {topicNumber === 1 && <InfoHint topic="clinical.consultations.topic-numbers" />}
            </span>
          )}
          {topic.title || <span className="italic font-normal text-nhs-grey-3">{'< Untitled >'}</span>}
        </span>
        {onJumpToSource && topic.id && (
          <button
            onClick={() => onJumpToSource(topic.id)}
            className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline shrink-0"
          >
            View FHIR ↗
          </button>
        )}
      </div>
      {hasCategories ? (
        groupCategoriesByTitle(topic.categories).map(cat => (
          <div key={cat.id} className="flex gap-3">
            {cat.title && (
              <div className="shrink-0 w-28">
                <span className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">{cat.title}</span>
                {onJumpToSource && cat.id && (
                  <button
                    onClick={() => onJumpToSource(cat.id)}
                    className="block mt-0.5 text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline normal-case tracking-normal font-normal"
                  >
                    View FHIR ↗
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              {cat.items.map((item, i) => (
                <ConsultationItemCard
                  key={item.resourceId || i}
                  item={item}
                  bundle={bundle}
                  encounterDate={encounterDate}
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
              encounterDate={encounterDate}
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
          <h4 className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide flex items-center gap-1">
            Recorded content
            <InfoHint topic="clinical.consultations.item-click-zones" />
          </h4>
          {consultation.topics.map((topic, i) => (
            <TopicSection
              key={topic.id}
              topic={topic}
              topicNumber={consultation.topics.length > 1 ? i + 1 : undefined}
              bundle={bundle}
              encounterDate={consultation.date}
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
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredConsultations = trimmedQuery
    ? bundle.consultations.filter(c => consultationSearchText(c, bundle).includes(trimmedQuery))
    : bundle.consultations
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Consultations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5 flex items-center gap-1">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
            <InfoHint topic="clinical.consultations.items-count" />
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search consultations…"
        matchCount={filteredConsultations.length}
        totalCount={count}
      />
      <DomainTable
        columns={COLUMNS}
        items={filteredConsultations}
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
