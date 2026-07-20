# 16. CodeableConcept — GP Connect Implementation

**Source:** https://simplifier.net/guide/gpconnect-data-model/Home/Build/Codeable-Concept?version=current

---

## Overview

The `CodeableConcept` is the most important data type in GP Connect FHIR STU3. It carries clinical codes (SNOMED CT, READ2, CTV3, dm+d) along with the original text selected by the clinician.

NHS Digital extends the base CodeableConcept with `Extension-coding-sctdescid` to carry the SNOMED CT description ID — crucial because a description ID can carry different meaning to the concept ID (different wording).

---

## Structure

```xml
<code>
  <coding>
    <extension url="https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-coding-sctdescid">
      <extension url="descriptionId">
        <valueId value="" />          <!-- SNOMED description ID -->
      </extension>
      <extension url="descriptionDisplay">
        <valueString value="" />      <!-- term text for this description ID -->
      </extension>
    </extension>
    <system value="" />               <!-- terminology system URI -->
    <code value="" />                 <!-- concept/code ID -->
    <display value="" />              <!-- preferred term for concept -->
    <version value="" />              <!-- NOT used for SNOMED CT -->
    <userSelected value="" />         <!-- true if user selected this code -->
  </coding>
  <text value="" />                   <!-- original term text shown to user -->
</code>
```

---

## Field Population Rules

| Level | Field | Rule |
|---|---|---|
| coding (SNOMED CT) | system | `"http://snomed.info/sct"` |
| coding (SNOMED CT) | code | SNOMED CT concept ID |
| coding (SNOMED CT) | display | Current preferred term per NHS Realm Language Reference Sets |
| coding (SNOMED CT) | descriptionId | SNOMED description ID recorded. Only if available. |
| coding (SNOMED CT) | descriptionDisplay | Text of description ID — only if different from `display` |
| coding (SNOMED CT) | userSelected | TRUE if user selected this code; MUST NOT be populated if false — for consuming systems, absence of this element indicates FALSE |
| coding (other) | system | URI identifying the code system |
| coding (other) | code | The clinical code |
| coding (other) | display | Longest variant text for current preferred term |
| coding (other) | descriptionId | DO NOT populate (SNOMED only) |
| coding (other) | userSelected | TRUE if user selected; OMIT if false |
| text | | Original text selected/entered by user. Only if no user-selected translation set with display/descriptionDisplay. Populate when displayed text ≠ code term. |

---

## Sending dm+d Codes

dm+d codes from TRUD XML resources do not contain description IDs — do not populate `descriptionId`. Where available, include it.

```json
{
  "code": {
    "coding": [{
      "code": "323509004",
      "display": "Amoxicillin 250mg capsules",
      "system": "http://snomed.info/sct",
      "userSelected": "true"
    }]
  }
}
```

---

## Sending a SNOMED CT Concept with Preferred Term

```json
{
  "code": {
    "coding": [{
      "extension": [{
        "url": "https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-coding-sctdescid",
        "extension": [{"url": "descriptionId", "valueId": "37436014"}]
      }],
      "code": "22298006",
      "display": "Myocardial infarction",
      "system": "http://snomed.info/sct",
      "userSelected": "true"
    }]
  }
}
```

---

## Sending a Non-Preferred Term (descriptionDisplay required)

When the description ID maps to a synonym rather than the preferred term, populate `descriptionDisplay`:

```json
{
  "code": {
    "coding": [{
      "extension": [{
        "url": "https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-coding-sctdescid",
        "extension": [
          {"url": "descriptionId", "valueId": "37443015"},
          {"url": "descriptionDisplay", "valueString": "Heart attack"}
        ]
      }],
      "code": "22298006",
      "display": "Myocardial infarction",
      "system": "http://snomed.info/sct",
      "userSelected": "true"
    }]
  }
}
```

---

## Description ID: UK Edition vs Non-UK Edition Extensions

The `descriptionId`/`descriptionDisplay` extension is also used to carry local/national extension terms alongside the international SNOMED CT concept and preferred term.

**UK Edition (e.g. an EMIS local namespace description):** the concept code and international preferred term come from SNOMED International, while `descriptionId` and `descriptionDisplay` carry the UK/local-namespace description:

```json
{
  "code": {
    "coding": [{
      "extension": [{
        "url": "https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-coding-sctdescid",
        "extension": [
          {"url": "descriptionId", "valueId": "787121000006116"},
          {"url": "descriptionDisplay", "valueString": "Ideal weight"}
        ]
      }],
      "code": "170804003",
      "display": "Ideal body weight",
      "system": "http://snomed.info/sct"
    }]
  }
}
```

**Non-UK Edition content (e.g. a Canadian extension):** the same pattern applies for concepts drawn from a non-UK national extension — `descriptionId` and `descriptionDisplay` carry the extension's local description alongside the concept `code` and its `display`:

```json
{
  "code": {
    "coding": [{
      "extension": [{
        "url": "https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-coding-sctdescid",
        "extension": [
          {"url": "descriptionId", "valueId": "253790221000087110"},
          {"url": "descriptionDisplay", "valueString": "Use of illicit drugs unknown"}
        ]
      }],
      "code": "186782131000087106",
      "display": "Use of illicit type drug unknown",
      "system": "http://snomed.info/sct"
    }]
  }
}
```

*(Source: Home/Build/Codeable-Concept, description ID extension scenarios)*

---

## Sending a Translation Set (Legacy Code + SNOMED Mapping)

Where a code was originally entered as READ2 or CTV3 and mapped to SNOMED, include multiple `coding` elements — one per system. `userSelected` marks the coding the user actually selected; the mapped/derived coding(s) omit `userSelected` (i.e. they are system-derived, not user-selected):

```json
{
  "code": {
    "coding": [
      {
        "code": "44I4.00",
        "display": "Serum potassium",
        "system": "http://read.info/readv2",
        "userSelected": "true"
      },
      {
        "extension": [{"url": "https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-coding-sctdescid",
          "extension": [{"url": "descriptionId", "valueId": "2573011000000117"}]
        }],
        "system": "http://snomed.info/sct",
        "code": "1000651000000109",
        "display": "Serum potassium level"
      }
    ],
    "text": "Serum potassium"
  }
}
```

---

## Read Code Rules

- All Read Codes represented as full 5 characters
- 4-byte codes preceded by a full-stop: `.6521`
- Trailing full-stops are significant and must be included: `H43..` (not `H43`)
- Upper/lower case is significant — Read Codes are case-sensitive
- Read Code Version 2 term codes: 7-character string = Read Code (5) + Term Code (2), e.g. `7001200`
- NHS Clinical Terms V3 TermID: NOT used in GP Connect ("There are no plans to use the TermID in NHS Clinical Terms Version 3 and thus inclusion of TermId is not permitted")

---

## Degradation

Degradation occurs when a receiving system cannot understand a clinical code. The receiving system associates the item with an appropriate SNOMED degrade code, preserving structure and semantics.

| Degrade type | SNOMED code | Display |
|---|---|---|
| Degraded Drug Allergy | `196461000000101` | Transfer-degraded drug allergy |
| Degraded Non-Drug Allergy | `196471000000108` | Transfer-degraded non-drug allergy |
| Degraded Medication | `196421000000109` | Transfer-degraded medication entry |
| Degraded Plan | `196451000000104` | Transfer-degraded plan |
| Degraded Referral | `196431000000106` | Transfer-degraded referral |
| Degraded Request | `196441000000102` | Transfer-degraded request |
| Other degrade | `196411000000103` | Transfer-degraded record entry |

The appropriate context-specific degrade code must be used (e.g. an allergy degrade within an AllergyIntolerance resource). Where context is unclear, use `196411000000103` (Transfer-degraded record entry). Systems MUST NOT infer a type without clear indication.

**Example (degraded drug allergy):**
```json
{
  "code": {
    "coding": [{"display": "Transfer-degraded drug allergy", "code": "196461000000101", "system": "http://snomed.info/sct"}],
    "text": "Amoxicillin 250mg capsules"
  }
}
```

---

## Original Term Text Rules

### Priority order for deriving original term text:
1. `text`
2. `coding.descriptionDisplay` where `userSelected = TRUE` (or only one coding element)
3. `coding.display` where `userSelected = TRUE` (or only one coding element)

**Storage:** Receiving systems MUST always store the original term text.  
**Display:** Receiving systems MUST always display the original term text to users.  
**Propagation:** Receiving systems MUST always include the original term text when forwarding data.  
**SNOMED storage:** Any receiving system that supports SNOMED CT codes MUST store any SNOMED CT codes associated with the item — including codes from a SNOMED CT release or extension not available on the receiving system. Codes where `userSelected = TRUE` MUST additionally be propagated onwards in any future export/transfer of the data.

---

## Sources

- https://simplifier.net/guide/gpconnect-data-model/Home/Build/Codeable-Concept?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/Design/Clinical-terminologies?version=current
