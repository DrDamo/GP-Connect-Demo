import type { GpConnectPractitioner, GpConnectOrganisation, GpConnectHealthcareService, GpConnectLocation, GpConnectConsultation, GpConnectFhirMedication, GpConnectDocument } from '../../fhir/types'
import { ResourceCard, type ResourceRef } from './ResourceCard'
import { type DomainId } from './domains'

interface ReferencedResourcesProps {
  refs: ResourceRef[]
  practitioners: GpConnectPractitioner[]
  organisations: GpConnectOrganisation[]
  healthcareServices: GpConnectHealthcareService[]
  locations?: GpConnectLocation[]
  consultations?: GpConnectConsultation[]
  fhirMedications?: GpConnectFhirMedication[]
  documents?: GpConnectDocument[]
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  highlightedId?: string
}

export function ReferencedResources({ refs, practitioners, organisations, healthcareServices, locations, consultations, fhirMedications, documents, onJumpToSource, onJumpToRecord, highlightedId }: ReferencedResourcesProps) {
  const resolved = refs.filter(r => {
    if (r.type === 'Practitioner') return !!r.id
    if (r.type === 'Organisation') return organisations.some(o => o.id === r.id)
    if (r.type === 'Location') return (locations ?? []).some(l => l.id === r.id)
    if (r.type === 'Encounter') return !!r.id
    if (r.type === 'Medication') return (fhirMedications ?? []).some(m => m.id === r.id)
    if (r.type === 'Document') return (documents ?? []).some(d => d.id === r.id)
    return healthcareServices.some(h => h.id === r.id)
  })

  // GP Connect bundles often pair an Organisation and Location under the same ID.
  // When only one is referenced, surface the other automatically.
  const seenKeys = new Set(resolved.map(r => `${r.type}:${r.id}`))
  const crossLinked: ResourceRef[] = []
  for (const r of resolved) {
    if (r.type === 'Organisation' && !seenKeys.has(`Location:${r.id}`)) {
      if ((locations ?? []).some(l => l.id === r.id)) {
        crossLinked.push({ type: 'Location', id: r.id, label: 'Location' })
        seenKeys.add(`Location:${r.id}`)
      }
    }
    if (r.type === 'Location' && !seenKeys.has(`Organisation:${r.id}`)) {
      if (organisations.some(o => o.id === r.id)) {
        crossLinked.push({ type: 'Organisation', id: r.id, label: 'Organisation' })
        seenKeys.add(`Organisation:${r.id}`)
      }
    }
  }
  const displayed = [...resolved, ...crossLinked]

  if (displayed.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-nhs-grey-4 space-y-2">
      <p className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">Referenced resources</p>
      {displayed.map(r => (
        <ResourceCard
          key={`${r.type}-${r.id}-${r.label}`}
          ref_={r}
          practitioners={practitioners}
          organisations={organisations}
          healthcareServices={healthcareServices}
          locations={locations}
          consultations={consultations}
          fhirMedications={fhirMedications}
          documents={documents}
          onJumpToSource={onJumpToSource}
          onJumpToRecord={onJumpToRecord}
          forceOpen={highlightedId === r.id}
        />
      ))}
    </div>
  )
}
