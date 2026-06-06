import type { GpConnectPractitioner, GpConnectOrganisation, GpConnectHealthcareService, GpConnectLocation, GpConnectFhirMedication } from './types'
import { getEntries, resolvePractitionerName, extractSnomedCode } from './utils'

export function extractPractitioners(bundle: fhir3.Bundle): GpConnectPractitioner[] {
  return getEntries<fhir3.Practitioner>(bundle, 'Practitioner').map(p => {
    const name = p.name?.[0]
    const given = (name?.given ?? []).join(' ')
    const family = name?.family ?? ''
    const prefix = (name?.prefix ?? []).join(' ')
    const display = [prefix, given, family].filter(Boolean).join(' ') || 'Unknown'

    const sdsUserId = p.identifier?.find(i =>
      i.system?.includes('sds-user-id') || i.system?.includes('SDS-User-ID')
    )?.value
    const sdsRoleProfileId = p.identifier?.find(i =>
      i.system?.includes('sds-role-profile-id') || i.system?.includes('SDS-Role-Profile-ID')
    )?.value

    return {
      id: p.id ?? '',
      name: display,
      sdsUserId,
      sdsRoleProfileId,
      gender: p.gender,
    }
  }).filter(p => p.id)
}

export function extractOrganisations(bundle: fhir3.Bundle): GpConnectOrganisation[] {
  return getEntries<fhir3.Organization>(bundle, 'Organization').map(org => {
    const odsCode = org.identifier?.find(i =>
      i.system?.includes('ods-organization-code') || i.system?.includes('ODS')
    )?.value
    const phone = org.telecom?.find(t => t.system === 'phone')?.value
    const addr = org.address?.find(a => a.use === 'work') ?? org.address?.[0]
    const address = addr
      ? [
          ...(addr.line ?? []),
          addr.city,
          addr.district,
          addr.postalCode,
        ].filter(Boolean).join(', ')
      : undefined

    return {
      id: org.id ?? '',
      name: org.name ?? 'Unknown',
      odsCode,
      phone,
      address: address || undefined,
    }
  }).filter(o => o.id)
}

export function extractHealthcareServices(bundle: fhir3.Bundle): GpConnectHealthcareService[] {
  type HcsCast = {
    id?: string
    name?: string
    comment?: string
    specialty?: fhir3.CodeableConcept[]
    providedBy?: fhir3.Reference
  }
  const entries = (bundle.entry ?? [])
    .map(e => e.resource as (HcsCast & { resourceType?: string }) | undefined)
    .filter((r): r is HcsCast & { resourceType: string } => r?.resourceType === 'HealthcareService')

  return entries.map(hcs => {
    const specialty = hcs.specialty?.[0]?.coding?.[0]?.display ?? hcs.specialty?.[0]?.text
    const providedByRef = hcs.providedBy?.reference
    const providedBy = providedByRef
      ? resolvePractitionerName(bundle, providedByRef) // falls through to undefined for Org refs
        ?? (bundle.entry ?? [])
            .map(e => e.resource as { resourceType?: string; id?: string; name?: string } | undefined)
            .find(r => r?.resourceType === 'Organization' && providedByRef.endsWith(r.id ?? ''))
            ?.name
      : undefined

    return {
      id: hcs.id ?? '',
      name: hcs.name,
      comment: hcs.comment,
      specialty,
      providedBy,
    }
  }).filter(h => h.id)
}

export function extractFhirMedications(bundle: fhir3.Bundle): GpConnectFhirMedication[] {
  return getEntries<fhir3.Medication>(bundle, 'Medication').map(med => ({
    id: med.id ?? '',
    name: med.code?.text ?? med.code?.coding?.[0]?.display ?? 'Unknown',
    snomedCode: extractSnomedCode(med.code?.coding),
  })).filter(m => m.id)
}

export function extractLocations(bundle: fhir3.Bundle): GpConnectLocation[] {
  type LocCast = { id?: string; name?: string; address?: fhir3.Address }
  return (bundle.entry ?? [])
    .map(e => e.resource as (LocCast & { resourceType?: string }) | undefined)
    .filter((r): r is LocCast & { resourceType: string } => r?.resourceType === 'Location')
    .map(loc => {
      const addr = loc.address
      const address = addr
        ? [...(addr.line ?? []), addr.city, addr.district, addr.postalCode].filter(Boolean).join(', ')
        : undefined
      return { id: loc.id ?? '', name: loc.name ?? 'Unknown', address }
    })
    .filter(l => l.id)
}
