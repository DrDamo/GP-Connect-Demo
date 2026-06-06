import type { DraftRecord } from '../types'
import type { TempIdMap } from '../idMap'

export function generateDocuments(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
): fhir3.BundleEntry[] {
  return draft.documents.map(doc => {
    const { id, fullUrl } = map.entry(doc._tempId)

    const attachment: fhir3.Attachment =
      doc.url || doc.mimeType
        ? {
            ...(doc.url ? { url: doc.url } : {}),
            ...(doc.mimeType ? { contentType: doc.mimeType } : {}),
          }
        : { title: doc.description ?? doc.type }

    const resource: fhir3.DocumentReference = {
      resourceType: 'DocumentReference',
      id,
      status: (doc.status as fhir3.DocumentReference['status']) ?? 'current',
      indexed: doc.date ?? new Date().toISOString(),
      ...(doc.type ? { type: { text: doc.type } } : { type: {} }),
      subject: { reference: patientRef },
      ...(doc.date ? { created: doc.date } : {}),
      ...(doc.description ? { description: doc.description } : {}),
      ...(doc.authorTempId
        ? { author: [{ reference: map.ref(doc.authorTempId, 'Practitioner') }] }
        : {}),
      ...(doc.custodianOrgTempId
        ? { custodian: { reference: map.ref(doc.custodianOrgTempId, 'Organization') } }
        : {}),
      content: [{ attachment }],
    }

    return { fullUrl, resource }
  })
}
