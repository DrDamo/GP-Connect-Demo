# GP Connect Access Record: Structured — Immunisations

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Immunisations-Guidance  
**FHIR Profile:** `CareConnect-GPC-Immunization-1`

---

## What Is Immunisation Data in GP Connect?

GP Connect returns the **event** of a vaccination administration, or an **intention** to vaccinate that did not occur. This may be:
- A contemporaneous record by the clinician administering
- A record reported by the patient/carer/guardian
- Part of a scheduled programme (childhood, influenza, travel, occupational)

---

## Request Parameters

```json
{
  "name": "includeImmunisations",
  "part": [
    { "name": "includeNotGiven", "valueBoolean": false },
    { "name": "includeStatus", "valueBoolean": true }
  ]
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `includeNotGiven` | `false` | Include immunisations where `notGiven = true` |
| `includeStatus` | `true` | Include Observation resources for consent/dissent/additional status info |

---

## Vaccination Procedure Code

GP systems often record the **type** of vaccine rather than the specific product. Therefore:
- `extension[vaccinationProcedure]` (procedure code) is **mandatory**
- `vaccineCode` (the actual vaccine product dm+d code) is returned if available; otherwise uses a `nullFlavor` code

---

## Immunizations Not Given

Where a vaccination was intended but not administered:
- `notGiven` MUST be `true`
- `extension[vaccinationProcedure]` MUST be the SNOMED CT 'not done' situation code
- `explanation.reasonNotGiven` SHOULD include the reason

> ⚠️ A "not given" record only relates to that specific intended event on that day — it does NOT state the vaccination has never been given.

### Consumer Rule
Consumer systems MUST ensure not-given data remains **clearly distinct** from given vaccinations.

---

## Additional Status Information (`includeStatus`)

GP systems may record additional coded information alongside vaccinations:
- Consent, dissent, invitations, immunisation schedules

Where `includeStatus = true`:
- These are returned as `Observation` (uncategorised) resources
- They are included in the immunisations `List` (not uncategorised data list)
- They MUST be excluded from uncategorised data responses

> ⚠️ GP systems differ in what they categorise as immunisation status data — the same code may appear in immunisations from one provider and uncategorised data from another.

---

## Immunization Resource — Key Elements

| Element | Optionality | Notes |
|---------|-------------|-------|
| `id` | Mandatory | Unique business identifier |
| `extension[vaccinationProcedure]` | Mandatory | SNOMED CT vaccination procedure code |
| `notGiven` | Mandatory | `false` = given; `true` = not given |
| `vaccineCode` | Mandatory | dm+d product code or nullFlavor |
| `patient` | Mandatory | Reference to Patient |
| `date` | Required | Date of vaccination |
| `primarySource` | Required | Whether record is primary or secondary source |
| `site` | Optional | Body site administered |
| `route` | Optional | Administration route |
| `doseQuantity` | Optional | Dose amount |
| `practitioner` | Required | Who administered |
| `location` | Optional | Where administered |
| `lotNumber` | Optional | Batch number |
| `expirationDate` | Optional | Vaccine expiry |
| `explanation.reasonGiven` | Optional | Why given |
| `explanation.reasonNotGiven` | Required if notGiven=true | Why not given |
| `note` | Required | Any additional info not fitting other elements |

---

## Reactions to Vaccines

Reactions to vaccines are **not included** in the Immunization resource. They are returned via `AllergyIntolerance` resources when allergies are requested.

---

## Immunisation Schedules and Recalls

Planned immunisation schedules are **out of scope**. Due immunisations recorded as recalls may be retrieved via **Diary Entries**.

---

## Ineffective Vaccinations

GP systems do not have a standard way to flag ineffective vaccinations. All immunisation records are returned as **counting towards immunity** (`wasNotGiven` = false, or as given).

---

## List Returned for Immunisations

| List SNOMED Code | Title |
|-----------------|-------|
| `1102181000000102` | Immunisations |

---

## FHIR Examples

See `fhir_examples/`:
- `immunisation_example_request.json`
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Immunisation-examples?version=current

