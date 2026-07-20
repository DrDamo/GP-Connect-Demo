# GP Connect Access Record: Structured — Investigations

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Investigations-guidance  
**FHIR Profiles:** `CareConnect-GPC-DiagnosticReport-1`, `CareConnect-GPC-Observation-1`, `CareConnect-GPC-Specimen-1`, `CareConnect-GPC-ProcedureRequest-1`

---

## Scope

Investigations covers **EDIFACT pathology results** received from laboratories. This includes:
- Test results received via EDIFACT message
- Results filed into the patient record

**NOT in scope:**
- Manually entered coded results (returned as Uncategorised Data)
- Test results as documents or images
- Test requests themselves (only the report)
- Original test report document
- Blood pressure, height, weight (Uncategorised Data)

---

## Request Parameters

```json
{
  "name": "includeInvestigations",
  "part": [
    { "name": "investigationSearchPeriod", "valuePeriod": { "start": "2020-01-01", "end": "2020-12-31" } }
  ]
}
```

Search is based on `DiagnosticReport.issued` date.

---

## Investigation Report Structure (Logical Model)

```
DiagnosticReport (Test Report)
    ├── ProcedureRequest (Test Request Summary — summary only)
    ├── Specimen (Specimen details)
    ├── Observation [Filing Comments] (when/who filed; any filing comments)
    ├── Observation [Test Group Header] (e.g., "Full Blood Count")
    │       └── Observation [Test Result] (e.g., Haemoglobin = 145 g/L)
    └── Observation [Test Group Header] (e.g., "Liver Function Tests")
            └── Observation [Test Result] (each analyte)
```

---

## FHIR Resources Used

| Resource | Entity Modelled |
|----------|----------------|
| `DiagnosticReport` | The test report / overall result summary |
| `ProcedureRequest` | Summary of the test request |
| `Specimen` | Details of specimen collected |
| `Observation` (Test Group Header) | A panel or battery of tests |
| `Observation` (Test Result) | An individual test analyte result |
| `Observation` (Filing Comments) | Clinician's comments when filing the report |

---

## DiagnosticReport — Key Elements

| Element | Description |
|---------|-------------|
| `id` | Unique identifier |
| `status` | Report status (e.g., `final`, `amended`) |
| `code` | Type of report |
| `subject` | Reference to Patient |
| `issued` | When report was issued by laboratory |
| `performer` | Laboratory / requesting org |
| `result` | References to Observation resources |
| `specimen` | Reference to Specimen |
| `basedOn` | Reference to ProcedureRequest |

---

## Observation — Observation Profiles

Three distinct observation profiles (all using `CareConnect-GPC-Observation-1`):

### Test Group Header
- `code` = SNOMED code for the test panel (e.g., `26604007` Full blood count)
- `related` element (type = `has-member`) with `target` referencing child Test Result observations
  - STU3 does **not** have a top-level `Observation.hasMember` element — that is an R4 concept. The STU3 `CareConnect-GPC-Observation-1` profile links a Test Group Header to its Test Results via the `related` backbone element, with `related.type` = `has-member` and `related.target` = `Reference(Observation)` (confirmed in the GP Connect ARS Investigation examples: `"related": [{ "type": "has-member", "target": { "reference": "Observation/..." } }]`)

### Test Result
- `code` = SNOMED code for specific analyte
- `value[x]` = Result value with units
- `referenceRange` = Lab reference range
- `interpretation` = Abnormal flag

### Filing Comments
- `code` = `37331000000100` (Comment note)
- `effectiveDateTime` = When filed
- `note` = Comments made by clinician when filing
- Always present for filed reports

---

## EDIFACT Text Preservation

EDIFACT messages contain heavily formatted text. Line separators (`\n`) MUST be used to preserve the original message structure.

---

## Investigations and Problems

If a test observation has been made a problem, the DiagnosticReport MUST be linked to the problem via `extension[relatedClinicalContent]` (not the individual Observation).

---

## List Returned for Investigations

| List SNOMED Code | Title |
|-----------------|-------|
| `887191000000108` | Investigations and results |

---

## FHIR Examples

See `fhir_examples/`:
- `investigation_example_request.json`
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Investigation-examples?version=current

