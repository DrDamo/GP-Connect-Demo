import { useState, useEffect } from 'react'
import type { GpConnectBundle, GpConnectPractitioner, GpConnectPractitionerRole, GpConnectOrganisation, GpConnectHealthcareService, GpConnectLocation, GpConnectFhirMedication, CodeStatus } from '../../fhir/types'
import { SearchFilterBox } from './SearchFilterBox'
import { CodeStatusBadge } from './DomainTable'

function practitionerSearchText(p: GpConnectPractitioner, roles: GpConnectPractitionerRole[], organisations: GpConnectOrganisation[]): string {
  const myRoles = roles.filter(r => r.practitionerId === p.id)
  return [
    p.name, p.sdsUserId, p.sdsRoleProfileId, p.gender,
    ...myRoles.flatMap(r => [r.jobRole, organisations.find(o => o.id === r.organisationId)?.name]),
  ].filter(Boolean).join(' ').toLowerCase()
}

function organisationSearchText(o: GpConnectOrganisation): string {
  return [o.name, o.odsCode, o.phone, o.address].filter(Boolean).join(' ').toLowerCase()
}

function locationSearchText(l: GpConnectLocation): string {
  return [l.name, l.address].filter(Boolean).join(' ').toLowerCase()
}

function healthcareServiceSearchText(h: GpConnectHealthcareService): string {
  return [h.name, h.specialty, h.providedBy, h.comment].filter(Boolean).join(' ').toLowerCase()
}

function medicationResourceSearchText(m: GpConnectFhirMedication): string {
  return [m.name, m.snomedCode, ...(m.alternativeCodes ?? []).flatMap(c => [c.label, c.code])].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="text-nhs-grey-3 w-40 shrink-0">{label}</span>
      <span className="text-nhs-grey-1">{value}</span>
    </div>
  )
}

function CollapsibleSectionHeader({ title, count, open, onToggle }: {
  title: string; count: number; open: boolean; onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 border-b border-nhs-grey-4 mb-2 group text-left"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-nhs-grey-1">{title}</span>
        <span className="text-xs px-1.5 py-0.5 bg-nhs-grey-4 text-nhs-grey-2 rounded-full font-semibold">{count}</span>
      </div>
      <span className="text-xs text-nhs-grey-3 transition-transform select-none">{open ? '▲' : '▼'}</span>
    </button>
  )
}

function PractitionerCard({ p, roles, organisations, selected, onSelect, onJumpToSource }: {
  p: GpConnectPractitioner
  roles: GpConnectPractitionerRole[]
  organisations: GpConnectOrganisation[]
  selected: boolean
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
}) {
  const myRoles = roles.filter(r => r.practitionerId === p.id)
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${selected ? 'border-nhs-blue bg-blue-50' : 'border-nhs-grey-4 bg-white hover:border-nhs-blue/40'} ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(p.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-nhs-grey-1">{p.name}</div>
        <div className="flex gap-1.5 shrink-0">
          <span className="text-xs px-1.5 py-0.5 bg-nhs-grey-5 text-nhs-grey-2 rounded border border-nhs-grey-4">Practitioner</span>
          {onJumpToSource && (
            <button onClick={e => { e.stopPropagation(); onJumpToSource(p.id) }} className="text-xs text-nhs-blue hover:underline">FHIR ↗</button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <Row label="SDS User ID"         value={p.sdsUserId} />
        <Row label="SDS Role Profile ID" value={p.sdsRoleProfileId} />
        <Row label="Gender"              value={p.gender} />
        <Row label="Resource ID"         value={p.id} />
      </div>
      {myRoles.length > 0 && (
        <div className="mt-2 pt-2 border-t border-nhs-grey-4 space-y-1.5">
          <p className="text-[10px] font-semibold text-nhs-grey-3 uppercase tracking-wide">Practitioner Roles</p>
          {myRoles.map(role => {
            const orgName = role.organisationId
              ? organisations.find(o => o.id === role.organisationId)?.name
              : undefined
            return (
              <div key={role.id} className="flex items-start justify-between gap-2">
                <div className="text-xs text-nhs-grey-1 space-y-0.5">
                  {role.jobRole && <span className="font-medium">{role.jobRole}</span>}
                  {orgName && <span className="text-nhs-grey-3"> · {orgName}</span>}
                </div>
                {onJumpToSource && (
                  <button
                    onClick={e => { e.stopPropagation(); onJumpToSource(role.id) }}
                    className="text-xs text-nhs-blue hover:underline shrink-0"
                  >
                    FHIR ↗
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OrganisationCard({ o, selected, onSelect, onJumpToSource }: {
  o: GpConnectOrganisation; selected: boolean
  onSelect?: (id: string) => void; onJumpToSource?: (id: string) => void
}) {
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${selected ? 'border-nhs-blue bg-blue-50' : 'border-nhs-grey-4 bg-white hover:border-nhs-blue/40'} ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(o.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-nhs-grey-1">{o.name}</div>
        <div className="flex gap-1.5 shrink-0">
          <span className="text-xs px-1.5 py-0.5 bg-nhs-grey-5 text-nhs-grey-2 rounded border border-nhs-grey-4">Organisation</span>
          {onJumpToSource && (
            <button onClick={e => { e.stopPropagation(); onJumpToSource(o.id) }} className="text-xs text-nhs-blue hover:underline">FHIR ↗</button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <Row label="ODS Code"    value={o.odsCode} />
        <Row label="Phone"       value={o.phone} />
        <Row label="Address"     value={o.address} />
        <Row label="Resource ID" value={o.id} />
      </div>
    </div>
  )
}

function LocationCard({ l, selected, onSelect, onJumpToSource }: {
  l: GpConnectLocation; selected: boolean
  onSelect?: (id: string) => void; onJumpToSource?: (id: string) => void
}) {
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${selected ? 'border-nhs-blue bg-blue-50' : 'border-nhs-grey-4 bg-white hover:border-nhs-blue/40'} ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(l.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-nhs-grey-1">{l.name}</div>
        <div className="flex gap-1.5 shrink-0">
          <span className="text-xs px-1.5 py-0.5 bg-nhs-grey-5 text-nhs-grey-2 rounded border border-nhs-grey-4">Location</span>
          {onJumpToSource && (
            <button onClick={e => { e.stopPropagation(); onJumpToSource(l.id) }} className="text-xs text-nhs-blue hover:underline">FHIR ↗</button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <Row label="Address"     value={l.address} />
        <Row label="Resource ID" value={l.id} />
      </div>
    </div>
  )
}

function MedicationResourceCard({ m, status, selected, onSelect, onJumpToSource }: {
  m: GpConnectFhirMedication; status?: CodeStatus; selected: boolean
  onSelect?: (id: string) => void; onJumpToSource?: (id: string) => void
}) {
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${selected ? 'border-nhs-blue bg-blue-50' : 'border-nhs-grey-4 bg-white hover:border-nhs-blue/40'} ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(m.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-nhs-grey-1">{m.name}</div>
        <div className="flex gap-1.5 shrink-0">
          <span className="text-xs px-1.5 py-0.5 bg-nhs-grey-5 text-nhs-grey-2 rounded border border-nhs-grey-4">Medication</span>
          {onJumpToSource && (
            <button onClick={e => { e.stopPropagation(); onJumpToSource(m.id) }} className="text-xs text-nhs-blue hover:underline">FHIR ↗</button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Row label="SNOMED / DM+D" value={m.snomedCode} />
          <CodeStatusBadge status={status} />
        </div>
        {m.alternativeCodes?.map(c => (
          <Row key={c.label} label={c.label} value={c.code} />
        ))}
        <Row label="Resource ID"   value={m.id} />
      </div>
    </div>
  )
}

function HealthcareServiceCard({ h, selected, onSelect, onJumpToSource }: {
  h: GpConnectHealthcareService; selected: boolean
  onSelect?: (id: string) => void; onJumpToSource?: (id: string) => void
}) {
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${selected ? 'border-nhs-blue bg-blue-50' : 'border-nhs-grey-4 bg-white hover:border-nhs-blue/40'} ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(h.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-nhs-grey-1">{h.name ?? h.id}</div>
        <div className="flex gap-1.5 shrink-0">
          <span className="text-xs px-1.5 py-0.5 bg-nhs-grey-5 text-nhs-grey-2 rounded border border-nhs-grey-4">Healthcare Service</span>
          {onJumpToSource && (
            <button onClick={e => { e.stopPropagation(); onJumpToSource(h.id) }} className="text-xs text-nhs-blue hover:underline">FHIR ↗</button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <Row label="Specialty"   value={h.specialty} />
        <Row label="Provided by" value={h.providedBy} />
        <Row label="Comment"     value={h.comment} />
        <Row label="Resource ID" value={h.id} />
      </div>
    </div>
  )
}

type SectionKey = 'practitioners' | 'organisations' | 'locations' | 'healthcareServices' | 'fhirMedications'

export function SupportingResourcesView({ bundle, selectedId, onSelect, onJumpToSource }: Props) {
  const {
    practitioners: allPractitioners, practitionerRoles,
    organisations: allOrganisations, healthcareServices: allHealthcareServices,
    locations: allLocations, fhirMedications: allFhirMedications,
  } = bundle
  const total = allPractitioners.length + allOrganisations.length + allHealthcareServices.length + allLocations.length + allFhirMedications.length

  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()

  const practitioners = trimmedQuery
    ? allPractitioners.filter(p => practitionerSearchText(p, practitionerRoles, allOrganisations).includes(trimmedQuery))
    : allPractitioners
  const organisations = trimmedQuery
    ? allOrganisations.filter(o => organisationSearchText(o).includes(trimmedQuery))
    : allOrganisations
  const locations = trimmedQuery
    ? allLocations.filter(l => locationSearchText(l).includes(trimmedQuery))
    : allLocations
  const healthcareServices = trimmedQuery
    ? allHealthcareServices.filter(h => healthcareServiceSearchText(h).includes(trimmedQuery))
    : allHealthcareServices
  const fhirMedications = trimmedQuery
    ? allFhirMedications.filter(m => medicationResourceSearchText(m).includes(trimmedQuery))
    : allFhirMedications
  const matchTotal = practitioners.length + organisations.length + locations.length + healthcareServices.length + fhirMedications.length

  const findSection = (id: string): SectionKey | null => {
    if (allPractitioners.some(p => p.id === id))      return 'practitioners'
    if (allOrganisations.some(o => o.id === id))       return 'organisations'
    if (allLocations.some(l => l.id === id))           return 'locations'
    if (allHealthcareServices.some(h => h.id === id))  return 'healthcareServices'
    if (allFhirMedications.some(m => m.id === id))     return 'fhirMedications'
    return null
  }

  const [openSections, setOpenSections] = useState<Set<SectionKey>>(() => {
    if (!selectedId) return new Set()
    const s = findSection(selectedId)
    return s ? new Set([s]) : new Set()
  })

  useEffect(() => {
    if (!selectedId) return
    const s = findSection(selectedId)
    if (!s) return
    setOpenSections(prev => {
      if (prev.has(s)) return prev
      const next = new Set(prev)
      next.add(s)
      return next
    })
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: SectionKey) =>
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Supporting Resources</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {total} resource{total !== 1 ? 's' : ''} — Practitioners, Organisations, Locations, Healthcare Services and Medications referenced in this bundle
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>

      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search supporting resources…"
        matchCount={matchTotal}
        totalCount={total}
      />

      {practitioners.length > 0 && (
        <div>
          <CollapsibleSectionHeader title="Practitioners" count={practitioners.length} open={openSections.has('practitioners') || !!trimmedQuery} onToggle={() => toggle('practitioners')} />
          {(openSections.has('practitioners') || !!trimmedQuery) && (
            <div className="grid grid-cols-1 gap-3">
              {practitioners.map(p => (
                <PractitionerCard key={p.id} p={p} roles={practitionerRoles} organisations={organisations} selected={selectedId === p.id} onSelect={onSelect} onJumpToSource={onJumpToSource} />
              ))}
            </div>
          )}
        </div>
      )}

      {organisations.length > 0 && (
        <div>
          <CollapsibleSectionHeader title="Organisations" count={organisations.length} open={openSections.has('organisations') || !!trimmedQuery} onToggle={() => toggle('organisations')} />
          {(openSections.has('organisations') || !!trimmedQuery) && (
            <div className="grid grid-cols-1 gap-3">
              {organisations.map(o => (
                <OrganisationCard key={o.id} o={o} selected={selectedId === o.id} onSelect={onSelect} onJumpToSource={onJumpToSource} />
              ))}
            </div>
          )}
        </div>
      )}

      {locations.length > 0 && (
        <div>
          <CollapsibleSectionHeader title="Locations" count={locations.length} open={openSections.has('locations') || !!trimmedQuery} onToggle={() => toggle('locations')} />
          {(openSections.has('locations') || !!trimmedQuery) && (
            <div className="grid grid-cols-1 gap-3">
              {locations.map(l => (
                <LocationCard key={l.id} l={l} selected={selectedId === l.id} onSelect={onSelect} onJumpToSource={onJumpToSource} />
              ))}
            </div>
          )}
        </div>
      )}

      {healthcareServices.length > 0 && (
        <div>
          <CollapsibleSectionHeader title="Healthcare Services" count={healthcareServices.length} open={openSections.has('healthcareServices') || !!trimmedQuery} onToggle={() => toggle('healthcareServices')} />
          {(openSections.has('healthcareServices') || !!trimmedQuery) && (
            <div className="grid grid-cols-1 gap-3">
              {healthcareServices.map(h => (
                <HealthcareServiceCard key={h.id} h={h} selected={selectedId === h.id} onSelect={onSelect} onJumpToSource={onJumpToSource} />
              ))}
            </div>
          )}
        </div>
      )}

      {fhirMedications.length > 0 && (
        <div>
          <CollapsibleSectionHeader title="Medications" count={fhirMedications.length} open={openSections.has('fhirMedications') || !!trimmedQuery} onToggle={() => toggle('fhirMedications')} />
          {(openSections.has('fhirMedications') || !!trimmedQuery) && (
            <div className="grid grid-cols-1 gap-3">
              {fhirMedications.map(m => (
                <MedicationResourceCard key={m.id} m={m} status={m.snomedCode ? bundle.snomedStatus?.[m.snomedCode] : undefined} selected={selectedId === m.id} onSelect={onSelect} onJumpToSource={onJumpToSource} />
              ))}
            </div>
          )}
        </div>
      )}

      {total === 0 && (
        <div className="text-center py-10 text-nhs-grey-3">
          <p className="text-sm">No supporting resources found in this bundle</p>
        </div>
      )}
      {total > 0 && trimmedQuery && matchTotal === 0 && (
        <div className="text-center py-10 text-nhs-grey-3">
          <p className="text-sm">No supporting resources match "{searchQuery.trim()}"</p>
        </div>
      )}
    </div>
  )
}
