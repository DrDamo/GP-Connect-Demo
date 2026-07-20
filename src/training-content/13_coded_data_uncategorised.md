# GP Connect Access Record: Structured — Coded / Uncategorised Data

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Uncategorised-data-guidance  
**FHIR Profile:** `CareConnect-GPC-Observation-1`

---

## What Is Uncategorised Data?

**Categorised data** is information explicitly identified by type when recorded (e.g., allergy, immunisation, medication, problem).

**Uncategorised data** is clinical information entered **without an explicit type label** — typically combinations of clinical codes, values, qualifiers and text.

Examples:
- Resting pulse code + value `72 bpm`
- Sore throat code only
- Blood pressure readings
- Comment notes (free text)
- Inbound referrals

---

## What Goes Into Uncategorised Data

| Included | Excluded |
|---------|----------|
| Data not fitting any other defined clinical area | Free text entered without clinical code (returned **only** in the Consultation `Observation`, coded SNOMED 37331000000100 "Comment note" — see Comment Notes section below) |
| Inbound referrals | Items captured as any other category (allergies, medications, etc.) |
| Blood pressure readings | Test requests |

The definitive source scope is just two bullets: "data items in the patient record that do not fit into one of the existing or planned clinical areas defined by GP Connect" and "inbound referrals" (GP Connect referral resource covers outbound referrals only). Free-text comment notes are explicitly **not** uncategorised data. *(Source: Home/Design/Uncategorised-data-guidance, "Uncategorised data definition")*

> **Unverified — not confirmed in the fetched Uncategorised-data-guidance page:** "Immunisation consent/dissent (if included via `includeStatus`)" was previously listed here as included but no mention of `includeStatus`, consent, or dissent appears on that page. See conflicts log.

---

## Request Parameters

```json
{
  "name": "includeUncategorisedData",
  "part": [
    { "name": "uncategorisedDataSearchPeriod", "valuePeriod": { "start": "2020-01-01", "end": "2020-12-31" } }
  ]
}
```

Search is based on `Observation.effectiveTime` date.

---

## Observation Profile — Key Elements

| Element | Description |
|---------|-------------|
| `id` | Unique business identifier |
| `status` | `final` |
| `code` | SNOMED CT clinical code |
| `subject` | Reference to Patient |
| `effectiveDateTime` / `effectivePeriod` | When observation was recorded |
| `issued` | When filed into the record |
| `performer` | Who recorded it |
| `value[x]` | Single value (see below) |
| `component` | Multiple values or blood pressure components |
| `comment` | Qualifiers as text + free text notes |
| `related` | Hierarchical relationships (`has-member`, `derived-from`) |

---

## Qualifiers

Each provider system supports a different set of qualifiers, but three are common across all provider systems: **laterality** (e.g., fracture of the left femur), **severity** (e.g., severe asthmatic attack), **episodicity** (e.g., patient's first episode of an asthmatic attack).

The provider system translates all qualifiers into human-readable text and **concatenates them with the text entered by the recorder, placing the qualifiers first**, into `Observation.comment`:

```
"Laterality: Left | Severity: Severe | Episodicity: First episode"
```

*(Source: Home/Design/Uncategorised-data-guidance, "Qualifiers")*

---

## Values

### Single Value
```json
{
  "valueQuantity": {
    "value": 156,
    "unit": "centimeter",
    "system": "http://unitsofmeasure.org",
    "code": "cm"
  }
}
```

### Multiple Values (using component)
Used when a single code describes the overall item and each value has its own sub-code. Also mandatory for blood pressure.

```json
{
  "component": [
    {
      "code": { "coding": [{ "code": "72313002", "display": "Systolic arterial pressure" }] },
      "valueQuantity": { "value": 135, "unit": "mm[Hg]" }
    },
    {
      "code": { "coding": [{ "code": "1091811000000102", "display": "Diastolic arterial pressure" }] },
      "valueQuantity": { "value": 85, "unit": "mm[Hg]" }
    }
  ]
}
```

---

## Hierarchical Uncategorised Data

Where several items are related hierarchically (parent-child), each is a separate Observation, linked via `related`:

- **Parent:** `Observation.related.type = has-member`
- **Children:** `Observation.related.type = derived-from`

All items are directly referenced in any linked consultation/problem — the hierarchy is available if consumers want to reconstruct it, but can also be flattened.

---

## Blood Pressure Representation

All blood pressures in GP Connect are exported as **triples** using this structure:

```
Panel code (Observation)
  ├── Systolic (component)
  └── Diastolic (component)
```

### Panel and Component Codes

| Panel | Systolic | Diastolic |
|-------|----------|-----------|
| `163020007` On examination blood pressure | `72313002` Systolic arterial pressure | `1091811000000102` Diastolic arterial pressure |
| `386534000` Arterial blood pressure | `271649006` Systolic blood pressure | `271650006` Diastolic blood pressure |
| `75367002` Blood pressure | — | — |

Where only one component is recorded, the other MUST use a `dataAbsentReason` code.

Units MUST always be `mm[Hg]`.

**Readings that don't match a defined triple:** if a blood pressure reading isn't covered by any panel/systolic/diastolic combination above and isn't recorded as a triple in the source system, it MUST be exported as two individual `Observation`s (no panel code), linked to each other via `related.type = has-member`. *(Source: Home/Design/Uncategorised-data-guidance, "Blood pressure readings with no defined triples")*

See `fhir_examples/uncategorised_blood_pressure_snippet.json`

---

## Comment Notes (Free Text)

> **Not uncategorised data.** Per the "Uncategorised data definition" (see table above), free text entered in a consultation without an associated clinical code is explicitly **excluded** from uncategorised data. It is returned only as part of the **Consultation** `Observation`.

Where free text is entered in a consultation without a clinical code:
- SNOMED code: `37331000000100` ("Comment note")
- Returned in an `Observation` that is part of the consultation structure, not in the Uncategorised data List

---

## Inbound Referrals

Inbound referrals returned as Observation resources:
- Referrer details in `performer` **where known** — the `performer` element MAY be absent, e.g. if the referrer was not recorded
- Additional detail in `component` elements: `Component.code.text` populated with the data label, `Component.value` populated with the corresponding data
- Self-referrals: `"Self referral"` in `comment`
- Linked documents in `DocumentReference` with reference back to the Observation

---

## List Returned for Uncategorised Data

| List SNOMED Code | Title |
|-----------------|-------|
| `826501000000100` | Miscellaneous record → displayed as "Uncategorised data" |

---

## FHIR Examples

See `fhir_examples/`:
- `uncategorised_data_example_request.json`
- `uncategorised_blood_pressure_snippet.json`
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Uncategorised-data-examples?version=current

