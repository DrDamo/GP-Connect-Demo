import type { DraftRecord, DraftConsultation, DraftConsultationItem } from '../types'
import type { TempIdMap } from '../idMap'

const SNOMED = 'http://snomed.info/sct'
const COMMENT_NOTE_CODE = '37331000000100'
const CONSULTATION_WRAPPER_CODE = '325851000000107'
const CONSULTATION_TOPIC_CODE = '25851000000105'
const CONSULTATION_CATEGORY_CODE = '24781000000107'

function makeListBase(
  id: string,
  patientRef: string,
  date: string | undefined,
  encRef: string,
  code: string,
  display: string,
  title: string | undefined,
  itemRefs: string[],
): fhir3.List {
  const list: fhir3.List = {
    resourceType: 'List',
    id,
    status: 'current',
    mode: 'snapshot',
    code: {
      coding: [{ system: SNOMED, code, display }],
    },
    subject: { reference: patientRef },
    date: date ?? new Date().toISOString(),
    entry: itemRefs.map(ref => ({ item: { reference: ref } })),
  }
  if (title) list.title = title
  // encounter is a GP Connect extension field not in base fhir3.List type
  ;(list as unknown as Record<string, unknown>)['encounter'] = { reference: encRef }
  return list
}

function makeNoteObservation(
  id: string,
  fullUrl: string,
  patientRef: string,
  encRef: string,
  text: string | undefined,
): fhir3.BundleEntry {
  const resource: fhir3.Observation & { comment?: string } = {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: {
      coding: [{ system: SNOMED, code: COMMENT_NOTE_CODE, display: 'Comment note' }],
    },
    subject: { reference: patientRef },
    comment: text,
  }
  // context is a STU3 field for encounter reference
  ;(resource as unknown as Record<string, unknown>)['context'] = { reference: encRef }
  return { fullUrl, resource }
}

function makeCodedObservation(
  id: string,
  fullUrl: string,
  patientRef: string,
  encRef: string,
  item: DraftConsultationItem,
): fhir3.BundleEntry {
  const resource: fhir3.Observation = {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: {
      coding: [
        {
          system: SNOMED,
          ...(item.snomedCode ? { code: item.snomedCode } : {}),
          ...(item.description ? { display: item.description } : {}),
        },
      ],
      ...(item.description ? { text: item.description } : {}),
    },
    subject: { reference: patientRef },
    ...(item.value ? { valueString: item.value } : {}),
  }
  ;(resource as unknown as Record<string, unknown>)['context'] = { reference: encRef }
  return { fullUrl, resource }
}

function processItem(
  item: DraftConsultationItem,
  map: TempIdMap,
  patientRef: string,
  encRef: string,
  extraEntries: fhir3.BundleEntry[],
): string {
  if (item.itemType === 'note') {
    const { id, fullUrl } = map.entry(item._tempId)
    extraEntries.push(makeNoteObservation(id, fullUrl, patientRef, encRef, item.narrativeText))
    return `Observation/${id}`
  }

  if (item.itemType === 'linked' && item.linkedDraftTempId) {
    return map.ref(item.linkedDraftTempId, item.linkedResourceType ?? 'Resource')
  }

  if (item.itemType === 'coded') {
    const { id, fullUrl } = map.entry(item._tempId)
    extraEntries.push(makeCodedObservation(id, fullUrl, patientRef, encRef, item))
    return `Observation/${id}`
  }

  // fallback: treat as note
  const { id, fullUrl } = map.entry(item._tempId)
  extraEntries.push(makeNoteObservation(id, fullUrl, patientRef, encRef, item.narrativeText))
  return `Observation/${id}`
}

function makeEncounter(
  draft: DraftConsultation,
  map: TempIdMap,
  patientRef: string,
  orgRef: string,
): { entry: fhir3.BundleEntry; id: string; ref: string } {
  const { id, fullUrl } = map.entry(draft._tempId)

  const encounterClass: fhir3.Coding = {
    system: 'http://hl7.org/fhir/v3/ActCode',
    code: draft.encounterClass ?? 'AMB',
    display: draft.encounterClass === 'HH' ? 'home health' : 'ambulatory',
  }

  const resource: fhir3.Encounter = {
    resourceType: 'Encounter',
    id,
    status: 'finished',
    class: encounterClass,
    ...(draft.typeDisplay ? { type: [{ text: draft.typeDisplay }] } : {}),
    subject: { reference: patientRef },
    period: {
      ...(draft.date ? { start: draft.date } : {}),
      end: draft.endDate ?? draft.date,
    },
    ...(draft.clinicianTempId
      ? {
          participant: [
            {
              type: [
                {
                  coding: [
                    {
                      system: 'http://hl7.org/fhir/v3/ParticipationType',
                      code: 'PPRF',
                      display: 'primary performer',
                    },
                  ],
                },
              ],
              individual: { reference: map.ref(draft.clinicianTempId, 'Practitioner') },
            },
          ],
        }
      : {}),
    serviceProvider: { reference: orgRef },
  }

  return { entry: { fullUrl, resource }, id, ref: `Encounter/${id}` }
}

function processConsultation(
  draft: DraftConsultation,
  map: TempIdMap,
  patientRef: string,
  orgRef: string,
): fhir3.BundleEntry[] {
  const entries: fhir3.BundleEntry[] = []

  const { entry: encEntry, ref: encRef } = makeEncounter(draft, map, patientRef, orgRef)
  entries.push(encEntry)

  const topicListRefs: string[] = []

  for (const topic of draft.topics) {
    const categoryListRefs: string[] = []

    for (const cat of topic.categories) {
      const catItemRefs: string[] = []

      for (const item of cat.items) {
        catItemRefs.push(processItem(item, map, patientRef, encRef, entries))
      }

      const catListId = map.resolve(cat._tempId)
      const catList = makeListBase(
        catListId,
        patientRef,
        draft.date,
        encRef,
        CONSULTATION_CATEGORY_CODE,
        'Consultation category',
        cat.title,
        catItemRefs,
      )
      entries.push({ fullUrl: `urn:uuid:${catListId}`, resource: catList })
      categoryListRefs.push(`List/${catListId}`)
    }

    // Direct topic items (not in a category)
    const directItemRefs: string[] = []
    for (const item of topic.items) {
      directItemRefs.push(processItem(item, map, patientRef, encRef, entries))
    }

    const topicListId = map.resolve(topic._tempId)
    const topicList = makeListBase(
      topicListId,
      patientRef,
      draft.date,
      encRef,
      CONSULTATION_TOPIC_CODE,
      'Consultation topic',
      topic.title,
      [...categoryListRefs, ...directItemRefs],
    )
    entries.push({ fullUrl: `urn:uuid:${topicListId}`, resource: topicList })
    topicListRefs.push(`List/${topicListId}`)
  }

  const wrapperListId = crypto.randomUUID()
  const wrapperList = makeListBase(
    wrapperListId,
    patientRef,
    draft.date,
    encRef,
    CONSULTATION_WRAPPER_CODE,
    'Consultation',
    undefined,
    topicListRefs,
  )
  entries.push({ fullUrl: `urn:uuid:${wrapperListId}`, resource: wrapperList })

  return entries
}

export function generateConsultations(
  draft: DraftRecord,
  map: TempIdMap,
  patientRef: string,
): fhir3.BundleEntry[] {
  const orgRef = map.ref(draft.organisation._tempId, 'Organization')
  return draft.consultations.flatMap(c => processConsultation(c, map, patientRef, orgRef))
}
