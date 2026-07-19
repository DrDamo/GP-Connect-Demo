import { useState, Fragment } from 'react'
import type { GpConnectMedication, GpConnectMedicationsRecord } from '../../fhir/types'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { InfoHint } from '../../onboarding/InfoHint'
import { SearchFilterBox } from './SearchFilterBox'
import { NotForPfsBadge, DegradedTermText } from './DomainTable'

function medicationSearchText(med: GpConnectMedication): string {
  return [
    med.drugName, med.dose, med.frequency, med.dosageInstruction, med.route, med.site,
    med.status, med.prescriptionType, med.prescribedQuantity, med.expectedSupplyDuration,
    med.prescriber, med.recorder, med.prescriberOrganisation,
    med.patientInstructions, med.pharmacyInstructions, med.statusReason, med.additionalInformation,
    med.startDate, med.lastIssuedDate, med.dateAsserted, med.endDate, med.authorisationExpiryDate,
    ...med.issues.flatMap(i => [
      i.issueDate, i.startDate, i.endDate, i.status, i.quantity, i.supplyDuration,
      i.dosageInstruction, i.patientInstructions, i.pharmacyInstructions, i.recorder,
    ]),
  ].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  record: GpConnectMedicationsRecord
  selectedId?: string
  selectedIssueId?: string
  onSelect?: (id: string) => void
  onSelectIssue?: (medId: string, issueId: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active:             { label: 'Active',           className: 'bg-green-100 text-green-800 border-green-300' },
  completed:          { label: 'Completed',         className: 'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4' },
  stopped:            { label: 'Stopped',           className: 'bg-red-100 text-red-800 border-red-300' },
  'on-hold':          { label: 'On Hold',           className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  intended:           { label: 'Intended',          className: 'bg-blue-100 text-blue-800 border-blue-300' },
  'entered-in-error': { label: 'Entered in Error',  className: 'bg-red-100 text-red-800 border-red-300' },
  unknown:            { label: 'Unknown',           className: 'bg-nhs-grey-5 text-nhs-grey-3 border-nhs-grey-4' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.unknown
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function Detail({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">{label}</span>
      <p className={`mt-0.5 ${value ? `text-nhs-grey-1 ${mono ? 'font-mono text-xs' : ''}` : 'text-nhs-grey-3 italic'}`}>
        {value ?? '—'}
      </p>
    </div>
  )
}

function MedicationRow({ med, record, selected, selectedIssueId, onSelect, onSelectIssue, onJumpToSource, onJumpToRecord, showNotForPfsColumn }: {
  med: GpConnectMedication
  record: GpConnectMedicationsRecord
  selected?: boolean
  selectedIssueId?: string
  onSelect?: (id: string) => void
  onSelectIssue?: (medId: string, issueId: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  showNotForPfsColumn?: boolean
}) {
  const expanded = !!selected
  const [showDetail, setShowDetail] = useState(false)
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null)
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const pt = med.prescriptionType?.toLowerCase() ?? ''
  const isRepeat = pt === 'repeat' || pt.includes('dispensing')

  const summaryPersonLabel = med.prescriber ? 'Prescriber' : 'Recorder'
  const summaryPersonName  = med.prescriber ?? med.recorder

  const issuesToDate = med.numberOfIssued !== undefined
    ? med.numberOfRepeatsAllowed !== undefined
      ? `${med.numberOfIssued} of ${med.numberOfRepeatsAllowed}`
      : String(med.numberOfIssued)
    : undefined

  const refs = [
    med.prescriberId             ? { type: 'Practitioner' as const, id: med.prescriberId,             label: 'Prescriber' } : null,
    med.recorderId               ? { type: 'Practitioner' as const, id: med.recorderId,               label: 'Recorder'   } : null,
    med.prescriberOrganisationId ? { type: 'Organisation' as const, id: med.prescriberOrganisationId, label: 'Practice'   } : null,
    med.encounterId              ? { type: 'Encounter'    as const, id: med.encounterId,              label: 'Encounter'  } : null,
    med.medicationResourceId     ? { type: 'Medication'   as const, id: med.medicationResourceId,     label: 'Medication' } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <>
      {/* Summary row */}
      <tr
        className={`border-b border-nhs-grey-5 cursor-pointer transition-colors ${selected ? 'bg-blue-100 hover:bg-blue-100' : 'hover:bg-blue-50'}`}
        onClick={() => onSelect?.(med.id)}
      >
        <td className="py-2.5 px-3">
          <div className="font-medium text-nhs-grey-1 text-sm"><DegradedTermText text={med.drugName} /></div>
        </td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">
          {med.dosageInstruction ?? [med.dose, med.frequency].filter(Boolean).join(' · ') ?? '—'}
        </td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.prescribedQuantity ?? '—'}</td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.startDate ?? 'Unknown'}</td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.lastIssuedDate ?? 'Unknown'}</td>
        <td className="py-2.5 px-3">
          <StatusBadge status={med.status} />
        </td>
        {showNotForPfsColumn && (
          <td className="py-2.5 px-3">
            {med.notForPfs && <NotForPfsBadge />}
          </td>
        )}
        <td className="py-2.5 px-3 text-nhs-grey-3 text-sm">
          {expanded ? '▲' : '▼'}
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr className="bg-blue-50 border-b border-nhs-grey-5">
          <td colSpan={showNotForPfsColumn ? 8 : 7} className="px-4 py-3">

            {/* ── Quick summary strip + Show detail button ── */}
            <div className="flex items-start justify-between gap-4 mb-3 pb-3 border-b border-nhs-grey-4">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {med.prescribedQuantity && (
                  <div>
                    <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">Quantity</p>
                    <p className="text-xs text-nhs-grey-1 mt-0.5">{med.prescribedQuantity}</p>
                  </div>
                )}
                {med.expectedSupplyDuration && (
                  <div>
                    <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">Expected supply</p>
                    <p className="text-xs text-nhs-grey-1 mt-0.5">{med.expectedSupplyDuration}</p>
                  </div>
                )}
                {isRepeat && issuesToDate && (
                  <div>
                    <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">Issues to date</p>
                    <p className="text-xs text-nhs-grey-1 mt-0.5">{issuesToDate}</p>
                  </div>
                )}
                {summaryPersonName && (
                  <div>
                    <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">{summaryPersonLabel}</p>
                    <p className="text-xs text-nhs-grey-1 mt-0.5">{summaryPersonName}</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowDetail(d => !d) }}
                className={`shrink-0 px-2.5 py-1 text-xs rounded border transition-colors ${
                  showDetail
                    ? 'bg-nhs-blue text-white border-nhs-blue'
                    : 'bg-white text-nhs-grey-2 border-nhs-grey-4 hover:border-nhs-blue hover:text-nhs-blue'
                }`}
              >
                {showDetail ? 'Hide detail' : 'Show detail'}
              </button>
            </div>

            {/* ── Full detail (expanded by Show detail) ── */}
            {showDetail && (
              <div className="mb-3 pb-3 border-b border-nhs-grey-4 space-y-3" onClick={e => e.stopPropagation()}>

                {/* Patient instructions + Pharmacy note */}
                {(med.patientInstructions || med.pharmacyInstructions) && (
                  <div className="space-y-1.5 text-sm">
                    {med.patientInstructions && (
                      <div>
                        <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Patient instructions</span>
                        <p className="mt-0.5 text-nhs-grey-1">{med.patientInstructions}</p>
                      </div>
                    )}
                    {med.pharmacyInstructions && (
                      <div>
                        <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Pharmacy / prescriber note</span>
                        <p className="mt-0.5 text-nhs-grey-1">{med.pharmacyInstructions}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Dates + Repeats */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  <Detail label="Date asserted"        value={med.dateAsserted} />
                  <Detail label="End date"             value={med.endDate} />
                  <Detail label="Authorisation expiry" value={med.authorisationExpiryDate} />
                  <Detail label="Repeats allowed"      value={med.numberOfRepeatsAllowed !== undefined ? String(med.numberOfRepeatsAllowed) : undefined} />
                </div>

                {/* Prescriber / Recorder / Practice */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Prescriber</span>
                    <p className="mt-0.5">
                      {med.prescriber
                        ? med.prescriberId
                          ? <ReferenceChip label={med.prescriber} onClick={() => toggle(med.prescriberId!)} active={openResourceId === med.prescriberId} />
                          : <span className="text-nhs-grey-1">{med.prescriber}</span>
                        : <span className="text-nhs-grey-3 italic">—</span>
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Recorder</span>
                    <p className="mt-0.5">
                      {med.recorder
                        ? med.recorderId
                          ? <ReferenceChip label={med.recorder} onClick={() => toggle(med.recorderId!)} active={openResourceId === med.recorderId} />
                          : <span className="text-nhs-grey-1">{med.recorder}</span>
                        : <span className="text-nhs-grey-3 italic">—</span>
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Practice</span>
                    <p className="mt-0.5">
                      {med.prescriberOrganisation
                        ? med.prescriberOrganisationId
                          ? <ReferenceChip label={med.prescriberOrganisation} onClick={() => toggle(med.prescriberOrganisationId!)} active={openResourceId === med.prescriberOrganisationId} />
                          : <span className="text-nhs-grey-1">{med.prescriberOrganisation}</span>
                        : <span className="text-nhs-grey-3 italic">—</span>
                      }
                    </p>
                  </div>
                </div>

                {/* Status reason / additional information (conditional) */}
                {(med.statusReason || med.statusChangeDate) && (
                  <div className="text-sm">
                    <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Status reason</span>
                    <p className="mt-0.5 text-nhs-grey-1">
                      {[med.statusReason, med.statusChangeDate && `(${med.statusChangeDate})`].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {med.additionalInformation && (
                  <div className="text-sm">
                    <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Additional information</span>
                    <p className="mt-0.5 text-nhs-grey-1 italic">{med.additionalInformation}</p>
                  </div>
                )}

                {/* Structured Dose Syntax */}
                {(med.dosageInstruction || med.dose || med.site || med.route || med.frequency) && (
                  <div className="pt-2 border-t border-nhs-grey-5">
                    <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide mb-1.5">Structured Dose Syntax</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                      {med.dosageInstruction && <Detail label="Dosage"  value={med.dosageInstruction} />}
                      {med.dose             && <Detail label="Dose"    value={med.dose} />}
                      {med.site             && <Detail label="Site"    value={med.site} />}
                      {med.route            && <Detail label="Route"   value={med.route} />}
                      {med.frequency        && <Detail label="Timing"  value={med.frequency} />}
                    </div>
                  </div>
                )}

                <ReferencedResources
                  refs={refs}
                  practitioners={record.practitioners}
                  organisations={record.organisations}
                  healthcareServices={record.healthcareServices}
                  consultations={record.consultations}
                  fhirMedications={record.fhirMedications}
                  highlightedId={openResourceId ?? undefined}
                  onJumpToSource={onJumpToSource}
                  onJumpToRecord={onJumpToRecord}
                />
              </div>
            )}

            {/* ── Issues section ── */}
            <div>
              <p className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide mb-2 flex items-center gap-1">
                Issues ({med.issues.length})
                {onSelectIssue && med.issues.length > 0 && (
                  <span className="normal-case font-normal text-nhs-grey-3 ml-1">· click row to inspect FHIR source</span>
                )}
                {med.issues.length > 0 && <InfoHint topic="clinical.medications.issues-detail" />}
              </p>
              {med.issues.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-nhs-grey-3 uppercase tracking-wide text-left">
                      <th className="pb-1 pr-4 font-semibold">Issue date</th>
                      <th className="pb-1 pr-4 font-semibold">Start date</th>
                      <th className="pb-1 pr-4 font-semibold">End date</th>
                      <th className="pb-1 pr-4 font-semibold">Quantity</th>
                      <th className="pb-1 pr-4 font-semibold">Status</th>
                      <th className="pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {med.issues.map(issue => {
                      const detailOpen = detailIssueId === issue.id
                      return (
                        <Fragment key={issue.id}>
                          <tr
                            onClick={onSelectIssue ? e => { e.stopPropagation(); onSelectIssue(med.id, issue.id) } : undefined}
                            className={`transition-colors ${onSelectIssue ? 'cursor-pointer' : ''} ${selectedIssueId === issue.id ? 'bg-blue-200' : onSelectIssue ? 'hover:bg-blue-100' : ''}`}
                          >
                            <td className="py-0.5 pr-4">{issue.issueDate ?? 'Unknown'}</td>
                            <td className="py-0.5 pr-4">{issue.startDate ?? 'Unknown'}</td>
                            <td className="py-0.5 pr-4">{issue.endDate ?? 'Unknown'}</td>
                            <td className="py-0.5 pr-4">{issue.quantity ?? '—'}</td>
                            <td className="py-0.5 pr-4"><StatusBadge status={issue.status ?? 'unknown'} /></td>
                            <td className="py-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); setDetailIssueId(prev => prev === issue.id ? null : issue.id) }}
                                className={`px-1.5 py-0.5 rounded border text-xs transition-colors whitespace-nowrap ${
                                  detailOpen
                                    ? 'bg-nhs-blue text-white border-nhs-blue'
                                    : 'bg-white border-nhs-grey-4 text-nhs-grey-2 hover:border-nhs-blue hover:text-nhs-blue'
                                }`}
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                          {detailOpen && (
                            <tr>
                              <td colSpan={6} className="pb-2 pt-0.5 px-1">
                                <div className="bg-white border border-nhs-grey-4 rounded p-2.5">
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                    {[
                                      { label: 'Issue date',                  value: issue.issueDate },
                                      { label: 'Start date',                  value: issue.startDate },
                                      { label: 'End date',                    value: issue.endDate },
                                      { label: 'Status',                      value: issue.status },
                                      { label: 'Quantity',                    value: issue.quantity },
                                      { label: 'Supply duration',             value: issue.supplyDuration },
                                      { label: 'Dosage instruction',          value: issue.dosageInstruction },
                                      { label: 'Patient instructions',        value: issue.patientInstructions },
                                      { label: 'Pharmacy / prescriber note',  value: issue.pharmacyInstructions },
                                    ].filter(f => f.value).map(f => (
                                      <div key={f.label}>
                                        <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">{f.label}</span>
                                        <p className="text-nhs-grey-1 text-xs mt-0.5">{f.value}</p>
                                      </div>
                                    ))}
                                    {issue.recorder && (
                                      <div>
                                        <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Recorder</span>
                                        <p className="mt-0.5">
                                          {issue.recorderId
                                            ? <ReferenceChip label={issue.recorder} onClick={() => toggle(issue.recorderId!)} active={openResourceId === issue.recorderId} />
                                            : <span className="text-nhs-grey-1 text-xs">{issue.recorder}</span>
                                          }
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-nhs-grey-3 italic">No issues recorded for this authorisation.</p>
              )}
            </div>

          </td>
        </tr>
      )}
    </>
  )
}

function MedicationsTable({ medications, record, selectedId, selectedIssueId, onSelect, onSelectIssue, onJumpToSource, onJumpToRecord }: {
  medications: GpConnectMedication[]
  record: GpConnectMedicationsRecord
  selectedId?: string
  selectedIssueId?: string
  onSelect?: (id: string) => void
  onSelectIssue?: (medId: string, issueId: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  if (medications.length === 0) return null
  const showNotForPfsColumn = medications.some(m => m.notForPfs)
  return (
    <div className="border border-nhs-grey-5 rounded-lg overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-nhs-grey-5 text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
            <th className="py-2 px-3">Drug</th>
            <th className="py-2 px-3">Dose / Frequency</th>
            <th className="py-2 px-3">Quantity</th>
            <th className="py-2 px-3">Start date</th>
            <th className="py-2 px-3">Last issued</th>
            <th className="py-2 px-3">
              <span className="inline-flex items-center gap-1">Status <InfoHint topic="clinical.medications.status-colours" /></span>
            </th>
            {showNotForPfsColumn && <th className="py-2 px-3"></th>}
            <th className="py-2 px-3 w-6"></th>
          </tr>
        </thead>
        <tbody>
          {medications.map(med => (
            <MedicationRow
              key={med.id}
              med={med}
              record={record}
              selected={med.id === selectedId}
              selectedIssueId={med.id === selectedId ? selectedIssueId : undefined}
              onSelect={onSelect}
              onSelectIssue={onSelectIssue}
              onJumpToSource={onJumpToSource}
              showNotForPfsColumn={showNotForPfsColumn}
              onJumpToRecord={onJumpToRecord}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

type MedTab = 'acute' | 'repeat' | 'repeat-dispensing' | 'prescribed-elsewhere' | 'past' | 'other'

const TAB_DEFS: { id: MedTab; label: string; description: string }[] = [
  { id: 'acute',                label: 'Acute',                description: 'One-off prescriptions' },
  { id: 'repeat',               label: 'Repeat',               description: 'Regular repeat prescriptions' },
  { id: 'repeat-dispensing',    label: 'Repeat Dispensing',    description: 'Dispensed multiple times without reauthorisation' },
  { id: 'prescribed-elsewhere', label: 'Prescribed Elsewhere', description: 'Prescribed outside this GP practice' },
  { id: 'past',                 label: 'Past',                 description: 'Completed or stopped medications' },
  { id: 'other',                label: 'Other',                description: 'Prescription type not specified' },
]

function getPrescriptionTab(med: GpConnectMedication): MedTab {
  if (med.prescribingAgency && med.prescribingAgency !== 'prescribed-at-gp-practice') return 'prescribed-elsewhere'
  const pt = med.prescriptionType?.toLowerCase() ?? ''
  if (pt.includes('elsewhere')) return 'prescribed-elsewhere'
  if (pt.includes('dispensing')) return 'repeat-dispensing'
  if (pt === 'repeat') return 'repeat'
  if (pt === 'acute') return 'acute'
  return 'other'
}

export function MedicationsView({ record, selectedId, selectedIssueId, onSelect, onSelectIssue, onJumpToSource, onJumpToRecord }: Props) {
  // Current vs past is precomputed in extractMedications() (src/fhir/medications.ts),
  // accounting for GP supplier quirks — see classifyIsCurrent there. The
  // displayed status badge always shows the raw FHIR status unchanged.
  const isPast = (m: GpConnectMedication) => !m.isCurrent

  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredMeds = trimmedQuery
    ? record.medications.filter(m => medicationSearchText(m).includes(trimmedQuery))
    : record.medications

  const counts: Record<MedTab, GpConnectMedication[]> = {
    acute: [], repeat: [], 'repeat-dispensing': [], 'prescribed-elsewhere': [], past: [], other: [],
  }
  for (const med of filteredMeds) {
    if (isPast(med)) counts.past.push(med)
    else counts[getPrescriptionTab(med)].push(med)
  }

  const visibleTabs = TAB_DEFS.filter(t => t.id !== 'other' || counts.other.length > 0)
  const defaultTab = visibleTabs.find(t => counts[t.id].length > 0)?.id ?? 'acute'
  const [activeTab, setActiveTab] = useState<MedTab>(defaultTab)

  const activeMeds = counts[activeTab]
  const activeTabDef = TAB_DEFS.find(t => t.id === activeTab)!

  const renderTable = (meds: GpConnectMedication[]) => (
    <MedicationsTable
      medications={meds}
      record={record}
      selectedId={selectedId}
      selectedIssueId={selectedIssueId}
      onSelect={onSelect}
      onSelectIssue={onSelectIssue}
      onJumpToSource={onJumpToSource}
      onJumpToRecord={onJumpToRecord}
    />
  )

  // Within "Past", still group by the original prescription type so the
  // clinical categories (Acute / Repeat / Repeat Dispensing / Prescribed
  // Elsewhere) remain visible rather than one undifferentiated list.
  const PAST_GROUP_ORDER: MedTab[] = ['acute', 'repeat', 'repeat-dispensing', 'prescribed-elsewhere', 'other']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Medications &amp; Medical Devices</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {record.medications.length} medication{record.medications.length !== 1 ? 's' : ''} · click a row to see issues
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>

      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search medications…"
        matchCount={filteredMeds.length}
        totalCount={record.medications.length}
      />

      <div className="border-b border-nhs-grey-4">
        <div className="flex gap-0 -mb-px items-center" data-tour="medications-sub-tabs">
          <InfoHint topic="clinical.medications.subtabs" className="mr-1.5 shrink-0" />
          {visibleTabs.map(tab => {
            const count = counts[tab.id].length
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-nhs-blue text-nhs-blue'
                    : 'border-transparent text-nhs-grey-2 hover:text-nhs-grey-1 hover:border-nhs-grey-4'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                  isActive ? 'bg-nhs-blue text-white' : count > 0 ? 'bg-nhs-grey-4 text-nhs-grey-2' : 'bg-nhs-grey-5 text-nhs-grey-3'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {activeMeds.length > 0 ? (
        <div>
          <p className="text-xs text-nhs-grey-3 mb-3">{activeTabDef.description}</p>
          {activeTab === 'past' ? (
            <div className="space-y-5">
              {PAST_GROUP_ORDER.map(groupId => {
                const groupMeds = activeMeds.filter(m => getPrescriptionTab(m) === groupId)
                if (groupMeds.length === 0) return null
                return (
                  <div key={groupId}>
                    <p className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide mb-2">
                      {TAB_DEFS.find(t => t.id === groupId)!.label}
                    </p>
                    {renderTable(groupMeds)}
                  </div>
                )
              })}
            </div>
          ) : renderTable(activeMeds)}
        </div>
      ) : (
        <div className="text-center py-10 text-nhs-grey-3">
          <p className="text-sm">No {activeTabDef.label.toLowerCase()} medications in this record</p>
        </div>
      )}

      {record.medications.length === 0 && (
        <div className="text-center py-8 text-nhs-grey-3">
          <p className="text-sm">No medications found in this Bundle</p>
        </div>
      )}
    </div>
  )
}
