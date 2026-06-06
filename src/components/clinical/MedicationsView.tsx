import { useState, Fragment } from 'react'
import type { GpConnectMedication, GpConnectMedicationsRecord } from '../../fhir/types'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'

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

function MedicationRow({ med, record, selected, selectedIssueId, onSelect, onSelectIssue, onJumpToSource, onJumpToRecord }: {
  med: GpConnectMedication
  record: GpConnectMedicationsRecord
  selected?: boolean
  selectedIssueId?: string
  onSelect?: (id: string) => void
  onSelectIssue?: (medId: string, issueId: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null)
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

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
        onClick={() => { setExpanded(e => !e); onSelect?.(med.id) }}
      >
        <td className="py-2.5 px-3">
          <div className="font-medium text-nhs-grey-1 text-sm">{med.drugName}</div>
          {med.snomedCode && (
            <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{med.snomedCode}</div>
          )}
        </td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">
          {med.dosageInstruction ?? [med.dose, med.frequency].filter(Boolean).join(' · ') ?? '—'}
        </td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.route ?? '—'}</td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.startDate ?? 'Unknown'}</td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.lastIssuedDate ?? 'Unknown'}</td>
        <td className="py-2.5 px-3">
          <StatusBadge status={med.status} />
        </td>
        <td className="py-2.5 px-3 text-nhs-grey-3 text-sm">
          {expanded ? '▲' : '▼'}
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr className="bg-blue-50 border-b border-nhs-grey-5">
          <td colSpan={7} className="px-4 py-3">

            {/* ── Issues section (always shown first) ── */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
                Issues ({med.issues.length})
                {onSelectIssue && med.issues.length > 0 && (
                  <span className="normal-case font-normal text-nhs-grey-3 ml-1">· click row to inspect FHIR source</span>
                )}
              </p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowDetail(d => !d) }}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  showDetail
                    ? 'bg-nhs-blue text-white border-nhs-blue'
                    : 'bg-white text-nhs-grey-2 border-nhs-grey-4 hover:border-nhs-blue hover:text-nhs-blue'
                }`}
              >
                {showDetail ? 'Hide detail' : 'Show detail'}
              </button>
            </div>

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

            {/* ── Detail panel (hidden until "Show detail" is clicked) ── */}
            {showDetail && (
              <div className="mt-3 pt-3 border-t border-nhs-grey-4" onClick={e => e.stopPropagation()}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  <Detail label="Drug name"              value={med.drugName} />
                  <Detail label="DM+D / SNOMED code"     value={med.snomedCode} mono />
                  <Detail label="Dosage instruction"     value={med.dosageInstruction} />
                  <Detail label="Route"                  value={med.route} />
                  <Detail label="Dose"                   value={med.dose} />
                  <Detail label="Frequency"              value={med.frequency} />
                  <Detail label="Quantity"               value={med.prescribedQuantity} />
                  <Detail label="Repeats allowed"        value={med.numberOfRepeatsAllowed !== undefined ? String(med.numberOfRepeatsAllowed) : undefined} />
                  <Detail label="Issues to date"         value={
                    med.numberOfIssued !== undefined
                      ? med.numberOfRepeatsAllowed !== undefined
                        ? `${med.numberOfIssued} of ${med.numberOfRepeatsAllowed}`
                        : String(med.numberOfIssued)
                      : undefined
                  } />
                  <Detail label="Authorisation expiry"   value={med.authorisationExpiryDate} />
                  <Detail label="Prescription type"      value={med.prescriptionType} />
                  <Detail label="Start date"             value={med.startDate} />
                  <Detail label="End date"               value={med.endDate} />
                  <Detail label="Last issued"            value={med.lastIssuedDate} />
                  <Detail label="Date asserted"          value={med.dateAsserted} />
                  <Detail label="Expected supply"        value={med.expectedSupplyDuration} />
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
                  <Detail label="Patient instructions"        value={med.patientInstructions} />
                  <Detail label="Pharmacy / prescriber note"  value={med.pharmacyInstructions} />
                  {(med.statusReason || med.statusChangeDate) && (
                    <div className="col-span-2 mt-1 pt-1 border-t border-nhs-grey-5">
                      <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Status reason</span>
                      <p className="mt-0.5 text-nhs-grey-1">
                        {[med.statusReason, med.statusChangeDate && `(${med.statusChangeDate})`].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  )}
                  {med.additionalInformation && (
                    <div className="col-span-2 mt-1 pt-1 border-t border-nhs-grey-5">
                      <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Additional information</span>
                      <p className="mt-0.5 text-nhs-grey-1 italic">{med.additionalInformation}</p>
                    </div>
                  )}
                  <Detail label="FHIR ID" value={med.medicationStatementId} mono />
                </div>
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
  return (
    <div className="border border-nhs-grey-5 rounded-lg overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-nhs-grey-5 text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
            <th className="py-2 px-3">Drug</th>
            <th className="py-2 px-3">Dose / Frequency</th>
            <th className="py-2 px-3">Route</th>
            <th className="py-2 px-3">Start date</th>
            <th className="py-2 px-3">Last issued</th>
            <th className="py-2 px-3">Status</th>
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
  const isPast = (m: GpConnectMedication) => ['completed', 'stopped', 'entered-in-error'].includes(m.status)

  const counts: Record<MedTab, GpConnectMedication[]> = {
    acute: [], repeat: [], 'repeat-dispensing': [], 'prescribed-elsewhere': [], past: [], other: [],
  }
  for (const med of record.medications) {
    if (isPast(med)) counts.past.push(med)
    else counts[getPrescriptionTab(med)].push(med)
  }

  const visibleTabs = TAB_DEFS.filter(t => t.id !== 'other' || counts.other.length > 0)
  const defaultTab = visibleTabs.find(t => counts[t.id].length > 0)?.id ?? 'acute'
  const [activeTab, setActiveTab] = useState<MedTab>(defaultTab)

  const activeMeds = counts[activeTab]
  const activeTabDef = TAB_DEFS.find(t => t.id === activeTab)!

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

      <div className="border-b border-nhs-grey-4">
        <div className="flex gap-0 -mb-px">
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
          <MedicationsTable
            medications={activeMeds}
            record={record}
            selectedId={selectedId}
            selectedIssueId={selectedIssueId}
            onSelect={onSelect}
            onSelectIssue={onSelectIssue}
            onJumpToSource={onJumpToSource}
            onJumpToRecord={onJumpToRecord}
          />
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
