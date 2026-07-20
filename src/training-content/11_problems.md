# GP Connect Access Record: Structured — Problems

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Problem-guidance  
**FHIR Profile:** `CareConnect-GPC-ProblemHeader-Condition-1` (referred to as ProblemHeader or Condition)

---

## What Is a Problem?

A **problem** is a concept in all GP systems that allows a clinician to identify and highlight specific clinical items describing the status of the patient's health. Any clinical item can be made a problem.

Problems link to:
- Every **consultation** where the problem was discussed
- Every **clinical item** identified as relevant to the problem
- Every **other problem** identified as related

Examples:
- Anxiety with depression
- Hypertension
- Atrial fibrillation
- Blood pressure recorded by patient at home
- Lives alone

---

## Request Parameters

```json
{
  "name": "includeProblems",
  "part": [
    { "name": "filterStatus", "valueCode": "active" },
    { "name": "filterSignificance", "valueCode": "major" }
  ]
}
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `filterStatus` | `active`, `inactive` | Filter by clinical status |
| `filterSignificance` | `major`, `minor` | Filter by problem significance (matches `extension[problemSignificance]`) |

*`filterSignificance` confirmed in the `includeProblems` parameter schema: [gp-connect-access-record-structured-fhir.yaml](https://github.com/NHSDigital/gp-connect-access-record-structured-fhir/blob/master/specification/gp-connect-access-record-structured-fhir.yaml) (NHSDigital/gp-connect-access-record-structured-fhir, `master`); `major`/`minor` values confirmed via the `problemSignificance` extension used in [Problem examples](https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Problem-examples?version=current).*

> 🔄 **Removed in v1.6.2 — `filterSignificance`:** valid and supported on the current v1.5.0 baseline, but the ARS Implementation Guide's API-version-compatibility page states that guide version **1.6.2+ drops the `filterSignificance` (`significance`) parameter for problems** entirely. Build against it for today's v1.5.0 consumers, but don't plan around its long-term availability. Source: [API version compatibility](https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/API-version-compatibility?version=current)

---

## Response Structure

### Primary List
Contains references to all ProblemHeader (Condition) resources matching the search criteria.

### Secondary Lists (for linked items)

| Secondary List | Code |
|---------------|------|
| Problems - allergies related | `problems-allergies-related-to-problems` |
| Problems - ended allergies related | `problems-allergies-that-have-been-ended-related-to-problems` |
| Problems - consultations related | `problems-consultations-related-to-problems` |
| Problems - diary entries related | `problems-diary-entries-related-to-problems` |
| Problems - documents related | `problems-documents-related-to-problems` |
| Problems - immunisations related | `problems-immunisations-related-to-problems` |
| Problems - investigations related | `problems-investigations-related-to-problems` |
| Problems - medications related | `problems-medications-related-to-problems` |
| Problems - outbound referrals related | `problems-outbound-referrals-related-to-problems` |
| Problems - linked problems (not primary) | `problems-linked-problems-not-relating-to-the-primary-query` |
| Problems - uncategorised data related | `problems-uncategorised-data-related-to-problems` |

---

## ProblemHeader (Condition) — Key Extensions

| Extension | Description |
|-----------|-------------|
| `extension[actualProblem]` | Reference to the clinical item that IS the problem (e.g., AllergyIntolerance, Observation) |
| `extension[relatedClinicalContent]` | References to all clinical items linked to the problem |
| `extension[problemSignificance]` | Major or minor significance |
| `extension[episodicity]` | First, new, ongoing, review |

---

## Clinical Item References

When a clinical item is linked to a problem:
- Reference is held in `extension[actualProblem]` (what the problem IS) or `extension[relatedClinicalContent]` (what is linked to it)

| Clinical Item | FHIR Resource Referenced |
|--------------|------------------------|
| Medication | `MedicationRequest` (intent=plan for medication) |
| Allergy | `AllergyIntolerance` |
| Consultation | `Encounter` |
| Immunisation | `Immunization` |
| Uncategorised data | `Observation` |
| Referral | `ReferralRequest` |
| Document | `DocumentReference` |
| Investigation | `DiagnosticReport` |
| Diary entry | `ProcedureRequest` |

---

## Problem Linkages

Problems can be linked to other problems. GP Connect uses a common model:
- Parent / Child / Sibling relationships are shown
- The source system's specific terminology is NOT reflected (too varied between systems)

### Status Filtering and Linked Problems
When `filterStatus = active` is requested:
- Inactive problems directly linked to active problems ARE returned (in secondary list)
- They appear in `problems-linked-problems-not-relating-to-the-primary-query`
- Consumers can identify them as they appear in the secondary list but NOT the primary list

---

## Out of Scope Clinical Items Linked to Problems

Some items linked to problems won't be in the response (complete diary entries, test requests). Where this occurs:

```json
{
  "url": "http://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-RelatedClinicalContent-1",
  "valueReference": {
    "display": "Referral items are not supported by the provider system"
  }
}
```

---

## Confidential Items in Problems

- **Confidential problem:** Excluded; Confidential Items warning in primary List
- **Confidential item linked to problem:** Problem included; item excluded; warning in relevant secondary list; no indication from which problem it was removed

---

## Investigation Linked to a Problem

Where a specific test observation has been made a problem, the `DiagnosticReport` MUST be the reference in `relatedClinicalContent`, not the individual Observation.

---

## List Returned for Problems

| List SNOMED Code | Title |
|-----------------|-------|
| `717711000000103` | Problems |

---

## FHIR Examples

See `fhir_examples/`:
- `problems_example_request.json`
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Problem-examples?version=current

