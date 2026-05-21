import type { GpConnectMedication, GpConnectMedicationIssue } from './types'

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

function extractPrescriptionType(resource: { extension?: fhir3.Extension[] }): string | undefined {
  const ptExt = getExtensionValue(resource.extension, 'Extension-CareConnect-GPC-PrescriptionType-1')
  const cc = ptExt?.valueCodeableConcept as fhir3.CodeableConcept | undefined
  return cc?.coding?.[0]?.code ?? cc?.text
}

function extractPrescribingAgency(stmt: fhir3.MedicationStatement): string | undefined {
  const ext = getExtensionValue(stmt.extension, 'Extension-CareConnect-GPC-PrescribingAgency-1')
  const cc = ext?.valueCodeableConcept as fhir3.CodeableConcept | undefined
  return cc?.coding?.[0]?.code ?? cc?.text
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

export function extractMedications(bundle: fhir3.Bundle): GpConnectMedication[] {
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
    const lastIssuedExt = getExtensionValue(stmt.extension, 'Extension-CareConnect-GPC-MedicationStatementLastIssueDate-1')
    const lastIssuedDate = formatDate(lastIssuedExt?.valueDateTime ?? lastIssuedExt?.valueDate)

    const requestIds = extractMedicationRequestIds(stmt)
    // MedicationStatement.basedOn references the intent:plan request (the authorisation)
    const planRequest = requestIds.length > 0
      ? requests.find(r => requestIds.some(id => id.endsWith(`/${r.id}`) || id === `MedicationRequest/${r.id}`))
      : undefined
    // Treat the plan request as linkedRequest for dispense/prescriber data
    const linkedRequest = planRequest

    // Repeat information lives on the plan MedicationRequest, not the statement
    const repeatsExt = getExtensionValue(planRequest?.extension, 'Extension-CareConnect-GPC-MedicationRepeatInformation-1')
    const numberOfRepeatsExt = repeatsExt
      ? getExtensionValue(repeatsExt.extension, 'numberOfRepeatPrescriptionsAllowed')
      : undefined
    const numberOfRepeatsAllowed = numberOfRepeatsExt?.valueUnsignedInt
      ?? linkedRequest?.dispenseRequest?.numberOfRepeatsAllowed

    // Quantity — unit may be in MedicationQuantityText-1 extension rather than qty.unit
    const qty = linkedRequest?.dispenseRequest?.quantity
    const qtyUnit = qty
      ? getExtensionValue(
          (qty as fhir3.Quantity & { extension?: fhir3.Extension[] }).extension,
          'Extension-CareConnect-GPC-MedicationQuantityText-1'
        )?.valueString ?? qty.unit
      : undefined
    const prescribedQuantity = qty
      ? `${qty.value ?? ''} ${qtyUnit ?? ''}`.trim() || undefined
      : undefined

    // prescriptionType is on the plan MedicationRequest, not the statement
    const prescriptionType = extractPrescriptionType(stmt) ?? extractPrescriptionType(planRequest ?? {})

    const prescribingAgency = extractPrescribingAgency(stmt)

    // Order requests (individual issues) reference the plan via their own basedOn
    const planId = planRequest?.id
    const orderRequests = planId
      ? requests
          .filter(r => {
            if (r.intent !== 'order') return false
            const basedOn = r.basedOn ? (Array.isArray(r.basedOn) ? r.basedOn : [r.basedOn]) : []
            return basedOn.some((b: fhir3.Reference) =>
              b.reference?.endsWith(`/${planId}`) || b.reference === `MedicationRequest/${planId}`
            )
          })
          .sort((a, b) => (a.authoredOn ?? '').localeCompare(b.authoredOn ?? ''))
      : []

    const issues: GpConnectMedicationIssue[] = orderRequests.map(req => {
      const oqty = req.dispenseRequest?.quantity
      const oqtyUnit = oqty
        ? getExtensionValue(
            (oqty as fhir3.Quantity & { extension?: fhir3.Extension[] }).extension,
            'Extension-CareConnect-GPC-MedicationQuantityText-1'
          )?.valueString ?? oqty.unit
        : undefined
      const oQuantity = oqty ? `${oqty.value ?? ''} ${oqtyUnit ?? ''}`.trim() || undefined : undefined
      const oDosage = req.dosageInstruction?.[0]
      return {
        id: req.id ?? '',
        issueDate: formatDate(req.authoredOn ?? req.dispenseRequest?.validityPeriod?.start),
        endDate: formatDate(req.dispenseRequest?.validityPeriod?.end),
        quantity: oQuantity,
        status: req.status,
        dosageInstruction: oDosage?.text || undefined,
        patientInstructions: oDosage?.patientInstruction || undefined,
        pharmacyInstructions: req.note?.map(n => n.text).filter(Boolean).join('\n') || undefined,
      }
    })

    const prescriber = getPrescriber(bundle, linkedRequest)

    const noteText = stmt.note?.[0]?.text

    const patientInstructions = dosage?.patientInstruction || undefined
    const pharmacyInstructions = stmt.note?.map(n => n.text).filter(Boolean).join('\n') || undefined

    return {
      id: stmt.id ?? crypto.randomUUID(),
      drugName: name,
      snomedCode: code,
      dose,
      frequency,
      route,
      status: stmt.status ?? 'unknown',
      prescriptionType,
      prescribingAgency,
      startDate,
      endDate,
      lastIssuedDate,
      numberOfRepeatsAllowed,
      prescribedQuantity,
      prescriber,
      prescriberOrganisation: getOrganisation(bundle),
      dosageInstruction: dosage?.text,
      additionalInformation: noteText,
      patientInstructions,
      pharmacyInstructions,
      medicationStatementId: stmt.id ?? '',
      medicationRequestIds: requestIds,
      issues,
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

  return medications
}
