import type { GpConnectAllergy, GpConnectAllergyNote } from './types'
import { getEntries, formatDate, resolvePractitionerName, getExtensionValue } from './utils'

const END_EXT = 'Extension-CareConnect-GPC-AllergyIntoleranceEnd-1'

export function extractAllergies(bundle: fhir3.Bundle): GpConnectAllergy[] {
  return getEntries<fhir3.AllergyIntolerance>(bundle, 'AllergyIntolerance').map(resource => {
    const coding = resource.code?.coding?.[0]
    const reactionManifestation = resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display
    const reactionDescription = (resource.reaction?.[0] as unknown as { description?: string })?.description

    // Notes with resolved author names
    const rawNotes = (resource.note ?? []) as unknown as Array<{
      text?: string
      authorReference?: { reference?: string }
      time?: string
    }>
    const notes: GpConnectAllergyNote[] = rawNotes.map(n => {
      const authorId = n.authorReference?.reference
      return {
        text: n.text ?? '',
        author: resolvePractitionerName(bundle, authorId),
        time: formatDate(n.time),
      }
    })

    // Recorder
    const recorderRef = (resource.recorder as fhir3.Reference | undefined)?.reference
    const recorder = resolvePractitionerName(bundle, recorderRef)

    // Ended allergy extension
    const endExt = getExtensionValue(resource.extension, END_EXT)
    const endSubExts = (endExt as unknown as { extension?: fhir3.Extension[] } | undefined)?.extension
    const endDateRaw = endSubExts?.find(e => e.url === 'endDate')?.valueDateTime as string | undefined
    const endReason = endSubExts?.find(e => e.url === 'reasonEnded')?.valueString as string | undefined

    return {
      id: resource.id ?? crypto.randomUUID(),
      causativeAgent: resource.code?.text ?? coding?.display ?? 'Unknown',
      snomedCode: coding?.code,
      snomedDisplay: coding?.display,
      category: (resource.category?.[0] as string | undefined),
      criticality: resource.criticality,
      reaction: reactionManifestation ?? reactionDescription,
      dateRecorded: formatDate((resource as unknown as { assertedDate?: string }).assertedDate),
      onsetDate: formatDate((resource as unknown as { onsetDateTime?: string }).onsetDateTime),
      status: resource.clinicalStatus ?? 'unknown',
      verificationStatus: resource.verificationStatus,
      notes,
      recorder,
      endDate: formatDate(endDateRaw),
      endReason,
    }
  })
}
