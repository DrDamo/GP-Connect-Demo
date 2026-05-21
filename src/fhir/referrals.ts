import type { GpConnectReferral } from './types'
import { getEntries, formatDate, resolveReference } from './utils'

export function extractReferrals(bundle: fhir3.Bundle): GpConnectReferral[] {
  return getEntries<fhir3.ReferralRequest>(bundle, 'ReferralRequest').map(resource => {
    const recipientArr = Array.isArray(resource.recipient) ? resource.recipient : resource.recipient ? [resource.recipient] : []
    const recipientRef = (recipientArr[0] as fhir3.Reference | undefined)?.reference
    const resolvedOrg = resolveReference(bundle, recipientRef) as fhir3.Organization | undefined
    const specialty = resource.specialty
    const recipient = resolvedOrg?.name
      ?? specialty?.text
      ?? specialty?.coding?.[0]?.display

    const reasonCode = resource.reasonCode?.[0]
    const reason = reasonCode?.text ?? reasonCode?.coding?.[0]?.display

    return {
      id: resource.id ?? crypto.randomUUID(),
      date: formatDate(resource.authoredOn),
      recipient,
      priority: resource.priority,
      reason,
      status: resource.status ?? 'unknown',
    }
  })
}
