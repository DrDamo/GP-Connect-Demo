import type { GpConnectMedication, GpConnectMedicationsRecord, GpConnectPatient } from './types'

type AnyResource = fhir3.Resource & { resourceType: string }

function getEntries<T extends fhir3.Resource>(bundle: fhir3.Bundle, resourceType: string): T[] {
  return (bundle.entry ?? [])
    .map(e => e.resource as AnyResource | undefined)
    .filter((r): r is T & AnyResource => r?.resourceType === resourceType)
}

function resolveReference(bundle: fhir3.Bundle, ref: string | undefined): AnyResource | undefined {
  if (!ref) return undefined
  return (bundle.entry ?? [])
    .map(e => e.resource as AnyResource | undefined)
    .find(r => {
      if (!r) return false
      const relRef = `${r.resourceType}/${r.id}`
      return ref === relRef || ref.endsWith(`/${relRef}`) || ref.endsWith(`/${r.id}`)
    })
}

function getMedicationName(bundle: fhir3.Bundle, stmt: fhir3.MedicationStatement): { name: string; code?: string } {
  if (stmt.medicationCodeableConcept) {
    const cc = stmt.medicationCodeableConcept
    const coding = cc.coding?.[0]
    return { name: cc.text ?? coding?.display ?? 'Unknown', code: coding?.code }
  }

  if (stmt.medicationReference) {
    const refStr = (stmt.medicationReference as fhir3.Reference).reference
    const med = resolveReference(bundle, refStr) as fhir3.Medication | undefined
    if (med?.code) {
      const coding = med.code.coding?.[0]
      return { name: med.code.text ?? coding?.display ?? 'Unknown', code: coding?.code }
    }
  }

  return { name: 'Unknown' }
}

function formatDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function getExtensionValue(extensions: fhir3.Extension[] | undefined, url: string): fhir3.Extension | undefined {
  return extensions?.find(e => e.url === url || e.url?.endsWith(url))
}

function extractPrescriptionType(stmt: fhir3.MedicationStatement): string | undefined {
  const ext = getExtensionValue(
    stmt.extension,
    'prescribingAgency' // GP Connect extension
  ) ?? getExtensionValue(stmt.extension, 'medicationStatementLastIssueDate')

  // Look for the prescription type extension
  const ptExt = getExtensionValue(
    stmt.extension,
    'MedicationStatement-lastIssueDate'
  ) ?? getExtensionValue(stmt.extension, 'prescriptionType')

  if (ptExt) {
    return (ptExt.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
      ?? (ptExt.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.text
      ?? ptExt.valueString
  }
  // Try to get from basedOn MedicationRequest
  return ext ? String(ext.valueString ?? '') : undefined
}

function extractMedicationRequestIds(stmt: fhir3.MedicationStatement): string[] {
  const basedOn = stmt.basedOn as fhir3.Reference[] | undefined
  return (basedOn ?? [])
    .map(ref => ref.reference)
    .filter((r): r is string => Boolean(r))
}

function getPrescriber(bundle: fhir3.Bundle, request: fhir3.MedicationRequest | undefined): string | undefined {
  if (!request) return undefined
  const reqRef = (request as unknown as Record<string, unknown>)['requester'] as { agent?: fhir3.Reference } | undefined
  const agentRef = reqRef?.agent?.reference
  if (!agentRef) return undefined
  const practitioner = resolveReference(bundle, agentRef) as fhir3.Practitioner | undefined
  if (!practitioner) return undefined
  const name = practitioner.name?.[0]
  if (!name) return undefined
  const given = (name.given ?? []).join(' ')
  const family = name.family ?? ''
  const prefix = (name.prefix ?? []).join(' ')
  return [prefix, given, family].filter(Boolean).join(' ')
}

function getOrganisation(bundle: fhir3.Bundle): string | undefined {
  const org = getEntries<fhir3.Organization>(bundle, 'Organization')[0]
  return org?.name
}

function extractPatient(bundle: fhir3.Bundle): GpConnectPatient | undefined {
  const patient = getEntries<fhir3.Patient>(bundle, 'Patient')[0]
  if (!patient) return undefined

  const nhsNumber = patient.identifier?.find(
    id => id.system?.includes('nhs-number') || id.system?.includes('PDS')
  )?.value

  const name = patient.name?.[0]
  const given = (name?.given ?? []).join(' ')
  const family = name?.family ?? ''

  return {
    nhsNumber,
    familyName: family || undefined,
    givenName: given || undefined,
    dateOfBirth: formatDate(patient.birthDate),
    gender: patient.gender,
  }
}

export function extractMedications(bundle: fhir3.Bundle): GpConnectMedicationsRecord {
  const statements = getEntries<fhir3.MedicationStatement>(bundle, 'MedicationStatement')
  const requests = getEntries<fhir3.MedicationRequest>(bundle, 'MedicationRequest')

  const medications: GpConnectMedication[] = statements.map(stmt => {
    const { name, code } = getMedicationName(bundle, stmt)

    const dosage = stmt.dosage?.[0]
    const dose = dosage?.doseQuantity
      ? `${dosage.doseQuantity.value ?? ''} ${dosage.doseQuantity.unit ?? ''}`.trim()
      : dosage?.doseRange
        ? `${dosage.doseRange.low?.value ?? ''} – ${dosage.doseRange.high?.value ?? ''} ${dosage.doseRange.high?.unit ?? ''}`.trim()
        : undefined

    const frequency = dosage?.timing?.code?.text ?? dosage?.timing?.code?.coding?.[0]?.display

    const route = dosage?.route?.coding?.[0]?.display ?? dosage?.route?.text

    const effectivePeriod = stmt.effectivePeriod
    const effectiveDateTime = stmt.effectiveDateTime

    const startDate = formatDate(effectivePeriod?.start ?? effectiveDateTime)
    const endDate = formatDate(effectivePeriod?.end)

    // GP Connect last issue date extension
    const lastIssuedExt = getExtensionValue(stmt.extension, 'medicationStatementLastIssueDate')
      ?? getExtensionValue(stmt.extension, 'LastIssuedDate')
    const lastIssuedDate = formatDate(lastIssuedExt?.valueDateTime ?? lastIssuedExt?.valueDate)

    const requestIds = extractMedicationRequestIds(stmt)
    const linkedRequest = requestIds.length > 0
      ? requests.find(r => requestIds.some(id => id.endsWith(`/${r.id}`) || id === `MedicationRequest/${r.id}`))
      : undefined

    // Number of repeats
    const repeatsExt = getExtensionValue(stmt.extension, 'repeatInformation')
    const numberOfRepeatsExt = repeatsExt
      ? getExtensionValue(repeatsExt.extension, 'numberOfRepeatPrescriptionsAllowed')
      : undefined
    const numberOfRepeatsAllowed = numberOfRepeatsExt?.valueUnsignedInt
      ?? linkedRequest?.dispenseRequest?.numberOfRepeatsAllowed

    // Quantity
    const qty = linkedRequest?.dispenseRequest?.quantity
    const prescribedQuantity = qty
      ? `${qty.value ?? ''} ${qty.unit ?? ''}`.trim() || undefined
      : undefined

    // Prescription type from extensions
    const prescriptionTypeExt = getExtensionValue(stmt.extension, 'prescriptionType')
    const prescriptionType = (prescriptionTypeExt?.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
      ?? (prescriptionTypeExt?.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.text
      ?? extractPrescriptionType(stmt)

    const prescriber = getPrescriber(bundle, linkedRequest)

    const noteText = stmt.note?.[0]?.text

    return {
      id: stmt.id ?? crypto.randomUUID(),
      drugName: name,
      snomedCode: code,
      dose,
      frequency,
      route,
      status: stmt.status ?? 'unknown',
      prescriptionType,
      startDate,
      endDate,
      lastIssuedDate,
      numberOfRepeatsAllowed,
      prescribedQuantity,
      prescriber,
      prescriberOrganisation: getOrganisation(bundle),
      dosageInstruction: dosage?.text,
      additionalInformation: noteText,
      medicationStatementId: stmt.id ?? '',
      medicationRequestIds: requestIds,
    }
  })

  // Sort: active first, then by drug name
  medications.sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, 'on-hold': 1, intended: 2, completed: 3, stopped: 4, 'entered-in-error': 5, unknown: 6 }
    const sa = statusOrder[a.status] ?? 6
    const sb = statusOrder[b.status] ?? 6
    if (sa !== sb) return sa - sb
    return a.drugName.localeCompare(b.drugName)
  })

  return {
    patient: extractPatient(bundle),
    practiceOrganisation: getOrganisation(bundle),
    medications,
    timestamp: new Date().toISOString(),
  }
}
