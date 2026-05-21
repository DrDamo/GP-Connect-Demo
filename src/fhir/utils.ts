import type { GpConnectPatient } from './types'

export type AnyResource = fhir3.Resource & { resourceType: string }

export function getEntries<T extends fhir3.Resource>(bundle: fhir3.Bundle, resourceType: string): T[] {
  return (bundle.entry ?? [])
    .map(e => e.resource as AnyResource | undefined)
    .filter((r): r is T & AnyResource => r?.resourceType === resourceType)
}

export function resolveReference(bundle: fhir3.Bundle, ref: string | undefined): AnyResource | undefined {
  if (!ref) return undefined
  return (bundle.entry ?? [])
    .map(e => e.resource as AnyResource | undefined)
    .find(r => {
      if (!r) return false
      const relRef = `${r.resourceType}/${r.id}`
      return ref === relRef || ref.endsWith(`/${relRef}`) || ref.endsWith(`/${r.id}`)
    })
}

export function formatDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function getExtensionValue(extensions: fhir3.Extension[] | undefined, url: string): fhir3.Extension | undefined {
  return extensions?.find(e => e.url === url || e.url?.endsWith(url))
}

export function getOrganisationName(bundle: fhir3.Bundle): string | undefined {
  const org = getEntries<fhir3.Organization>(bundle, 'Organization')[0]
  return org?.name
}

export function resolvePractitionerName(bundle: fhir3.Bundle, ref: string | undefined): string | undefined {
  if (!ref) return undefined
  const practitioner = resolveReference(bundle, ref) as fhir3.Practitioner | undefined
  if (!practitioner) return undefined
  const name = practitioner.name?.[0]
  if (!name) return undefined
  const given = (name.given ?? []).join(' ')
  const family = name.family ?? ''
  const prefix = (name.prefix ?? []).join(' ')
  return [prefix, given, family].filter(Boolean).join(' ')
}

export function extractPatientInfo(bundle: fhir3.Bundle): GpConnectPatient | undefined {
  const patient = getEntries<fhir3.Patient>(bundle, 'Patient')[0]
  if (!patient) return undefined
  const nhsNumber = patient.identifier?.find(
    id => id.system?.includes('nhs-number') || id.system?.includes('PDS')
  )?.value
  const name = patient.name?.[0]
  const given = (name?.given ?? []).join(' ')
  const family = name?.family ?? ''
  return {
    nhsNumber,
    familyName: family || undefined,
    givenName: given || undefined,
    dateOfBirth: formatDate(patient.birthDate),
    gender: patient.gender,
  }
}
