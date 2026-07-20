# GP Connect Access Record: Structured — Diary Entries

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Diary-entry-guidance  
**FHIR Profile:** `CareConnect-GPC-ProcedureRequest-1`

---

## What Is a Diary Entry?

A **diary entry** is primarily a proposal for clinical action to be undertaken at an indicative future date, which has **not been completed or cancelled**. It is:
- Dated but unscheduled (not a booked appointment)
- Not a commitment of resources
- A reminder, recall, follow-up, or scheduled treatment

Examples:
- Antipsychotic injections
- Asthma review / Medication review
- Cytology Smear
- Depo Provera
- Diabetes / Epilepsy / Mental Health review
- NHS Health Checks
- Seasonal influenza vaccination due
- Repeat blood tests

> **Note:** Diary entries may be known as 'recalls' in some GP systems.

---

## Scope

**In scope:** Incomplete diary entries only — complete or cancelled diary entries MUST NOT be included.

**Out of scope:**
- Appointments
- Warnings / Alerts
- Tasks

---

## Request Parameters

```json
{
  "name": "includeDiaryEntries",
  "part": [
    { "name": "diaryEntriesSearchDate", "valueDate": "2023-12-31" }
  ]
}
```

| Parameter | Description |
|-----------|-------------|
| `diaryEntriesSearchDate` | Returns diary entries due **on or before** this date. Diary entries past their due date but still active are always included. Must be a future date. |

---

## ProcedureRequest Resource — Key Elements

| Element | Optionality | Notes |
|---------|-------------|-------|
| `id` | Mandatory | Unique business identifier |
| `status` | Mandatory | Always `active` (regardless of source system status) |
| `intent` | Mandatory | `plan` |
| `code` | Mandatory | SNOMED CT code for the planned action |
| `subject` | Mandatory | Reference to Patient |
| `authoredOn` | Mandatory | When diary entry was recorded in system |
| `requester` | Required | Practitioner who created the entry |
| `occurrenceDateTime` / `occurrencePeriod` | Required | Planned date or date range |
| `reasonReference` | Optional | Linked Condition (ProblemHeader) |
| `note` | Optional | Free text notes |

---

## Key Clinical Rules

### Status
All incomplete diary entries use `status: active` — GP systems don't standardise status values.

> ⚠️ Diary entries may still appear even if the action has been taken, if the diary entry wasn't updated promptly. Consumers must make this clear to users.

### Code
- MUST use a valid SNOMED CT code wherever practical
- May include codes that have a standard interpretation of a completed action (e.g., procedure codes) — these MUST still be presented as **incomplete planned actions**
- Consumers MUST ensure users understand the item represents a future plan, not a completed event

### Medication Reviews
Medication reviews MUST be included in diary entries. Providers may substitute the recorded code with `314529007` (Medication review due).

### Planned Date
- May be a single date or date range
- Represents earliest date, latest date, or indicative date (varies by record)
- `occurrencePeriod` preferred where feasible

### authoredOn vs Consultation Date
When displaying an originating date, **give primacy to the consultation date** (if linked) over `authoredOn`.

---

## Diary Entries and Problems

Diary entries linked to problems will appear in the secondary list:
`Problems - diary entries related to problems`

---

## Diary Entries and Consultations

Diary entries created within a consultation will appear in:
`Consultations - diary entries contained in consultations`

---

## List Returned for Diary Entries

```json
{
  "resourceType": "List",
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "714311000000108", "display": "Patient recall administration" }] },
  "entry": [{ "item": { "reference": "ProcedureRequest/xxx" } }]
}
```

| List SNOMED Code | Title |
|-----------------|-------|
| `714311000000108` | Patient recall administration |

The `List` MUST reference all returned `ProcedureRequest` resources. If there is no data to return, the `List` MUST populate `emptyReason.code` with `no-content-recorded`. *(Source: Home/Design/Diary-entry-guidance)*

---

## FHIR Examples

See `fhir_examples/`:
- `diary_entry_example_request.json`
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Diary-entry-examples?version=current

