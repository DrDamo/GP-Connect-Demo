# GP Connect Access Record: Structured — Consultations

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Consultations-guidance  
**FHIR Profiles:** `CareConnect-GPC-Encounter-1`, `CareConnect-GPC-List-1`

---

## What Is a Consultation?

A **consultation** is the structure within which GP systems group one or more clinical record entries occurring at the same time and for the same or similar purpose, attributed to the same actor.

Key characteristics:
- Not exclusively clinician-patient encounters — can be administrative or communication events
- Generally assigned a Date / Doctor / Place / Type (the **Encounter**)
- May or may not have additional structure (Topics / Headings)
- May incorporate any type of clinical item (medications, test results, coded observations, etc.)

---

## Request Parameters

```json
{
  "name": "includeConsultations",
  "part": [
    { "name": "consultationSearchPeriod", "valuePeriod": { "start": "2020-01-01", "end": "2020-12-31" } },
    { "name": "includeNumberOfMostRecent", "valueInteger": 3 }
  ]
}
```

| Parameter | Description |
|-----------|-------------|
| `consultationSearchPeriod` | Returns consultations with `Encounter.period.start` after start and `period.end` before end |
| `includeNumberOfMostRecent` | Returns N most recent consultations (ordered by `Encounter.period.start` descending) |

---

## Logical Structure

Consultations follow a four-level hierarchy:

```
Encounter (context: date, doctor, place, type)
    └── List [Consultation] (code: 325851000000107)
            └── List [Topic] (code: 25851000000105)
                    └── List [Heading] (code: 24781000000107)
                            └── Clinical Items (Observation, AllergyIntolerance, Medication, etc.)
```

| Level | FHIR Profile | SNOMED Code | Description |
|-------|-------------|-------------|-------------|
| Context | `Encounter` | — | Date, doctor, place, type |
| Consultation | `List` | `325851000000107` | Top-level list linking to topics |
| Topic | `List` | `25851000000105` | Area of discussion; may link to a problem |
| Heading | `List` | `24781000000107` | SOAP-style heading (no national standard) |
| Clinical Item | Various | — | Any clinical record entry |

---

## FHIR Representation

### Encounter (Consultation Context)
```json
{
  "resourceType": "Encounter",
  "status": "finished",
  "type": [{ "coding": [{ "system": "http://snomed.info/sct", "code": "325851000000107" }] }],
  "subject": { "reference": "Patient/xxx" },
  "participant": [{ "individual": { "reference": "Practitioner/xxx" } }],
  "period": { "start": "2020-06-15T10:00:00+00:00" }
}
```

### Consultation List
References each Topic List as entries.

### Topic List
References each Heading List (or directly, clinical items if no headings).  
May reference a linked `Condition` (ProblemHeader) via `extension[actualProblem]`.

### Heading List
References clinical item resources.

### Topics Without Headings
Clinical items are referenced directly under the Topic list.

---

## Consultation Notes

Consultation notes may be recorded in two ways:

**Model 1:** Single free text block associated with coded items in the heading → returned as an `Observation` with SNOMED code `37331000000100` (Comment note) as the first item

**Model 2:** Multiple observations each with a clinical code and/or text → each item is a separate `Observation`

Both models converge so that reading through clinical items in order produces the consultation narrative.

---

## Clinical Item References

| Clinical Item Type | FHIR Resource |
|-------------------|---------------|
| Planned medication | `MedicationRequest` (intent=plan) |
| Issued prescription | `MedicationRequest` (intent=order) |
| Allergy | `AllergyIntolerance` |
| Immunisation | `Immunization` |
| Uncategorised data | `Observation` |
| Referral | `ReferralRequest` |
| Document | `DocumentReference` (metadata only) |
| Investigation | `DiagnosticReport` |
| Diary entry | `ProcedureRequest` |

---

## Unsupported Clinical Items in Consultations

When the provider can't export a linked clinical item type, a display reference is used:

```json
{ "item": { "display": "Referral items are not supported by the provider system" } }
```

---

## Confidential Items in Consultations

- **Confidential consultation:** Entire consultation excluded; Confidential Items warning code in primary List
- **Confidential item within consultation:** Consultation included; item excluded silently; warning code in appropriate secondary List

---

## Draft Consultations

Consultations saved in draft status MUST be included. `Encounter.status` = `draft`.

---

## Empty Consultations

Provider systems MUST NOT return empty consultations (no clinical content). Same applies to empty topics and headings.

---

## What Is NOT Returned by Consultation Queries

Some GP systems allow clinical data entry outside of consultation contexts. Such data is **not returned** by consultation queries. Consumers querying consultations only MUST NOT expect to obtain all items in the patient record.

---

## Secondary Lists Returned for Consultations

When consultations are requested, up to 10 secondary lists may be returned:

| Secondary List Title | Code |
|---------------------|------|
| Consultations - allergies | `consultations-allergies-contained-in-consultations` |
| Consultations - ended allergies | `consultations-allergies-that-have-been-ended-contained-in-consultations` |
| Consultations - diary entries | `consultations-diary-entries-contained-in-consultations` |
| Consultations - documents | `consultations-documents-contained-in-consultations` |
| Consultations - immunisations | `consultations-immunisations-contained-in-consultations` |
| Consultations - investigations | `consultations-investigations-contained-in-consultations` |
| Consultations - medications | `consultations-medications-contained-in-consultations` |
| Consultations - outbound referrals | `consultations-outbound-referrals-in-consultations` |
| Consultations - problems | `consultations-problems-contained-in-consultations` |
| Consultations - uncategorised data | `consultations-uncategorised-data-contained-in-consultations` |

---

## Security Labelling

> 🔄 **Coming in v1.6.2 — security labelling:** not present on the current v1.5.0 baseline.

`Encounter` and `List` resources **MAY** have `Meta.security` populated with a security label indicating information is not to be disclosed to the patient, in response to a retrieve-a-patient's-structured-record request (for applicable resources). This label **MUST** be populated on the equivalent migrate-a-patient's-record response, where applicable.

---

## FHIR Examples

See `fhir_examples/`:
- `consultation_example_request.json`
- `consultation_list_structure_snippet.json`
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Consultation-examples?version=current

---

## Source URLs

- Design guidance: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Consultations-guidance?version=current
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Consultation-examples?version=current
- Release notes (🔄 v1.6.2 items — list population clarification, security labelling): https://simplifier.net/guide/gp-connect-access-record-structured/Home/Introduction/Release-notes?version=1.6.2

