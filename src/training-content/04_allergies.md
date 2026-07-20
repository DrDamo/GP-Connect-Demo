# GP Connect Access Record: Structured — Allergies

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Allergies-Guidance  
**FHIR Profile:** `CareConnect-GPC-AllergyIntolerance-1`

---

## Overview

The allergy/intolerance domain is broad and multidimensional, covering:
- Causation (medications, pharmaceutical substances, environmental substances)
- Certainty and severity
- Linkages to other clinical events (diagnostic tests, illness)
- Dynamic evolution over time

The GP Connect `AllergyIntolerance` resource aims to improve interoperability by converging towards a **standardised structure and common terminology**.

---

## Request Parameters

```json
{
  "name": "includeAllergies",
  "part": [
    { "name": "includeResolvedAllergies", "valueBoolean": true }
  ]
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeAllergies` | (top-level) | Triggers allergy data in the response |
| `includeResolvedAllergies` | Boolean | `true` = include resolved allergies; `false` = active only |

---

## Response Structure

### Lists Returned

| List Title | SNOMED Code | Content |
|------------|-------------|---------|
| `Allergies and adverse reactions` | `886921000000105` | Active AllergyIntolerance resources |
| `Ended allergies` | `1103671000000101` | Resolved allergies (as **contained resources** within the List) |

### Resources Returned

- `List` (active allergies)
- `List` (ended/resolved allergies — contains resolved AllergyIntolerance as contained resources)
- `AllergyIntolerance` resources (active)
- `Organization`, `Practitioner`, `PractitionerRole` as referenced

---

## Key Clinical Rules

### Resolved Allergies Are Contained Within Their List
Resolved allergies are returned as **contained resources inside the List**, not as standalone references. This is a **clinical safety measure** to prevent resolved allergies being confused with active ones.

```json
{
  "resourceType": "List",
  "title": "Ended allergies",
  "contained": [
    {
      "resourceType": "AllergyIntolerance",
      "id": "Resolved-1",
      "clinicalStatus": "resolved",
      "code": {
        "coding": [{ "code": "196461000000101", "display": "Transfer-degraded drug allergy" }],
        "text": "Resolved 'Allergy to apixaban' original code 985271000000102."
      }
    }
  ],
  "entry": [{ "item": { "reference": "#Resolved-1" } }]
}
```

### Resolved Allergy Coding Rules

All resolved allergies MUST be returned as **Transfer-degraded drug allergy**:

| Original Coding | Code to Use | System |
|----------------|-------------|--------|
| SNOMED CT | `196461000000101` | `http://snomed.info/sct` |
| Read V2 | `9bJ4.` | `http://read.info/readv2` |
| Read CTV3 | `9bJ4.` | `http://read.info/ctv3` |

Text format: `Resolved '<original term text>' original code <original code>.`

### No Known Allergies (NKA)
Where NKA is explicitly recorded in the source system:

```json
{
  "resourceType": "AllergyIntolerance",
  "clinicalStatus": "active",
  "code": {
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "716186003",
      "display": "No known allergy"
    }]
  }
}
```

### Empty List — No Content Recorded
An empty **active** allergies `List` only asserts the absence of *active* allergies — it does **not** assert that the patient has no allergies at all. Both the active list and the resolved (`Ended allergies`) list must be empty for a consumer to conclude no allergy information exists for the patient.

Where no allergies exist and NKA has not been positively asserted:

```json
{
  "resourceType": "List",
  "title": "Active Allergies",
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

## AllergyIntolerance Resource — Key Elements

| Element | Optionality | Notes |
|---------|-------------|-------|
| `id` | Mandatory | Unique business identifier (provider-scoped) |
| `clinicalStatus` | Mandatory | `active` or `resolved` |
| `verificationStatus` | Mandatory | Usually `unconfirmed` |
| `type` | Required | `allergy` or `intolerance` |
| `category` | Required | `medication` (if interacts with prescribing decision support) or `environment` |
| `criticality` | Optional | `low`, `high`, `unable-to-assess` |
| `code` | Mandatory | SNOMED CT or dm+d causative agent |
| `patient` | Mandatory | Reference to Patient |
| `assertedDate` | Mandatory | Date allergy was asserted |
| `recorder` | Mandatory | Reference to PractitionerRole |
| `note` | Required | All qualifiers and free text in single notes field |
| `reaction.manifestation` | Required if reaction recorded | Must use `nullFlavor NI` if no manifestation but severity known |
| `reaction.severity` | Optional | `mild`, `moderate`, `severe` |
| `extension[endDate]` | Required for resolved | Date allergy was ended |
| `extension[reasonEnded]` | Optional for resolved | Reason the allergy was ended |

### Category Assignment Rule

> If the allergy/intolerance interacts with prescribing decision support → **`medication`**  
> Otherwise → **`environment`**

Where the allergy/intolerance type **cannot be distinguished** between `medication` and `environment` (e.g. the causative agent's classification is ambiguous), `AllergyIntolerance.category` **MUST** default to `medication`.

> 🔄 **Coming in v1.6.2 — category default clarified:** this default-to-`medication` rule for ambiguous cases is confirmed explicitly in the v1.6.2 release notes ("Clarify allergy/intolerance category use"). It isn't stated this precisely in earlier guide text, so treat it as good practice now but a hard requirement from v1.6.2 onward.

### Notes Field — Single Field for All Qualifiers

All qualifiers (certainty, severity, episodicity, etc.) MUST be formatted as labelled name/value pairs in `AllergyIntolerance.note`:

```json
"note": [{
  "text": "Allergy Type: Adverse Reaction, Certainty: Absolute, Severity: Very Severe, NOTES: Some freetext notes"
}]
```

---

## Degradation Rules

### Consumer Degradation
When a consumer system cannot fully understand a coded causative agent:
- Code as `196461000000101` (Transfer-degraded drug allergy)
- Preserve original term as text
- **Prevent prescribing** while degraded drug allergies are present
- Inform users attempting to prescribe

### Provider Degradation
Providers **MUST NOT** pre-emptively degrade coded information. Degradation is a consumer responsibility.

---

## Allergy Interoperability Challenges

### Entries as Non-Allergies in Source Systems
If a provider system allows allergy codes to be entered as journal entries (not as formal allergy records), these **MUST still be exported as AllergyIntolerance resources**.

### Allergy/Problem Orthogonality
If an allergy has been made a problem heading with problem metadata (episodicity, priority, etc.), the dual representation **MUST NOT affect** the AllergyIntolerance resource representation.

### Unsupported Qualifiers
System-specific qualifiers not supported by the AllergyIntolerance profile MUST be rendered as text in `AllergyIntolerance.note`.

---

## Reaction Cardinality

- Only **one reaction** per AllergyIntolerance resource
- Only **one manifestation** per reaction
- If severity is known but no manifestation: use `nullFlavor NI`

```json
"reaction": [{
  "manifestation": [{
    "coding": [{ "system": "http://hl7.org/fhir/v3/NullFlavor", "code": "NI", "display": "NoInformation" }]
  }],
  "severity": "severe"
}]
```

---

## Security Labelling

> 🔄 **Coming in v1.6.2 — security labelling:** not present on the current v1.5.0 baseline.

`AllergyIntolerance` resources **MAY** have `Meta.security` populated with a security label indicating information is not to be disclosed to the patient, in response to a retrieve-a-patient's-structured-record request (for applicable resources). This label **MUST** be populated on the equivalent migrate-a-patient's-record response, where applicable.

---

## Yellow Card Relationship

Data directly associated with the MHRA Yellow Card scheme **MUST NOT** be included in the AllergyIntolerance resource.

---

## FHIR Examples

See `fhir_examples/` folder:
- `allergy_example1_request.json` — Request with resolved allergies
- `allergy_example1_response_bundle.json` — Response bundle with active + resolved
- `allergy_example2_request_no_resolved.json` — Request active only
- `allergy_nka_resource_snippet.json` — No Known Allergy resource
- `allergy_empty_list_snippet.json` — Empty list
- `allergy_resolved_snomed_snippet.json` — Resolved allergy (SNOMED)
- `allergy_resolved_readcode_snippet.json` — Resolved allergy (Read code)

---

## Source URLs

- Design guidance: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Allergies-Guidance?version=current
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Allergy-examples?version=current
- Profile: https://simplifier.net/guide/gp-connect-access-record-structured/Home/FHIR-Assets/Profiles?version=current
- Release notes (🔄 v1.6.2 items — category rule clarification, security labelling): https://simplifier.net/guide/gp-connect-access-record-structured/Home/Introduction/Release-notes?version=1.6.2

