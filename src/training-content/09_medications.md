# GP Connect Access Record: Structured — Medications & Medical Devices

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Medication-and-medical-device-guidance  
**FHIR Profiles:** `CareConnect-GPC-MedicationStatement-1`, `CareConnect-GPC-MedicationRequest-1`, `CareConnect-GPC-Medication-1`

---

## Overview

Medications and Medical Devices use three FHIR resources working together:

| Resource | Purpose | Intent Value |
|----------|---------|--------------|
| `Medication` | The drug/device itself (dm+d coded) | N/A |
| `MedicationStatement` | Summary of the authorisation (links Statement to Request/Plan) | N/A |
| `MedicationRequest` (plan) | The **authorisation** — repeat, acute or repeat dispensed | `plan` |
| `MedicationRequest` (order) | An individual **prescription issue** | `order` |

---

## Request Parameters

```json
{
  "name": "includeMedication",
  "part": [
    { "name": "medicationSearchFromDate", "valueDate": "2020-01-01" },
    { "name": "includePrescriptionIssues", "valueBoolean": true }
  ]
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeMedication` | (top-level) | Triggers medication data in response |
| `medicationSearchFromDate` | Date | Returns authorisations active on or after this date |
| `includePrescriptionIssues` | Boolean | Default `true`; `false` excludes MedicationRequest (intent=order) |

---

## Search Criteria Logic

### medicationSearchFromDate
Returns all **MedicationStatement + MedicationRequest (intent=plan)** whose effective period end date is:
- `null` (on-going), OR
- On or after the `medicationSearchFromDate`

**Medication activity rules:**
- **Acute:** Active on its `effective.start` date only
- **Repeat:** Active from `effective.start` with no end = on-going
- If not explicitly identified as acute or repeat → treated as **repeat**
- **Prescribed elsewhere:** Always returned regardless of search date

### Medication List
```json
{
  "resourceType": "List",
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "933361000000108", "display": "Medications and medical devices" }] },
  "entry": [
    { "item": { "reference": "MedicationStatement/xxx" } }
  ]
}
```

---

## Resource Relationships

```
MedicationList (List)
    └── MedicationStatement (one per authorisation)
            └── MedicationRequest [intent=plan] (authorisation)
                    └── MedicationRequest [intent=order] (each prescription issue)
                                └── Medication (the drug/device)
```

---

## MedicationStatement — Key Elements

| Element | Optionality | Notes |
|---------|-------------|-------|
| `id` | Mandatory | Unique business identifier |
| `basedOn` | Mandatory | Reference to MedicationRequest (intent=plan) |
| `status` | Mandatory | `active`, `completed`, `stopped` |
| `medicationReference` | Mandatory | Reference to Medication resource |
| `effectivePeriod` / `effectiveDateTime` | Required | Active period or point in time |
| `dateAsserted` | Mandatory | When the statement was recorded |
| `subject` | Mandatory | Reference to Patient |
| `taken` | Mandatory | Usually `unk` |
| `dosage.text` | Required | Dosage instructions (unstructured text) |
| `note` | Optional | Pharmacy notes |
| `extension[lastIssueDate]` | Required | Date of last prescription issue |
| `extension[prescribingAgency]` | Required | Where prescribed (e.g., `prescribed-at-gp-practice`) |

---

## MedicationRequest (intent=plan) — Authorisation

| Element | Optionality | Notes |
|---------|-------------|-------|
| `id` | Mandatory | Unique identifier |
| `status` | Mandatory | `active`, `completed`, `stopped` |
| `intent` | Mandatory | **`plan`** |
| `extension[repeatInformation]` | Required for repeats | `numberOfRepeatPrescriptionsAllowed`, `numberOfRepeatPrescriptionsIssued` |
| `extension[prescriptionType]` | Mandatory | `acute`, `repeat`, `repeat-dispensing`, `delayed-prescribing` |
| `medicationReference` | Mandatory | Reference to Medication |
| `subject` | Mandatory | Reference to Patient |
| `authoredOn` | Mandatory | Date authorisation created |
| `recorder` | Mandatory | PractitionerRole who recorded |
| `dosageInstruction.text` | Required | Dosage as text |
| `dispenseRequest.validityPeriod` | Required | Start (and end if completed) |
| `dispenseRequest.quantity` | Required | Quantity dispensed |
| `dispenseRequest.expectedSupplyDuration` | Required | Duration in days |
| `statusReason` | Required when stopped | Textual stop reason |
| `priorPrescription` | Required for re-authorisation | Reference to previous plan |

---

## MedicationRequest (intent=order) — Prescription Issue

| Element | Optionality | Notes |
|---------|-------------|-------|
| `intent` | Mandatory | **`order`** |
| `basedOn` | Mandatory | Reference to MedicationRequest (intent=plan) |
| `groupIdentifier` | Required for repeat dispensed | Links issues to same batch |
| `status` | Mandatory | Usually `completed` |
| Other elements | As per plan | Inherit from authorisation |

---

## Medication Resource

```json
{
  "resourceType": "Medication",
  "id": "F87D9962-6D02-41C7-85C7-735214FA6FC5",
  "meta": { "profile": ["https://fhir.nhs.uk/STU3/StructureDefinition/CareConnect-GPC-Medication-1"] },
  "code": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "317971007",
        "display": "Furosemide 20mg tablets"
      }
    ]
  }
}
```

### dm+d Name vs Displayed Name
If the displayed name in the source system differs from dm+d, the **original name MUST be preserved** in `CodeableConcept.text`. If they match, `CodeableConcept.text` MUST be omitted.

---

## Key Clinical Rules

### Degraded Medications
Medications from GP2GP transfers or other sources that cannot be coded must use:
- Code: `196421000000109` (Transfer-degraded medication entry)
- Text: Original medication name in `CodeableConcept.text`

### Medication Discontinuation / Stopping
When stopped:
- Set `status` to `stopped`
- Provide `statusReason.reason` as text
- Do NOT add statusReason when an authorisation has simply expired

### Re-authorisation
When re-authorised, a **new** MedicationStatement + MedicationRequest (intent=plan) MUST be created. The new plan SHOULD reference the old one via `priorPrescription`.

### Dosage Amendment
When dosage changes, the existing authorisation MUST be stopped and a new one created. The new plan references the old via `priorPrescription`.

**Example of dosage change linkage:**
```json
"priorPrescription": {
  "reference": "MedicationRequest/E9881EF6-EF3A-4556-9202-A437C5E31128-HD-1"
}
```
See `fhir_examples/medication_dosage_change_example.json`

### Mixtures / Extemporaneous Preparations
Use degrade code `196421000000109` with constituents described in `CodeableConcept.text`.

### Medication Reviews
Medication reviews are in scope under **Diary Entries** (not Medications), if coded with a due date.

### Future-Dated Prescriptions
May be included (e.g., repeat dispensed, deferred acutes).

### Dosage Syntax
Currently expressed as **unstructured text** (`dosageInstruction.text`). Transition to structured dose syntax (ISN DAPB4013, UK Core guidance) is planned.

---

## Prescription Types

| Code | Display | Description |
|------|---------|-------------|
| `acute` | Acute | One-off prescription |
| `repeat` | Repeat | Recurring prescription with defined allowance |
| `repeat-dispensing` | Repeat dispensing | EPS repeat dispensed |
| `delayed-prescribing` | Delayed prescribing | Deferred prescriptions |

---

## FHIR Examples

See `fhir_examples/` folder:
- `medication_example1_request.json` — Request for medications + issues
- `medication_statement_active_repeat_snippet.json` — Active repeat MedicationStatement
- `medication_request_intent_plan_snippet.json` — Authorisation (intent=plan)
- `medication_request_intent_order_snippet.json` — Prescription issue (intent=order)
- `medication_dosage_change_example.json` — Dosage amendment with priorPrescription

---

## Source URLs

- Design guidance: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Medication-and-medical-device-guidance?version=current
- Resource relationships: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Medication-and-medical-device-resource-relationships?version=current
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Medication-examples?version=current

