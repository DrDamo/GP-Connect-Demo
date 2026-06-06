# 17. Linkages, Search & Configuration

**Sources:**  
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Linkages?version=current  
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Search?version=current  
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Configuration-for-supported-clinical-areas?version=current  
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Using-lists-to-return-data?version=current

---

## Linkages

### Purpose

One of the core design aims of GP Connect ARS is that clinical data is presented consistently across all provider systems. Linkages — the relationships between FHIR resources — must also be presented consistently. For example, linking a MedicationStatement to a ProblemHeader (Condition) explains not just what the patient is taking, but why.

### Relationship Direction

Relationships between FHIR profiles are recorded in only one of the linked profiles (like a relational database). The direction of the arrow in the FHIR model shows which resource carries the reference. For example:
- `MedicationStatement` contains a reference to `Medication` — not the reverse
- `ProblemHeader (Condition)` carries `relatedClinicalContent` and `actualProblem` extension references

### What is Returned Per Clinical Area

#### Consultations
- A List containing references to Encounter for every matching consultation
- A List for each clinical area with data in the bundle
- For each Encounter:
  - The Encounter resource
  - Consultation structure Lists (topic/heading)
  - Linked ProblemHeader (Condition) resources
  - MedicationRequest (plan) + MedicationStatement + Medication for linked medications
  - MedicationRequest (order) for directly linked issues only
  - AllergyIntolerance (including resolved) for linked allergies
  - Immunization for linked immunisations
  - Observation for linked uncategorised data
  - ReferralRequest for linked referrals
  - DocumentReference (metadata only — no Binary) for linked documents
  - DiagnosticReport + ProcedureRequest + Observation + Specimen + DocumentReference for linked investigations
  - ProcedureRequest for linked diary entries
  - All ProblemHeader (Condition) resources linked to any returned item
  - Administrative resources: Patient, Organization, PractitionerRole, Practitioner, Location

> Clinical items within a returned Consultation are always included regardless of whether that area was requested in the query.

#### Problems
- A List of ProblemHeader (Condition) resources meeting search criteria
- A List of ProblemHeader (Condition) resources not meeting criteria but linked to those that do
- A List for each clinical area with data in the bundle
- For each Problem: all linked clinical items across all areas (same rules as Consultations above)
- Where an Observation (test/group header) is the actual problem, its DiagnosticReport MUST be linked in `relatedClinicalContent`

> Clinical items linked to a returned Problem are always included regardless of whether that area was separately requested.

#### Medications and Medical Devices
- A List of MedicationStatement resources meeting search criteria
- A List of linked ProblemHeaders in the bundle
- For each MedicationStatement: MedicationRequest (plan) + Medication + (optional) MedicationRequest (order) issues + linked Problems + administrative resources

#### Allergies
- A List of active AllergyIntolerance resources
- (If requested) A List of ended AllergyIntolerance resources (contained in the list — safety measure)
- A List of linked ProblemHeaders
- For each AllergyIntolerance: linked ProblemHeaders + administrative resources

#### Immunisations
- A List of Immunization and consent/dissent Observation resources
- A List of linked ProblemHeaders
- For each: linked Problems + administrative resources

#### Uncategorised Data
- A List of Observation resources
- A List of linked ProblemHeaders
- For each: linked Problems + administrative resources

#### Referrals
- A List of ReferralRequest resources
- A List of linked ProblemHeaders
- For each: linked Problems + DocumentReference (metadata only) + administrative resources

#### Investigations
- A List of DiagnosticReport resources
- A List of linked ProblemHeaders
- For each DiagnosticReport: ProcedureRequest + Specimens + Observations + DocumentReference (metadata only) + linked Problems + administrative resources

#### Diary Entries
- A List of ProcedureRequest resources
- A List of linked ProblemHeaders
- For each: linked Problems + administrative resources

### Unsupported Clinical Items in Consultations/Problems

Where a provider cannot export a linked clinical item type, it creates a List entry with:
```json
{
  "item": {
    "display": "Referral items are not supported by the provider system"
  }
}
```

### Duplicate Resources

Where the same resource instance would be returned from multiple query responses (e.g. a medication returned via both medication search and consultation search), it is only included **once** in the response bundle.

### Problem and Consultation Cross-Linkages

When consultations are requested, providers SHOULD return all references between resources wherever possible:
- The ProblemHeader references the consultation, consultation topic, actual problem item, and other consultation content
- The consultation topic references the ProblemHeader
- The actual problem item references the consultation
- All other consultation content references the consultation and is referenced by the ProblemHeader

For multi-area requests, related problem references are consolidated into a single List profile.

---

## Search Criteria

### Medications and Medical Devices
- Returns all MedicationStatement/MedicationRequest (intent=plan) whose `effectivePeriod.end` is null or ≥ the supplied start date
- Where no date supplied, all medications returned
- Issues (intent=order): returned for each plan if consumer requests them

### Allergies
- All active allergies always returned (clinically unsafe to return partial)
- Resolved allergies returned only when explicitly requested

### Problems
- Filtered by `status` (Active / Inactive / All)
- Where no status supplied, all problems returned

### Uncategorised Data
- Date range search on `effectiveDate` (inclusive)
- Items with no effective date always returned
- Where no dates supplied, all items returned

### Consultations
- Date range search on `assertedDate` (inclusive)
- OR search for most recent N consultations
- **Cannot combine both filters** — provider MUST return error if both present
- Where no filter supplied, all consultations returned

### Immunisations
- Given immunisations: always included
- Not-given immunisations: returned only if `includeNotGiven` parameter present
- Status/consent observations: returned if `includeStatus` parameter present (or by default)

### Investigations
- Date range search on `issued` date (inclusive)
- Where no dates supplied, all investigations returned

### Referrals
- Date range search on `authoredOn` date (inclusive)
- Where no dates supplied, all outbound referrals returned

### Diary Entries
- Search for items prior to a specified end date (`occurrencePeriod.start` or `occurrenceDateTime` ≤ end date)

### Following a Linkage

Most use cases require only one API call. However, where a retrieved item links to additional items the consumer needs:
1. The consumer makes a second GP Connect API call
2. Using supported search filters to retrieve a larger dataset
3. Then finds the specific item within the returned data

> This version of GP Connect does not support retrieval of a specific item by its identifier — consumers must use supported search filters.

---

## Using Lists to Return Data

### Primary Lists (10 types)

| Clinical Area | SNOMED Code | List.title |
|---|---|---|
| Allergies and adverse reactions | `886921000000105` | Allergies and adverse reactions |
| Ended allergies | `1103671000000101` | Ended allergies |
| Consultations | `1149501000000101` | List of consultations |
| Diary Entries | `714311000000108` | Patient recall administration |
| Immunisations | `1102181000000102` | Immunisations |
| Investigations | `887191000000108` | Investigations and results |
| Medications and medical devices | `933361000000108` | Medications and medical devices |
| Outbound Referrals | `792931000000107` | Outbound referral |
| Problems | `717711000000103` | Problems |
| Uncategorised data | `826501000000100` | Uncategorised data (Miscellaneous record) |

### Secondary Lists (21 types)

Secondary lists are only returned when consultations or problems are queried:

**Consultation secondary lists (10):**

| Code | Display |
|---|---|
| `consultations-allergies-contained-in-consultations` | Consultations - allergies contained in consultations |
| `consultations-allergies-that-have-been-ended-contained-in-consultations` | Consultations - allergies that have been ended contained in consultations |
| `consultations-diary-entries-contained-in-consultations` | Consultations - diary entries contained in consultations |
| `consultations-documents-contained-in-consultations` | Consultations - documents contained in consultations |
| `consultations-immunisations-contained-in-consultations` | Consultations - immunisations contained in consultations |
| `consultations-investigations-contained-in-consultations` | Consultations - investigations contained in consultations |
| `consultations-medications-contained-in-consultations` | Consultations - medications contained in consultations |
| `consultations-outbound-referrals-in-consultations` | Consultations - outbound referrals in consultations |
| `consultations-problems-contained-in-consultations` | Consultations - problems contained in consultations |
| `consultations-uncategorised-data-contained-in-consultations` | Consultations - uncategorised data contained in consultations |

**Problem secondary lists (11):**

| Code | Display |
|---|---|
| `problems-allergies-related-to-problems` | Problems - allergies related to problems |
| `problems-allergies-that-have-been-ended-related-to-problems` | Problems - allergies that have been ended related to problems |
| `problems-consultations-related-to-problems` | Problems - consultations related to problems |
| `problems-diary-entries-related-to-problems` | Problems - diary entries related to problems |
| `problems-documents-related-to-problems` | Problems - documents related to problems |
| `problems-immunisations-related-to-problems` | Problems - immunisations related to problems |
| `problems-investigations-related-to-problems` | Problems - investigations related to problems |
| `problems-medications-related-to-problems` | Problems - medications related to problems |
| `problems-outbound-referrals-related-to-problems` | Problems - outbound referrals related to problems |
| `problems-linked-problems-not-relating-to-the-primary-query` | Problems - linked problems not relating to the primary query |
| `problems-uncategorised-data-related-to-problems` | Problems - uncategorised data related to problems |

### Secondary List Rules

- Only returned when consultations or problems are directly queried
- Only returned where data exists (empty lists are not returned, except where warning codes are required)
- Items related to problems are those linked via `relatedClinicalContent` or `actualProblem` extensions
- Warning codes MUST be present if items are excluded for any reason
- For consultation secondary lists: warning code MUST be present even if no other data in the list
- Never return an empty secondary list with no warning codes

### Related Problems Secondary List

The `problems-linked-problems-not-relating-to-the-primary-query` list:
- MAY be returned as part of **any** query (not just problems queries)
- MUST contain problems linked to items in the primary list
- Only ONE related problems list is returned even for multi-area queries
- The consuming system is responsible for determining which problems link to which items

### Resolved Allergies List (Special Case)

The ended allergies list uses `List.contained` to hold the AllergyIntolerance resources directly within the list resource. This is a safety measure — resolved allergies cannot exist independently and can only be referenced in the context of that list. When resolved allergies appear in problems/consultations responses, the primary allergies list MUST also be returned.

### Warning Codes in Lists

Warning codes appear in `List.extension[warningCode]` when items that would have been in the list are not included:

| Display | Code | Associated text |
|---|---|---|
| Confidential Items | `confidential-items` | Items excluded due to confidentiality and/or patient preferences. |
| Data in Transit | `data-in-transit` | Patient record transfer from previous GP practice not yet complete; information recorded before dd-Mmm-yyyy may be missing. |
| Data awaiting filing | `data-awaiting-filing` | Patient record contains some items in the GP practice workflow that have not been reviewed for inclusion in this message; information recorded before dd-Mmm-yyyy may be missing. |

Warning codes are NOT used in consultation structure lists (topic/heading lists).

---

## Configuration for Supported Clinical Areas

### Overview

The ARS capability requires the ability to enable/disable clinical areas in a provider system:
- To manage **First of Type (FoT)** implementations — disable areas still in development
- To manage **clinical safety incidents** — rapidly disable a problematic area

### Clinical Areas That Can Be Switched On/Off

- Medications
- Allergies
- Consultations
- Problems
- Uncategorised data
- Immunisations
- Investigations
- Referrals
- Diary entries
- Documents (controls DocumentReference resources; independent of Access Document capability)

### Global vs Site-Level Switch

- Providers MAY allow global switch (all sites) without requiring a software release
- Providers MUST allow site-level switch (individual practice) without requiring a release

### Response When a Clinical Area is Disabled

Provider returns:
- HTTP `200 OK`
- FHIR resources for enabled clinical areas
- An `OperationOutcome` with a `warning`-severity issue for each disabled area:

```json
{
  "resourceType": "OperationOutcome",
  "meta": {"profile": ["https://fhir.nhs.uk/STU3/StructureDefinition/GPConnect-OperationOutcome-1"]},
  "issue": [{
    "severity": "warning",
    "code": "not-supported",
    "details": {
      "coding": [{
        "system": "https://fhir.nhs.uk/STU3/CodeSystem/Spine-ErrorOrWarningCode-1",
        "code": "NOT_IMPLEMENTED",
        "display": "Not implemented"
      }],
      "text": "includeProblems has been disabled"
    },
    "diagnostics": "includeProblems"
  }]
}
```

For `Documents` disabled: use `"DocumentReferences"` as the parameter name in the message.

Providers MAY also return an empty List resource with warning/emptyReason.

### References to Disabled Areas in Lists

Where a disabled area would have been referenced from a Consultation or Problem list:
```json
{
  "item": {
    "display": "Referral items have been disabled"
  }
}
```

Confidential items that are also disabled: follow the `confidential-items` warning code rules — confidentiality takes precedence.

### Consumer Requirements

Consumer systems MUST be able to handle unavailable clinical areas and warn users that information has not been returned.

### Enablement (Provider Requirements)

- Providers SHALL provide a mechanism for a data controller at a practice to globally disable/enable GP Connect provider APIs
- Shall be deployed as **disabled by default**
- Each assured capability (Access Record HTML / Appointment Management / Access Record Structured / Access Document) shall be independently disableable
- Each capability shall be deployed as **disabled by default**
- Providers SHALL audit any enable/disable action

---

## Sources

- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Linkages?version=current
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Search?version=current
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Configuration-for-supported-clinical-areas?version=current
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Using-lists-to-return-data?version=current
