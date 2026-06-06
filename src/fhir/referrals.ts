import type { GpConnectReferral } from './types'
import { getEntries, formatDate, resolveReference, resolvePractitionerRef, extractSnomedCode, extractId, fhirDateKey } from './utils'

export function extractReferrals(bundle: fhir3.Bundle): GpConnectReferral[] {
  return getEntries<fhir3.ReferralRequest>(bundle, 'ReferralRequest')
    .sort((a, b) => fhirDateKey(b.authoredOn).localeCompare(fhirDateKey(a.authoredOn)))
    .map(resource => {
    const cast = resource as unknown as Record<string, unknown>

    const recipientArr = Array.isArray(resource.recipient) ? resource.recipient : resource.recipient ? [resource.recipient] : []
    const recipientRef = (recipientArr[0] as fhir3.Reference | undefined)?.reference
    const resolved = resolveReference(bundle, recipientRef) as fhir3.Organization | { resourceType: string; name?: string } | undefined

    // HealthcareService resources are not in the fhir3 namespace but appear in EMIS bundles
    const resolvedName = resolved
      ? (resolved as fhir3.Organization).name ?? (resolved as { name?: string }).name
      : undefined

    const specialty = resource.specialty
    const recipient = resolvedName
      ?? specialty?.text
      ?? extractSnomedCode(specialty?.coding)
      ?? specialty?.coding?.[0]?.display

    const reasonCode = resource.reasonCode?.[0]
    const reason = reasonCode?.text ?? reasonCode?.coding?.[0]?.display

    const requesterRef = (cast.requester as { agent?: fhir3.Reference } | undefined)?.agent?.reference
    const description = cast.description as string | undefined
    const { name: requester, id: requesterId } = resolvePractitionerRef(bundle, requesterRef)
    const recipientId = extractId(recipientRef)

    return {
      id: resource.id ?? crypto.randomUUID(),
      date: formatDate(resource.authoredOn),
      recipient,
      recipientId,
      priority: resource.priority,
      reason,
      description: description || undefined,
      requester,
      requesterId,
      notes: (resource.note ?? []).map(n => n.text ?? '').filter(Boolean),
      status: resource.status ?? 'unknown',
    }
  })
}
