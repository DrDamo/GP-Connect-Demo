import type { GpConnectPatient, GpConnectContact } from './types'

export type AnyResource = fhir3.Resource & { resourceType: string }

// Some vendor exports include the exact same resource id twice within a
// single bundle (invalid per the FHIR spec, but seen in real GP Connect
// exports) — de-duplicate by id, keeping the first occurrence, so callers
// never see the same clinical record rendered as two rows.
export function getEntries<T extends fhir3.Resource>(bundle: fhir3.Bundle, resourceType: string): T[] {
  const seenIds = new Set<string>()
  const results: (T & AnyResource)[] = []
  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as AnyResource | undefined
    if (r?.resourceType !== resourceType) continue
    if (r.id) {
      if (seenIds.has(r.id)) continue
      seenIds.add(r.id)
    }
    results.push(r as T & AnyResource)
  }
  return results
}

export function resolveReference(bundle: fhir3.Bundle, ref: string | undefined): AnyResource | undefined {
  if (!ref) return undefined
  // Local contained reference (#id) — search all List.contained[] arrays
  if (ref.startsWith('#')) {
    const localId = ref.slice(1)
    for (const entry of bundle.entry ?? []) {
      const contained = (entry.resource as { contained?: fhir3.Resource[] } | undefined)?.contained
      if (contained) {
        const found = contained.find(c => c.id === localId)
        if (found) return found as AnyResource
      }
    }
    return undefined
  }
  return (bundle.entry ?? [])
    .map(e => e.resource as AnyResource | undefined)
    .find(r => {
      if (!r) return false
      const relRef = `${r.resourceType}/${r.id}`
      // Match by ResourceType/id only. The bare-id fallback (ref.endsWith(`/${r.id}`))
      // is intentionally omitted: it ignores resource type and causes wrong matches
      // when two resources share the same id (e.g. Organization/1 matching Patient/1).
      return ref === relRef || ref.endsWith(`/${relRef}`)
    })
}

/** Returns a lexicographically sortable key from any FHIR date/datetime string.
 *  Partial dates are padded so year < year-month < year-month-day ordering is preserved.
 *  Missing dates return '' so they sort to the end of a descending sort. */
export function fhirDateKey(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  if (/^\d{4}$/.test(dateStr)) return `${dateStr}-00-00`
  if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-00`
  return dateStr.substring(0, 10)
}

export function formatDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined

  // Year-only: "1989"
  if (/^\d{4}$/.test(dateStr)) return dateStr

  // Year-month: "1985-04" → "Apr 1985"
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split('-').map(Number)
    try {
      return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    } catch {
      return dateStr
    }
  }

  try {
    // Date-only "YYYY-MM-DD" — parse as UTC to avoid timezone-shift rendering as previous day
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    }
    // Datetime with timezone info — let the engine handle it in local time
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function getExtensionValue(extensions: fhir3.Extension[] | undefined, url: string): fhir3.Extension | undefined {
  return extensions?.find(e => e.url === url || e.url?.endsWith(url))
}

/** Extract SNOMED CT code from a coding array, preferring system='http://snomed.info/sct' over coding[0].
 *  Needed because EMIS places proprietary/Read v2 codes as coding[0] with SNOMED as coding[1]. */
export function extractSnomedCode(codings: fhir3.Coding[] | undefined): string | undefined {
  if (!codings?.length) return undefined
  return codings.find(c => c.system === 'http://snomed.info/sct')?.code ?? codings[0].code
}

export function extractSnomedDisplay(codings: fhir3.Coding[] | undefined): string | undefined {
  if (!codings?.length) return undefined
  return codings.find(c => c.system === 'http://snomed.info/sct')?.display ?? codings[0].display
}

export function resolveResourceName(bundle: fhir3.Bundle, ref: string | undefined): string | undefined {
  if (!ref) return undefined
  const resource = resolveReference(bundle, ref)
  if (!resource) return undefined
  if (resource.resourceType === 'Practitioner') return resolvePractitionerName(bundle, ref)
  if (resource.resourceType === 'Organization') return (resource as fhir3.Organization).name
  if (resource.resourceType === 'HealthcareService') return (resource as unknown as { name?: string }).name
  return undefined
}

export function getOrganisationName(bundle: fhir3.Bundle): string | undefined {
  const org = getEntries<fhir3.Organization>(bundle, 'Organization')[0]
  return org?.name
}

export function extractId(ref: string | undefined): string | undefined {
  if (!ref) return undefined
  return ref.split('/').pop()
}

export function resolvePractitionerRef(
  bundle: fhir3.Bundle,
  ref: string | undefined
): { name?: string; id?: string } {
  if (!ref) return {}
  return { name: resolvePractitionerName(bundle, ref), id: extractId(ref) }
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

/** Resolve a human-readable label for any clinical resource referenced by a FHIR reference string. */
export function resolveItemDisplay(bundle: fhir3.Bundle, ref: string | undefined): string | undefined {
  if (!ref) return undefined
  const resource = resolveReference(bundle, ref) as AnyResource & Record<string, any> | undefined
  if (!resource) return undefined
  const r = resource as Record<string, any>

  // Encounter: type is an array — pick first entry's text or display
  if (resource.resourceType === 'Encounter') {
    const typeArr = r.type as Array<{ text?: string; coding?: Array<{ display?: string }> }> | undefined
    return typeArr?.[0]?.text ?? typeArr?.[0]?.coding?.[0]?.display
  }

  // MedicationStatement / MedicationRequest: follow medicationReference to Medication resource
  if (resource.resourceType === 'MedicationStatement' || resource.resourceType === 'MedicationRequest') {
    const inline: string | undefined = r.medicationCodeableConcept?.coding?.[0]?.display ?? r.medicationCodeableConcept?.text
    if (inline) return inline
    const medRef = (r.medicationReference as { reference?: string } | undefined)?.reference
    if (medRef) {
      const med = resolveReference(bundle, medRef) as Record<string, any> | undefined
      return med?.code?.coding?.[0]?.display ?? med?.code?.text
    }
    return undefined
  }

  // Immunization: vaccineCode is often a NullFlavor placeholder ("unknown"/UNK) —
  // fall back to the VaccinationProcedure extension, which carries the real term.
  if (resource.resourceType === 'Immunization') {
    const vaccineCodings = r.vaccineCode?.coding as fhir3.Coding[] | undefined
    const isNullFlavor = vaccineCodings?.every(c => c.system === 'http://hl7.org/fhir/v3/NullFlavor')
    const vaccineDisplay = r.vaccineCode?.text ?? (isNullFlavor ? undefined : vaccineCodings?.[0]?.display)
    if (vaccineDisplay) return vaccineDisplay
    const vpExt = getExtensionValue(r.extension, 'Extension-CareConnect-VaccinationProcedure-1')
    const vpCC = vpExt?.valueCodeableConcept as fhir3.CodeableConcept | undefined
    const vpCoding = vpCC?.coding?.find(c => c.system === 'http://snomed.info/sct') ?? vpCC?.coding?.[0]
    return vpCoding?.display ?? vpCC?.text
  }

  const codeName =
    (r.code?.coding as fhir3.Coding[] | undefined)?.find(c => c.system === 'http://snomed.info/sct')?.display ??
    r.code?.coding?.[0]?.display ??
    r.code?.text ??
    r.vaccineCode?.coding?.[0]?.display ??
    r.vaccineCode?.text ??
    r.medicationCodeableConcept?.coding?.[0]?.display ??
    r.medicationCodeableConcept?.text ??
    r.type?.coding?.[0]?.display ??
    r.type?.text ??
    r.description as string | undefined

  if (resource.resourceType === 'Observation') {
    let valueStr: string | undefined
    if (typeof r.valueString === 'string') {
      valueStr = r.valueString
    } else if (r.valueQuantity) {
      const v = r.valueQuantity.value !== undefined ? String(r.valueQuantity.value) : ''
      const u = r.valueQuantity.unit ?? r.valueQuantity.code ?? ''
      valueStr = [v, u].filter(Boolean).join(' ')
    } else if (r.valueCodeableConcept) {
      valueStr = r.valueCodeableConcept.coding?.[0]?.display ?? r.valueCodeableConcept.text
    } else if (typeof r.valueBoolean === 'boolean') {
      valueStr = r.valueBoolean ? 'Yes' : 'No'
    } else if (r.component?.length) {
      // e.g. blood pressure — show as "val1 / val2 unit"
      const parts = (r.component as any[]).map(c => {
        const v = c.valueQuantity?.value
        const u = c.valueQuantity?.unit ?? ''
        return v !== undefined ? `${v} ${u}`.trim() : undefined
      }).filter(Boolean)
      if (parts.length) valueStr = parts.join(' / ')
    }
    if (codeName && valueStr) return `${codeName}: ${valueStr}`
    return codeName ?? valueStr
  }

  if (resource.resourceType === 'Practitioner') {
    const name = r.name?.[0]
    if (name) return [name.prefix?.join(' '), name.given?.join(' '), name.family].filter(Boolean).join(' ')
  }
  if (resource.resourceType === 'Organization') return r.name as string | undefined
  if (resource.resourceType === 'ReferralRequest') {
    const reasonCC = (r.reasonCode as fhir3.CodeableConcept[] | undefined)?.[0]
    const reasonCoding = reasonCC?.coding?.find(c => c.system === 'http://snomed.info/sct') ?? reasonCC?.coding?.[0]
    return reasonCC?.text ?? reasonCoding?.display ?? (r.description as string | undefined)
  }

  return codeName
}

export function extractPatientInfo(bundle: fhir3.Bundle): GpConnectPatient | undefined {
  const patient = getEntries<fhir3.Patient>(bundle, 'Patient')[0]
  if (!patient) return undefined

  const id = patient.id

  // NHS number + verification status
  const nhsIdentifier = patient.identifier?.find(
    id => id.system?.includes('nhs-number') || id.system?.includes('PDS')
  )
  const nhsNumber = nhsIdentifier?.value
  const nhsVerifyExt = (nhsIdentifier?.extension ?? []).find(e =>
    e.url?.includes('NHSNumberVerificationStatus')
  )
  const nhsVerifyCoding = (nhsVerifyExt?.valueCodeableConcept as any)?.coding?.[0]
  const nhsNumberVerified = nhsVerifyCoding !== undefined ? nhsVerifyCoding.code === '01' : undefined
  const nhsNumberVerificationDisplay = nhsVerifyCoding?.display as string | undefined

  const name = patient.name?.[0]
  const prefix = (name?.prefix ?? []).join(' ') || undefined
  const given = (name?.given ?? []).join(' ')
  const family = name?.family ?? ''

  const isActive = patient.active

  // Registration extension
  const regExt = (patient.extension ?? []).find(e => e.url?.includes('RegistrationDetails'))
  const regSubExts = (regExt as any)?.extension as Array<{ url: string; [k: string]: any }> | undefined ?? []
  const registrationType = regSubExts.find(e => e.url === 'registrationType')
    ?.valueCodeableConcept?.coding?.[0]?.display as string | undefined
  const regPeriodStart = regSubExts.find(e => e.url === 'registrationPeriod')
    ?.valuePeriod?.start as string | undefined
  const registrationStart = formatDate(regPeriodStart)

  // Preferred branch surgery — resolve by id from bundle
  const branchRef = regSubExts.find(e => e.url === 'preferredBranchSurgery')
    ?.valueReference?.reference as string | undefined
  const branchId = extractId(branchRef)
  const branchResource = branchId
    ? (bundle.entry ?? []).find(e => (e.resource as any)?.id === branchId)?.resource as any
    : undefined
  const preferredBranchSurgery = branchResource?.name as string | undefined

  // Address
  const addr = patient.address?.find(a => a.use === 'home') ?? patient.address?.[0]
  const address = addr
    ? [...(addr.line ?? []), addr.city, addr.district, addr.postalCode].filter(Boolean).join(', ')
    : undefined

  // Telecom
  const telecoms = patient.telecom ?? []
  const phone = telecoms.find(t => t.system === 'phone')?.value
  const email = telecoms.find(t => t.system === 'email')?.value

  // Registered GP
  const gpRef = (patient.generalPractitioner as fhir3.Reference[] | undefined)?.[0]?.reference
  const gpId = gpRef ? extractId(gpRef) : undefined
  const gpResource = gpId
    ? (bundle.entry ?? []).find(e => (e.resource as any)?.id === gpId)?.resource as fhir3.Practitioner | undefined
    : undefined
  const gpName = gpResource
    ? (() => {
        const n = gpResource.name?.[0]
        return [n?.prefix?.join(' '), n?.given?.join(' '), n?.family].filter(Boolean).join(' ') || undefined
      })()
    : undefined

  // Managing organisation
  const managingOrgRef = (patient.managingOrganization as fhir3.Reference | undefined)?.reference
  const managingOrgId = extractId(managingOrgRef)
  const managingOrgResource = resolveReference(bundle, managingOrgRef) as fhir3.Organization | undefined
  const managingOrganisationName = managingOrgResource?.name

  // Preferred spoken/written language (NHSCommunication extension)
  const commExts = (patient.extension ?? []).filter(e => e.url?.includes('NHSCommunication'))
  const commSubExtsList = commExts.map(
    e => (e as any).extension as Array<{ url: string; [k: string]: any }> | undefined ?? []
  )
  const preferredCommSubExts =
    commSubExtsList.find(subs => subs.find(s => s.url === 'preferred')?.valueBoolean === true) ??
    commSubExtsList[0] ?? []
  const preferredLanguage = preferredCommSubExts.find(e => e.url === 'language')
    ?.valueCodeableConcept?.coding?.[0]?.display as string | undefined
  const communicationProficiency = preferredCommSubExts.find(e => e.url === 'communicationProficiency')
    ?.valueCodeableConcept?.coding?.[0]?.display as string | undefined
  const modeOfCommunication = preferredCommSubExts.find(e => e.url === 'modeOfCommunication')
    ?.valueCodeableConcept?.coding?.[0]?.display as string | undefined
  const interpreterRequired = preferredCommSubExts.find(e => e.url === 'interpreterRequired')
    ?.valueBoolean as boolean | undefined

  // Next of kin / emergency contact
  const contacts: GpConnectContact[] = (patient.contact ?? []).map(c => {
    const cn = c.name
    const contactName = [
      (cn?.prefix ?? []).join(' '),
      (cn?.given ?? []).join(' '),
      cn?.family,
    ].filter(Boolean).join(' ') || undefined
    const relationship = (c.relationship ?? [])
      .map(r => r.text ?? r.coding?.[0]?.display)
      .filter(Boolean)
      .join(', ') || undefined
    const contactPhone = c.telecom?.find(t => t.system === 'phone')?.value
    return { name: contactName, relationship, phone: contactPhone, gender: c.gender }
  })

  return {
    id,
    nhsNumber,
    nhsNumberVerified,
    nhsNumberVerificationDisplay,
    prefix,
    familyName: family || undefined,
    givenName: given || undefined,
    dateOfBirth: formatDate(patient.birthDate),
    gender: patient.gender,
    isActive,
    registrationType,
    registrationStart,
    preferredBranchSurgery,
    address,
    phone,
    email,
    registeredGpName: gpName,
    registeredGpId: gpId,
    preferredLanguage,
    interpreterRequired,
    communicationProficiency,
    modeOfCommunication,
    managingOrganisationName,
    managingOrganisationId: managingOrgId,
    contacts: contacts.length ? contacts : undefined,
  }
}
