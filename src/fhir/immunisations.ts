import type { GpConnectImmunisation } from './types'
import { getEntries, formatDate, resolvePractitionerRef, getExtensionValue, extractSnomedCode, extractId, fhirDateKey } from './utils'

export function extractImmunisations(bundle: fhir3.Bundle): GpConnectImmunisation[] {
  return getEntries<fhir3.Immunization>(bundle, 'Immunization')
    .sort((a, b) => fhirDateKey(b.date).localeCompare(fhirDateKey(a.date)))
    .map(resource => {
    const cast = resource as unknown as Record<string, unknown>

    // VaccinationProcedure extension carries the real SNOMED code when vaccineCode = UNK
    const vpExt = getExtensionValue(resource.extension, 'Extension-CareConnect-VaccinationProcedure-1')
    const vpCC = vpExt?.valueCodeableConcept as fhir3.CodeableConcept | undefined
    const vaccinationProcedureCode = extractSnomedCode(vpCC?.coding)
    const vpSnomedCoding = vpCC?.coding?.find(c => c.system === 'http://snomed.info/sct') ?? vpCC?.coding?.[0]
    // display = clinical SNOMED term (for detail); text = short label including dose number
    const vaccinationProcedureDisplay = vpSnomedCoding?.display
    const vaccinationProcedureText = vpCC?.text

    // Date recorded extension (distinct from date given)
    const dateRecordedExt = getExtensionValue(resource.extension, 'Extension-CareConnect-DateRecorded-1')
    const dateRecorded = formatDate((dateRecordedExt?.valueDateTime ?? dateRecordedExt?.valueDate) as string | undefined)

    // Parent present extension
    const parentPresentExt = getExtensionValue(resource.extension, 'Extension-CareConnect-ParentPresent-1')
    const parentPresent = parentPresentExt?.valueBoolean as boolean | undefined

    const vaccineCodings = resource.vaccineCode?.coding
    const vaccineCodeIsNullFlavor = vaccineCodings?.every(c => c.system === 'http://hl7.org/fhir/v3/NullFlavor')
    const vaccineSnomedCode = extractSnomedCode(vaccineCodings)
    // Fall back to vaccination procedure code when vaccineCode is UNK
    const snomedCode = vaccineSnomedCode ?? vaccinationProcedureCode

    const site = resource.site
    const routeCC = cast.route as fhir3.CodeableConcept | undefined

    const practitioners = resource.practitioner ?? []
    function extractPractitionerByRole(roleCode: string) {
      const match = practitioners.find(p => p.role?.coding?.[0]?.code === roleCode)
        ?? (roleCode === 'AP' ? practitioners.find(p => !(p.role?.coding?.[0]?.code)) : undefined)
      if (!match) return { name: undefined, id: undefined }
      const ref = (match.actor as fhir3.Reference | undefined)?.reference
      const display = (match.actor as fhir3.Reference | undefined)?.display
      const { name: resolved, id } = resolvePractitionerRef(bundle, ref)
      return { name: resolved ?? display, id }
    }
    const { name: administeringPractitioner, id: administeringPractitionerId } = extractPractitionerByRole('AP')
    const { name: enteringPractitioner, id: enteringPractitionerId } = extractPractitionerByRole('EP')

    const cast2 = resource as unknown as { encounter?: { reference?: string }; location?: { reference?: string } }
    const encounterId = extractId(cast2.encounter?.reference)
    const locationId = extractId(cast2.location?.reference)
    const locationResource = locationId
      ? (bundle.entry ?? []).find(e => (e.resource as any)?.id === locationId)?.resource as fhir3.Location | undefined
      : undefined
    const locationName = locationResource?.name

    const explanationReason = (cast.explanation as any)?.reason?.[0] as fhir3.CodeableConcept | undefined
    const explanationCode = explanationReason?.coding?.[0]?.code
    const explanationDisplay = explanationReason?.coding?.[0]?.display
    const explanationText = explanationReason?.text

    return {
      id: resource.id ?? crypto.randomUUID(),
      vaccine: resource.vaccineCode?.text
        ?? (vaccineCodeIsNullFlavor ? undefined : vaccineCodings?.[0]?.display)
        ?? vaccinationProcedureDisplay
        ?? vaccinationProcedureText
        ?? 'Unknown',
      snomedCode,
      vaccinationProcedureCode,
      vaccinationProcedureDisplay,
      vaccinationProcedureText,
      vaccineCodeDisplay: vaccineCodings?.[0]?.display,
      dateGiven: formatDate(resource.date),
      dateRecorded,
      status: resource.status ?? 'unknown',
      notGiven: cast.notGiven as boolean | undefined,
      site: site?.text,
      siteDisplay: site?.coding?.[0]?.display,
      siteCode: site?.coding?.[0]?.code,
      route: routeCC?.coding?.[0]?.display ?? routeCC?.text,
      batchNumber: resource.lotNumber,
      expirationDate: formatDate(cast.expirationDate as string | undefined),
      administeringPractitioner,
      administeringPractitionerId,
      enteringPractitioner,
      enteringPractitionerId,
      locationId,
      locationName,
      encounterId,
      explanationCode,
      explanationDisplay,
      explanationText,
      parentPresent,
      notes: (resource.note ?? []).map(n => n.text ?? '').filter(Boolean),
    }
  })
}
