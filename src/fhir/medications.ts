import type { GpConnectMedication, GpConnectMedicationIssue } from './types'
import {
  getEntries, resolveReference, formatDate, getExtensionValue, extractSnomedCode,
  getOrganisationName, resolvePractitionerRef, extractId, fhirDateKey,
} from './utils'

function getMedRef(bundle: fhir3.Bundle, med: fhir3.MedicationStatement | fhir3.MedicationRequest): { name: string; code?: string; resourceId?: string } {
  const cc = (med as fhir3.MedicationStatement).medicationCodeableConcept
    ?? (med as fhir3.MedicationRequest).medicationCodeableConcept
  if (cc) {
    return { name: cc.text ?? cc.coding?.[0]?.display ?? 'Unknown', code: extractSnomedCode(cc.coding) }
  }
  const ref = ((med as fhir3.MedicationStatement).medicationReference
    ?? (med as fhir3.MedicationRequest).medicationReference) as fhir3.Reference | undefined
  if (ref?.reference) {
    const resolved = resolveReference(bundle, ref.reference) as fhir3.Medication | undefined
    if (resolved?.code) {
      return {
        name: resolved.code.text ?? resolved.code.coding?.[0]?.display ?? 'Unknown',
        code: extractSnomedCode(resolved.code.coding),
        resourceId: extractId(ref.reference),
      }
    }
    return { name: 'Unknown', resourceId: extractId(ref.reference) }
  }
  return { name: 'Unknown' }
}

function getMedicationName(bundle: fhir3.Bundle, stmt: fhir3.MedicationStatement): { name: string; code?: string } {
  return getMedRef(bundle, stmt)
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
  const basedOn = stmt.basedOn
  if (!basedOn) return []
  const refs = Array.isArray(basedOn) ? basedOn : [basedOn]
  return refs
    .map(ref => (ref as fhir3.Reference).reference)
    .filter((r): r is string => Boolean(r))
}

function getPrescriberInfo(bundle: fhir3.Bundle, request: fhir3.MedicationRequest | undefined): { name?: string; id?: string } {
  if (!request) return {}
  const reqRef = (request as unknown as Record<string, unknown>)['requester'] as { agent?: fhir3.Reference } | undefined
  return resolvePractitionerRef(bundle, reqRef?.agent?.reference)
}

export function extractMedications(bundle: fhir3.Bundle): GpConnectMedication[] {
  const statements = getEntries<fhir3.MedicationStatement>(bundle, 'MedicationStatement')
    .sort((a, b) => fhirDateKey(b.dateAsserted).localeCompare(fhirDateKey(a.dateAsserted)))
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
    const site = (dosage?.site as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
      ?? (dosage?.site as fhir3.CodeableConcept | undefined)?.text

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
    const numberOfRepeatsAllowed =
      (numberOfRepeatsExt as unknown as { valuePositiveInt?: number })?.valuePositiveInt
      ?? numberOfRepeatsExt?.valueUnsignedInt
      ?? linkedRequest?.dispenseRequest?.numberOfRepeatsAllowed

    const numberOfIssuedExt = repeatsExt
      ? getExtensionValue(repeatsExt.extension, 'numberOfRepeatPrescriptionsIssued')
      : undefined
    const numberOfIssued = numberOfIssuedExt?.valueUnsignedInt

    const authExpiryExt = repeatsExt
      ? getExtensionValue(repeatsExt.extension, 'authorisationExpiryDate')
      : undefined
    const authorisationExpiryDate = formatDate(
      (authExpiryExt?.valueDateTime ?? authExpiryExt?.valueDate) as string | undefined
    )

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

    // Why/when a medication was stopped
    const statusReasonExt = getExtensionValue(planRequest?.extension, 'Extension-CareConnect-GPC-MedicationStatusReason-1')
    const statusReasonSubs = (statusReasonExt as unknown as { extension?: fhir3.Extension[] } | undefined)?.extension
    const statusReasonVal = statusReasonSubs?.find(e => e.url === 'statusReason')
    const statusReason = (statusReasonVal?.valueString
      ?? (statusReasonVal?.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.text
      ?? (statusReasonVal?.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
    ) || undefined
    const statusChangeDate = formatDate(
      statusReasonSubs?.find(e => e.url === 'statusChangeDate')?.valueDateTime as string | undefined
    )

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
          .sort((a, b) => {
            const primary = (b.authoredOn ?? '').localeCompare(a.authoredOn ?? '')
            if (primary !== 0) return primary
            return (b.dispenseRequest?.validityPeriod?.start ?? '').localeCompare(a.dispenseRequest?.validityPeriod?.start ?? '')
          })
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
      const oEsd = req.dispenseRequest?.expectedSupplyDuration as fhir3.Duration | undefined
      const supplyDuration = oEsd?.value !== undefined
        ? `${oEsd.value} ${oEsd.unit ?? oEsd.code ?? ''}`.trim()
        : undefined
      const oRecorderRef = (req.recorder as fhir3.Reference | undefined)?.reference
      const { name: recorder, id: recorderId } = resolvePractitionerRef(bundle, oRecorderRef)
      return {
        id: req.id ?? '',
        issueDate: formatDate(req.authoredOn ?? req.dispenseRequest?.validityPeriod?.start),
        startDate: formatDate(req.dispenseRequest?.validityPeriod?.start),
        endDate: formatDate(req.dispenseRequest?.validityPeriod?.end),
        quantity: oQuantity,
        status: req.status,
        supplyDuration,
        dosageInstruction: oDosage?.text || undefined,
        patientInstructions: oDosage?.patientInstruction || undefined,
        pharmacyInstructions: req.note?.map(n => n.text).filter(Boolean).join('\n') || undefined,
        recorder,
        recorderId,
      }
    })

    const contextRef = (stmt as unknown as { context?: { reference?: string } }).context?.reference
    const encounterId = contextRef ? extractId(contextRef) : undefined

    const { resourceId: medicationResourceId } = getMedRef(bundle, stmt)

    const dateAsserted = formatDate(stmt.dateAsserted)

    const { name: prescriber, id: prescriberId } = getPrescriberInfo(bundle, linkedRequest)
    const recorderRef = (planRequest?.recorder as fhir3.Reference | undefined)?.reference
    const { name: recorder, id: recorderId } = resolvePractitionerRef(bundle, recorderRef)
    const prescriberOrg = getEntries<fhir3.Organization>(bundle, 'Organization')[0]
    const prescriberOrganisationId = prescriberOrg?.id

    const esd = linkedRequest?.dispenseRequest?.expectedSupplyDuration as fhir3.Duration | undefined
    const expectedSupplyDuration = esd?.value !== undefined
      ? `${esd.value} ${esd.unit ?? esd.code ?? ''}`.trim()
      : undefined

    const noteText = stmt.note?.[0]?.text

    const patientInstructions = dosage?.patientInstruction || undefined
    const pharmacyInstructions = stmt.note?.map(n => n.text).filter(Boolean).join('\n') || undefined

    return {
      id: stmt.id ?? crypto.randomUUID(),
      drugName: name,
      snomedCode: code,
      dose,
      frequency,
      site,
      route,
      status: stmt.status ?? 'unknown',
      prescriptionType,
      prescribingAgency,
      startDate,
      endDate,
      lastIssuedDate,
      numberOfRepeatsAllowed,
      numberOfIssued,
      authorisationExpiryDate,
      prescribedQuantity,
      expectedSupplyDuration,
      encounterId,
      medicationResourceId,
      dateAsserted,
      prescriber,
      prescriberId,
      recorder,
      recorderId,
      prescriberOrganisation: getOrganisationName(bundle),
      prescriberOrganisationId,
      dosageInstruction: dosage?.text,
      additionalInformation: noteText,
      patientInstructions,
      pharmacyInstructions,
      statusReason,
      statusChangeDate,
      medicationStatementId: stmt.id ?? '',
      medicationRequestIds: requestIds,
      issues,
    }
  })

  // Sort: active first, then by drug name
  const sortMeds = (list: GpConnectMedication[]) => list.sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, 'on-hold': 1, intended: 2, completed: 3, stopped: 4, 'entered-in-error': 5, unknown: 6 }
    const sa = statusOrder[a.status] ?? 6
    const sb = statusOrder[b.status] ?? 6
    if (sa !== sb) return sa - sb
    return a.drugName.localeCompare(b.drugName)
  })

  if (medications.length > 0) return sortMeds(medications)

  // Fallback: no MedicationStatements — build from intent=plan MedicationRequests
  const planRequests = requests
    .filter(r => r.intent === 'plan')
    .sort((a, b) => (b.authoredOn ?? '').localeCompare(a.authoredOn ?? ''))

  const fallback: GpConnectMedication[] = planRequests.map(planReq => {
    const { name, code, resourceId: medicationResourceId } = getMedRef(bundle, planReq)

    const dosage = planReq.dosageInstruction?.[0]
    const dose = dosage?.doseQuantity
      ? `${dosage.doseQuantity.value ?? ''} ${dosage.doseQuantity.unit ?? ''}`.trim()
      : dosage?.doseRange
        ? `${dosage.doseRange.low?.value ?? ''} – ${dosage.doseRange.high?.value ?? ''} ${dosage.doseRange.high?.unit ?? ''}`.trim()
        : undefined
    const frequency = dosage?.timing?.code?.text ?? dosage?.timing?.code?.coding?.[0]?.display
    const route = dosage?.route?.coding?.[0]?.display ?? dosage?.route?.text
    const site = (dosage?.site as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
      ?? (dosage?.site as fhir3.CodeableConcept | undefined)?.text

    const vp = planReq.dispenseRequest?.validityPeriod
    const startDate = formatDate(vp?.start ?? planReq.authoredOn)
    const endDate = formatDate(vp?.end)

    const qty = planReq.dispenseRequest?.quantity
    const qtyUnit = qty
      ? getExtensionValue(
          (qty as fhir3.Quantity & { extension?: fhir3.Extension[] }).extension,
          'Extension-CareConnect-GPC-MedicationQuantityText-1'
        )?.valueString ?? qty.unit
      : undefined
    const prescribedQuantity = qty ? `${qty.value ?? ''} ${qtyUnit ?? ''}`.trim() || undefined : undefined

    const repeatsExt = getExtensionValue(planReq.extension, 'Extension-CareConnect-GPC-MedicationRepeatInformation-1')
    const numberOfRepeatsAllowed =
      (getExtensionValue(repeatsExt?.extension, 'numberOfRepeatPrescriptionsAllowed') as unknown as { valuePositiveInt?: number } | undefined)?.valuePositiveInt
      ?? getExtensionValue(repeatsExt?.extension, 'numberOfRepeatPrescriptionsAllowed')?.valueUnsignedInt
      ?? planReq.dispenseRequest?.numberOfRepeatsAllowed
    const numberOfIssued = getExtensionValue(repeatsExt?.extension, 'numberOfRepeatPrescriptionsIssued')?.valueUnsignedInt
    const authorisationExpiryDate = formatDate(
      (getExtensionValue(repeatsExt?.extension, 'authorisationExpiryDate')?.valueDateTime
        ?? getExtensionValue(repeatsExt?.extension, 'authorisationExpiryDate')?.valueDate) as string | undefined
    )

    const prescriptionType = extractPrescriptionType(planReq)

    const statusReasonExt = getExtensionValue(planReq.extension, 'Extension-CareConnect-GPC-MedicationStatusReason-1')
    const statusReasonSubs = (statusReasonExt as unknown as { extension?: fhir3.Extension[] } | undefined)?.extension
    const statusReasonVal = statusReasonSubs?.find(e => e.url === 'statusReason')
    const statusReason = (statusReasonVal?.valueString
      ?? (statusReasonVal?.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.text
      ?? (statusReasonVal?.valueCodeableConcept as fhir3.CodeableConcept | undefined)?.coding?.[0]?.display
    ) || undefined
    const statusChangeDate = formatDate(
      statusReasonSubs?.find(e => e.url === 'statusChangeDate')?.valueDateTime as string | undefined
    )

    const esd = planReq.dispenseRequest?.expectedSupplyDuration as fhir3.Duration | undefined
    const expectedSupplyDuration = esd?.value !== undefined
      ? `${esd.value} ${esd.unit ?? esd.code ?? ''}`.trim()
      : undefined

    const reqRef = (planReq as unknown as Record<string, unknown>)['requester'] as { agent?: fhir3.Reference } | undefined
    const { name: prescriber, id: prescriberId } = resolvePractitionerRef(bundle, reqRef?.agent?.reference)
    const recorderRef = (planReq.recorder as fhir3.Reference | undefined)?.reference
    const { name: recorder, id: recorderId } = resolvePractitionerRef(bundle, recorderRef)

    const ctxRef = (planReq as unknown as { context?: { reference?: string } }).context?.reference
    const encounterId = ctxRef ? extractId(ctxRef) : undefined

    const prescriberOrg = getEntries<fhir3.Organization>(bundle, 'Organization')[0]

    // Order requests that are issues against this plan
    const orderRequests = requests
      .filter(r => {
        if (r.intent !== 'order') return false
        const basedOn = r.basedOn ? (Array.isArray(r.basedOn) ? r.basedOn : [r.basedOn]) : []
        return basedOn.some((b: fhir3.Reference) =>
          b.reference?.endsWith(`/${planReq.id}`) || b.reference === `MedicationRequest/${planReq.id}`
        )
      })
      .sort((a, b) => {
        const primary = (b.authoredOn ?? '').localeCompare(a.authoredOn ?? '')
        if (primary !== 0) return primary
        return (b.dispenseRequest?.validityPeriod?.start ?? '').localeCompare(a.dispenseRequest?.validityPeriod?.start ?? '')
      })

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
      const oEsd = req.dispenseRequest?.expectedSupplyDuration as fhir3.Duration | undefined
      const supplyDuration = oEsd?.value !== undefined
        ? `${oEsd.value} ${oEsd.unit ?? oEsd.code ?? ''}`.trim()
        : undefined
      const oRecorderRef = (req.recorder as fhir3.Reference | undefined)?.reference
      const { name: issueRecorder, id: issueRecorderId } = resolvePractitionerRef(bundle, oRecorderRef)
      return {
        id: req.id ?? '',
        issueDate: formatDate(req.authoredOn ?? req.dispenseRequest?.validityPeriod?.start),
        startDate: formatDate(req.dispenseRequest?.validityPeriod?.start),
        endDate: formatDate(req.dispenseRequest?.validityPeriod?.end),
        quantity: oQuantity,
        status: req.status,
        supplyDuration,
        dosageInstruction: oDosage?.text || undefined,
        patientInstructions: oDosage?.patientInstruction || undefined,
        pharmacyInstructions: req.note?.map(n => n.text).filter(Boolean).join('\n') || undefined,
        recorder: issueRecorder,
        recorderId: issueRecorderId,
      }
    })

    return {
      id: planReq.id ?? crypto.randomUUID(),
      drugName: name,
      snomedCode: code,
      dose,
      frequency,
      site,
      route,
      status: planReq.status ?? 'unknown',
      prescriptionType,
      prescribingAgency: undefined,
      startDate,
      endDate,
      lastIssuedDate: undefined,
      numberOfRepeatsAllowed,
      numberOfIssued,
      authorisationExpiryDate,
      prescribedQuantity,
      expectedSupplyDuration,
      encounterId,
      medicationResourceId,
      dateAsserted: formatDate(planReq.authoredOn),
      prescriber,
      prescriberId,
      recorder,
      recorderId,
      prescriberOrganisation: getOrganisationName(bundle),
      prescriberOrganisationId: prescriberOrg?.id,
      dosageInstruction: dosage?.text,
      additionalInformation: planReq.note?.[0]?.text,
      patientInstructions: dosage?.patientInstruction || undefined,
      pharmacyInstructions: planReq.note?.map(n => n.text).filter(Boolean).join('\n') || undefined,
      statusReason,
      statusChangeDate,
      medicationStatementId: '',
      medicationRequestIds: [planReq.id ?? ''],
      issues,
    }
  })

  return sortMeds(fallback)
}
