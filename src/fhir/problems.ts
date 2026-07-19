import type { GpConnectProblem, GpConnectLinkedItem } from './types'
import { getEntries, formatDate, getExtensionValue, resolvePractitionerRef, extractSnomedCode, extractOriginalTermText, extractId, fhirDateKey, hasNopatSecurity } from './utils'

function resolveLinkedDescription(bundle: fhir3.Bundle, resourceType: string, id: string): string | undefined {
  const resource = (bundle.entry ?? []).find(e => (e.resource as any)?.id === id)?.resource as any
  if (!resource) return undefined
  switch (resourceType) {
    case 'Observation':
      return extractOriginalTermText(resource.code)
    case 'Encounter':
      return resource.type?.[0]?.text ?? formatDate(resource.period?.start)
    case 'MedicationRequest':
    case 'MedicationStatement': {
      const medRef = resource.medicationReference?.reference
      if (medRef) {
        const medId = medRef.split('/').pop()
        const med = (bundle.entry ?? []).find(e => (e.resource as any)?.id === medId)?.resource as any
        return extractOriginalTermText(med?.code)
      }
      return extractOriginalTermText(resource.medicationCodeableConcept)
    }
    case 'Condition':
    case 'AllergyIntolerance':
    case 'DiagnosticReport':
      return extractOriginalTermText(resource.code)
    case 'ReferralRequest':
      return resource.description ?? extractOriginalTermText(resource.type)
    default:
      return undefined
  }
}

export function extractProblems(bundle: fhir3.Bundle): GpConnectProblem[] {
  return getEntries<fhir3.Condition>(bundle, 'Condition')
    .sort((a, b) => fhirDateKey(
      (b as unknown as {assertedDate?: string; onsetDateTime?: string}).assertedDate ??
      (b as unknown as {onsetDateTime?: string}).onsetDateTime
    ).localeCompare(fhirDateKey(
      (a as unknown as {assertedDate?: string; onsetDateTime?: string}).assertedDate ??
      (a as unknown as {onsetDateTime?: string}).onsetDateTime
    )))
    .map(resource => {
    const coding = resource.code?.coding
    const cast = resource as unknown as Record<string, any>

    const sigExt = getExtensionValue(resource.extension, 'Extension-CareConnect-ProblemSignificance-1')
    const sigCode = sigExt?.valueCode as string | undefined
    const sigCC = sigExt?.valueCodeableConcept as fhir3.CodeableConcept | undefined
    const rawSignificance = sigCode ?? extractOriginalTermText(sigCC)
    const significance = rawSignificance
      ? rawSignificance.charAt(0).toUpperCase() + rawSignificance.slice(1)
      : undefined

    const asserterRef = (resource.asserter as fhir3.Reference | undefined)?.reference
    const { name: asserter, id: asserterId } = resolvePractitionerRef(bundle, asserterRef)
    const contextRef = (resource as unknown as { context?: { reference?: string } }).context?.reference
    const encounterId = extractId(contextRef)
    const notes = (resource.note ?? []).map(n => n.text ?? '').filter(Boolean)

    // Linked items: ActualProblem (the backing resource) + RelatedClinicalContent
    const linkedItems: GpConnectLinkedItem[] = []
    for (const ext of resource.extension ?? []) {
      const isActual  = ext.url?.endsWith('Extension-CareConnect-ActualProblem-1')
      const isRelated = ext.url?.endsWith('Extension-CareConnect-RelatedClinicalContent-1')
      if (!isActual && !isRelated) continue
      const ref = (ext.valueReference as fhir3.Reference | undefined)?.reference
      if (!ref) continue
      const parts = ref.split('/')
      const resourceType = parts[parts.length - 2] ?? parts[0]
      const id = parts[parts.length - 1]
      if (!id) continue
      linkedItems.push({
        resourceType,
        id,
        description: resolveLinkedDescription(bundle, resourceType, id),
        linkType: isActual ? 'actual' : 'related',
      })
    }

    return {
      id: resource.id ?? crypto.randomUUID(),
      problem: extractOriginalTermText(resource.code) ?? 'Unknown',
      snomedCode: extractSnomedCode(coding),
      snomedDisplay: coding?.find(c => c.system === 'http://snomed.info/sct')?.display ?? coding?.[0]?.display,
      clinicalStatus: resource.clinicalStatus ?? 'unknown',
      significance,
      startDate: formatDate(cast.onsetDateTime),
      endDate: formatDate(cast.abatementDateTime),
      assertedDate: formatDate(cast.assertedDate),
      asserter,
      asserterId,
      encounterId,
      notes,
      linkedItems,
      notForPfs: hasNopatSecurity(resource),
    }
  })
}
