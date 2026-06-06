# GP Connect Access Record: Structured — Lists & References

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Using-lists-to-return-data  
**FHIR Profile:** `CareConnect-GPC-List-1`

---

## The Role of Lists in GP Connect ARS

The `List` resource is used to organise data returned by a query into **groups of resources** that can be processed more easily. Every clinical area query returns at least one primary List.

**Key purposes:**
- Identify which data was returned for which clinical area
- Return an empty List when no data is present
- Carry **warning codes** when items were excluded
- Structure consultation and problem response data

---

## Primary Lists

One primary List per clinical area requested:

| Clinical Area | SNOMED Code | List Title |
|--------------|-------------|-----------|
| Allergies and adverse reactions | `886921000000105` | Allergies and adverse reactions |
| Ended allergies | `1103671000000101` | Ended allergies |
| Consultations | `1149501000000101` | List of consultations |
| Diary Entries | `714311000000108` | Patient recall administration |
| Immunisations | `1102181000000102` | Immunisations |
| Investigations | `887191000000108` | Investigations and results |
| Medications | `933361000000108` | Medications and medical devices |
| Outbound Referrals | `792931000000107` | Outbound referral |
| Problems | `717711000000103` | Problems |
| Uncategorised data | `826501000000100` | Uncategorised data |

---

## Secondary Lists (for Consultations and Problems)

21 secondary lists may be returned when Consultations or Problems are requested:

### Consultation Secondary Lists

| Title | Code |
|-------|------|
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

### Problems Secondary Lists

| Title | Code |
|-------|------|
| Problems - allergies | `problems-allergies-related-to-problems` |
| Problems - ended allergies | `problems-allergies-that-have-been-ended-related-to-problems` |
| Problems - consultations | `problems-consultations-related-to-problems` |
| Problems - diary entries | `problems-diary-entries-related-to-problems` |
| Problems - documents | `problems-documents-related-to-problems` |
| Problems - immunisations | `problems-immunisations-related-to-problems` |
| Problems - investigations | `problems-investigations-related-to-problems` |
| Problems - medications | `problems-medications-related-to-problems` |
| Problems - outbound referrals | `problems-outbound-referrals-related-to-problems` |
| Problems - linked problems (not primary) | `problems-linked-problems-not-relating-to-the-primary-query` |
| Problems - uncategorised data | `problems-uncategorised-data-related-to-problems` |

---

## Secondary List Rules

- Only returned when Consultations or Problems are requested
- Only present when data exists (empty secondary lists are NOT returned — except consultation structure lists)
- Related problems secondary list MAY be returned as part of any query (for problems linked to items in the primary list)
- Only one related problems list even if multiple clinical areas queried
- MUST include warning codes where items are excluded

---

## Empty Lists

When no data is available for a clinical area, an empty List MUST be returned:

```json
{
  "resourceType": "List",
  "status": "current",
  "mode": "snapshot",
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "717711000000103", "display": "Problems" }] },
  "emptyReason": {
    "coding": [{
      "system": "https://fhir.nhs.uk/STU3/CodeSystem/CareConnect-ListEmptyReasonCode-1",
      "code": "no-content-recorded",
      "display": "No Content Recorded"
    }]
  },
  "note": [{ "text": "Information not available." }]
}
```

---

## Warning Codes

Warning codes are carried in `List.extension[warningCode]` and used when items that WOULD have been returned are absent for specific reasons.

### Available Warning Codes

| Display | Code | Associated Text |
|---------|------|-----------------|
| Confidential Items | `confidential-items` | `Items excluded due to confidentiality and/or patient preferences.` |
| Data in Transit | `data-in-transit` | `Patient record transfer from previous GP practice not yet complete; information recorded before dd-Mmm-yyyy may be missing.` |
| Data awaiting filing | `data-awaiting-filing` | `Patient record contains some items in the GP practice workflow that have not been reviewed for inclusion in this message; information recorded before dd-Mmm-yyyy may be missing.` |

### Confidential Items
```json
{
  "extension": [{
    "url": "https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-GPC-ListWarningCode-1",
    "valueCode": "confidential-items"
  }],
  "note": [{ "text": "Items excluded due to confidentiality and/or patient preferences." }]
}
```

### Data in Transit
Applies when a patient has moved GP practice and records from the previous practice have not yet been received/incorporated. When this applies, ALL lists MUST carry this warning code.

### Data Awaiting Filing
Applies when the GP system has received electronic data but it hasn't yet been reviewed and filed. GP Connect only returns filed data.

---

## Warning Code Rules

- Warning codes MUST be in primary AND secondary lists where applicable
- If an item would have been in multiple lists (e.g., medication and medication related to problems), the code MUST appear in BOTH
- Warning codes MUST NOT be in consultation structure Lists (Encounter-level Lists)
- Warning codes MUST still be returned even if the relevant clinical area capability is turned off
- If results contained ONLY confidential items: empty List + emptyReason + Confidential Items warning

---

## List Structure Details

### List.code (system URL for secondary lists)

The secondary list codes use the GP Connect code system:

```
https://fhir.nhs.uk/STU3/CodeSystem/GPConnect-SecondaryListCode-1
```

### Resolved Allergies List — Special Case

The resolved allergies List uses **contained resources** for AllergyIntolerance (not standalone references). This is a safety measure to prevent resolved allergies being confused with active ones.

The active allergies List MUST still be returned alongside whenever resolved allergies are returned in consultations/problems context.

---

## Consultation Structure Lists

In addition to primary/secondary lists, consultations use Lists internally to represent structure:

| SNOMED Code | Used For |
|-------------|----------|
| `325851000000107` | Consultation (top-level list) |
| `25851000000105` | Topic |
| `24781000000107` | Heading (SOAP-style) |

These Lists carry `entry` references to the items within them and are NOT subject to the warning code and empty-list rules that apply to primary/secondary lists.

---

## Must Support Definition

In GP Connect FHIR profiles, `Must Support` means:
> If a system is providing resources and an item is flagged as 'Must support', the system MUST include the data item if it is available.

This is equivalent to **Required** in GP Connect optionality terminology.

---

## Optionality Definitions

| Term | Meaning |
|------|---------|
| **Mandatory** | MUST always be present |
| **Required** | MUST be included if the data is available in the system |
| **Optional** | May be included if available |

---

## Business Identifiers

Each clinical resource has a unique business identifier scoped by supplier namespace:

```json
{
  "identifier": [{
    "system": "https://provider.nhs.uk/data-identifier",
    "value": "83426283749629"
  }]
}
```

This allows consuming systems to distinguish previously integrated data from new data.

---

## FHIR Examples

See `fhir_examples/`:
- `list_with_warning_code_snippet.json`
- `list_empty_no_content_snippet.json`
- `consultation_list_structure_snippet.json`

