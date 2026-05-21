import type { GpConnectDocument } from './types'
import { getEntries, formatDate, resolvePractitionerName } from './utils'

export function extractDocuments(bundle: fhir3.Bundle): GpConnectDocument[] {
  return getEntries<fhir3.DocumentReference>(bundle, 'DocumentReference').map(resource => {
    const attachment = resource.content?.[0]?.attachment
    const typeCoding = resource.type?.coding?.[0]

    const authorArr = Array.isArray(resource.author) ? resource.author : resource.author ? [resource.author] : []
    const authorRef = (authorArr[0] as fhir3.Reference | undefined)?.reference
    const authorId = authorRef?.split('/').pop()
    const author = resolvePractitionerName(bundle, authorId)

    return {
      id: resource.id ?? crypto.randomUUID(),
      date: formatDate(resource.created ?? attachment?.creation),
      type: resource.type?.text ?? typeCoding?.display ?? 'Document',
      description: resource.description ?? attachment?.title,
      mimeType: attachment?.contentType,
      url: attachment?.url,
      author,
      status: resource.status ?? 'unknown',
    }
  })
}
