import type {
  GpConnectConsultation,
  GpConnectConsultationTopic,
  GpConnectConsultationCategory,
  GpConnectConsultationItem,
} from './types'
import {
  getEntries,
  formatDate,
  resolvePractitionerRef,
  resolveReference,
  getOrganisationName,
  extractId,
  resolveItemDisplay,
  extractOriginalTermText,
  fhirDateKey,
  hasNopatSecurity,
} from './utils'

// SNOMED codes for consultation structure lists
const CONSULTATION_WRAPPER = '325851000000107'
const CONSULTATION_TOPIC   = '25851000000105'
const CONSULTATION_CATEGORY = '24781000000107'

function hasCode(list: fhir3.List, code: string): boolean {
  return list.code?.coding?.some(c => c.code === code) ?? false
}

function encRef(list: fhir3.List): string | undefined {
  return (list as unknown as { encounter?: { reference?: string } }).encounter?.reference
}

const COMMENT_NOTE_CODE = '37331000000100'

function itemFromRef(bundle: fhir3.Bundle, ref: string | undefined): GpConnectConsultationItem {
  const resource = resolveReference(bundle, ref)
  const resourceType = ref?.split('/')[0] ?? ''
  const resourceId = extractId(ref) ?? ''

  if (resource?.resourceType === 'Observation') {
    const obs = resource as fhir3.Observation & { comment?: string }
    if (obs.code?.coding?.some(c => c.code === COMMENT_NOTE_CODE)) {
      return { resourceType, resourceId, narrativeText: obs.comment ?? '' }
    }
  }

  return { resourceType, resourceId, display: resolveItemDisplay(bundle, ref) }
}

function buildTopic(
  bundle: fhir3.Bundle,
  topicList: fhir3.List,
  allLists: fhir3.List[],
): GpConnectConsultationTopic {
  const categories: GpConnectConsultationCategory[] = []
  const items: GpConnectConsultationItem[] = []

  for (const entry of topicList.entry ?? []) {
    const ref = entry.item.reference
    if (ref?.startsWith('List/') || (!ref?.includes('/') && false)) {
      // Entry references another List — look it up
      const subList = allLists.find(l => l.id && ref?.endsWith(`/${l.id}`))
      if (subList && hasCode(subList, CONSULTATION_CATEGORY)) {
        categories.push({
          id: subList.id ?? '',
          title: subList.title,
          items: (subList.entry ?? []).map(e => itemFromRef(bundle, e.item.reference)),
        })
        continue
      }
      // Sub-list that isn't a category — treat its items as direct
      if (subList) {
        for (const e of subList.entry ?? []) {
          items.push(itemFromRef(bundle, e.item.reference))
        }
        continue
      }
    }
    // Direct clinical item
    items.push(itemFromRef(bundle, ref))
  }

  return {
    id: topicList.id ?? '',
    title: topicList.title,
    categories,
    items,
  }
}

export function extractConsultations(bundle: fhir3.Bundle): GpConnectConsultation[] {
  const allLists = getEntries<fhir3.List>(bundle, 'List')

  return getEntries<fhir3.Encounter>(bundle, 'Encounter')
    .sort((a, b) => fhirDateKey(b.period?.start).localeCompare(fhirDateKey(a.period?.start)))
    .map(enc => {
    const period = enc.period

    const participants = enc.participant ?? []
    const primary = participants.find(p =>
      (p.type ?? []).some(t => t.coding?.some(c => c.code === 'PPRF' || c.code === 'PRF'))
    ) ?? participants[0]
    const participantRef = (primary?.individual as fhir3.Reference | undefined)?.reference
    const { name: clinician, id: clinicianId } = resolvePractitionerRef(bundle, participantRef)

    const serviceProviderRef = (enc as unknown as { serviceProvider?: { reference?: string } })
      .serviceProvider?.reference
    const resolvedOrg = resolveReference(bundle, serviceProviderRef) as fhir3.Organization | undefined
    const organisation = resolvedOrg?.name ?? getOrganisationName(bundle)
    const organisationId = resolvedOrg?.id ?? extractId(serviceProviderRef)

    const typeEntry = enc.type?.[0]
    const type = extractOriginalTermText(typeEntry)

    const encCast = enc as unknown as { class?: { code?: string; display?: string }; status?: string }
    const encounterClass = encCast.class?.display ?? encCast.class?.code
    const encounterStatus = enc.status

    // Find the consultation wrapper list for this encounter
    const wrapperList = allLists.find(l =>
      hasCode(l, CONSULTATION_WRAPPER) && encRef(l)?.endsWith(`/${enc.id}`)
    )

    const topics: GpConnectConsultationTopic[] = []

    if (wrapperList) {
      for (const wEntry of wrapperList.entry ?? []) {
        const topicRef = wEntry.item.reference
        const topicList = allLists.find(l => l.id && topicRef?.endsWith(`/${l.id}`))
        if (!topicList) continue
        if (hasCode(topicList, CONSULTATION_TOPIC)) {
          topics.push(buildTopic(bundle, topicList, allLists))
        }
      }
    }

    return {
      id: enc.id ?? crypto.randomUUID(),
      date: formatDate(period?.start),
      endDate: formatDate(period?.end),
      type,
      clinician,
      clinicianId,
      organisation,
      organisationId,
      encounterClass,
      encounterStatus,
      topics,
      notForPfs: hasNopatSecurity(enc),
    }
  })
}
