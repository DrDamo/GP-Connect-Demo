import { useState } from 'react'
import type { GpConnectBundle, GpConnectImmunisation } from '../../fhir/types'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { InfoHint } from '../../onboarding/InfoHint'
import { SearchFilterBox } from './SearchFilterBox'

function immunisationSearchText(imm: GpConnectImmunisation): string {
  return [
    imm.vaccine, imm.dateGiven, imm.dateRecorded, imm.vaccinationProcedureDisplay, imm.vaccinationProcedureText,
    imm.vaccinationProcedureCode, imm.vaccineCodeDisplay, imm.administeringPractitioner, imm.enteringPractitioner,
    imm.route, imm.siteDisplay, imm.siteCode, imm.locationName, imm.explanationCode, imm.explanationDisplay,
    imm.explanationText, imm.batchNumber, imm.expirationDate, imm.status, ...imm.notes,
  ].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const COLUMNS: DomainColumn<GpConnectImmunisation>[] = [
  { label: 'Date given',     className: 'w-32', render: item => item.dateGiven ?? '—' },
  {
    label: 'Procedure',
    // VaccinationProcedure extension's valueCodeableConcept — for Observations
    // pulled in from the Immunisations List (no VaccinationProcedure of their
    // own), this holds their coded term instead, tagged as such.
    render: item => item.entryType === 'observation' ? (
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-nhs-grey-1">{item.vaccinationProcedureDisplay}</span>
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-nhs-grey-5 text-nhs-grey-2 border border-nhs-grey-4 font-medium">
          Observation
        </span>
        <InfoHint topic="clinical.immunisations.observation-badge" />
      </span>
    ) : (
      item.vaccinationProcedureDisplay ?? item.vaccinationProcedureText ?? '—'
    ),
  },
  {
    label: 'Vaccine',
    // The base vaccineCode field — left blank (not "Unknown") when it's a
    // NullFlavor placeholder, and Observations have no vaccineCode at all.
    render: item => item.entryType === 'observation' ? '' : (
      <span className="font-medium text-nhs-grey-1">{item.vaccineCodeDisplay ?? ''}</span>
    ),
  },
  { label: 'Administered by',                   render: item => item.administeringPractitioner ?? '—' },
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

function ImmunisationDetail({ immunisation, bundle, onJumpToSource, onJumpToRecord }: { immunisation: GpConnectImmunisation; bundle: GpConnectBundle; onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void }) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const refs = [
    immunisation.administeringPractitionerId ? { type: 'Practitioner' as const, id: immunisation.administeringPractitionerId, label: 'Administered by' } : null,
    immunisation.enteringPractitionerId      ? { type: 'Practitioner' as const, id: immunisation.enteringPractitionerId,      label: 'Entered by'      } : null,
    immunisation.locationId                  ? { type: 'Location'     as const, id: immunisation.locationId,                  label: 'Location'        } : null,
    immunisation.encounterId                 ? { type: 'Encounter'    as const, id: immunisation.encounterId,                 label: 'Encounter'       } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  const hasExplanation = !!(immunisation.explanationCode || immunisation.explanationDisplay || immunisation.explanationText)
  const hasVaccineDetail = !!(immunisation.vaccineCodeDisplay || immunisation.batchNumber || immunisation.expirationDate)

  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{immunisation.vaccine}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {immunisation.entryType === 'observation' && immunisation.codedDataId && onJumpToRecord && (
            <button
              onClick={() => onJumpToRecord('coded-data', immunisation.codedDataId!)}
              className="text-[11px] text-nhs-blue hover:underline whitespace-nowrap"
            >
              View in Coded Data →
            </button>
          )}
          <StatusBadge value={immunisation.status} />
        </div>
      </div>

      {/* Procedure section */}
      <div className="space-y-1 pt-1 border-t border-nhs-blue/20">
        <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Procedure</span>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
          {immunisation.vaccinationProcedureCode && (
            <DetailRow label="SNOMED code" value={<span className="font-mono">{immunisation.vaccinationProcedureCode}</span>} />
          )}
          {immunisation.notGiven && (
            <DetailRow label="Not given" value={<span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Not given</span>} />
          )}
          {immunisation.parentPresent !== undefined && (
            <DetailRow label="Parent" value={immunisation.parentPresent ? 'Present' : 'Not present'} />
          )}
          <DetailRow label="Date given"    value={immunisation.dateGiven} />
          <DetailRow label="Date recorded" value={immunisation.dateRecorded} />
          <DetailRow label="Route"         value={immunisation.route} />
          {immunisation.siteDisplay && <DetailRow label="Site (display)" value={immunisation.siteDisplay} />}
          {immunisation.siteCode    && <DetailRow label="Site (code)"    value={<span className="font-mono">{immunisation.siteCode}</span>} />}
          {immunisation.locationName && <DetailRow label="Location" value={immunisation.locationName} />}
          <DetailRow label="Administered by" value={
            immunisation.administeringPractitioner
              ? immunisation.administeringPractitionerId
                ? <ReferenceChip label={immunisation.administeringPractitioner} onClick={() => toggle(immunisation.administeringPractitionerId!)} active={openResourceId === immunisation.administeringPractitionerId} />
                : immunisation.administeringPractitioner
              : undefined
          } />
          <DetailRow label="Entered by" value={
            immunisation.enteringPractitioner
              ? immunisation.enteringPractitionerId
                ? <ReferenceChip label={immunisation.enteringPractitioner} onClick={() => toggle(immunisation.enteringPractitionerId!)} active={openResourceId === immunisation.enteringPractitionerId} />
                : immunisation.enteringPractitioner
              : undefined
          } />
        </div>
      </div>

      {/* Explanation section */}
      {hasExplanation && (
        <div className="space-y-1 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">
            {immunisation.explanationIsReasonNotGiven ? 'Reason not given' : 'Explanation'}
          </span>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            {immunisation.explanationText    && <DetailRow label="Text"    value={immunisation.explanationText} />}
            {immunisation.explanationDisplay && <DetailRow label="Display" value={immunisation.explanationDisplay} />}
            {immunisation.explanationCode    && <DetailRow label="Code"    value={<span className="font-mono">{immunisation.explanationCode}</span>} />}
          </div>
        </div>
      )}

      {/* Vaccine section */}
      {hasVaccineDetail && (
        <div className="space-y-1 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Vaccine</span>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            {immunisation.vaccineCodeDisplay && <DetailRow label="Vaccine" value={immunisation.vaccineCodeDisplay} />}
            {immunisation.batchNumber && (
              <DetailRow label="Batch number" value={<span className="font-mono">{immunisation.batchNumber}</span>} />
            )}
            {immunisation.expirationDate && <DetailRow label="Expiry date" value={immunisation.expirationDate} />}
          </div>
        </div>
      )}

      {/* Notes section */}
      {immunisation.notes.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Notes</span>
          {immunisation.notes.map((note, i) => (
            <p key={i} className="text-xs text-nhs-grey-1">{note}</p>
          ))}
        </div>
      )}

      <ReferencedResources
        refs={refs}
        practitioners={bundle.practitioners}
        organisations={bundle.organisations}
        healthcareServices={bundle.healthcareServices}
        locations={bundle.locations}
        consultations={bundle.consultations}
        highlightedId={openResourceId ?? undefined}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />
    </div>
  )
}

export function ImmunisationsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const count = bundle.immunisations.length
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredImmunisations = trimmedQuery
    ? bundle.immunisations.filter(i => immunisationSearchText(i).includes(trimmedQuery))
    : bundle.immunisations
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Immunisations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5 flex items-center gap-1">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
            <InfoHint topic="clinical.immunisations.procedure-vs-vaccine" />
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search immunisations…"
        matchCount={filteredImmunisations.length}
        totalCount={count}
      />
      <DomainTable
        columns={COLUMNS}
        items={filteredImmunisations}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No immunisation records found in this bundle"
        expandedContent={immunisation => <ImmunisationDetail immunisation={immunisation} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}
