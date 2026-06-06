# GP Connect Access Record: Structured — API Calls & Responses

**Sources:**  
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/Retrieve-a-patient-s-structured-record  
- https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir

---

## API Technology

- **Type:** Synchronous REST-like FHIR API (uses a FHIR Operation, not resource-based REST)
- **FHIR version:** STU3
- **Transport:** HTTPS via Spine Secure Proxy (SSP)
- **Security:** TLS Mutual Authentication (TLS MA) on both legs (consumer→SSP, SSP→provider)
- **Network:** Health and Social Care Network (HSCN) only — not currently internet-accessible

---

## The FHIR Operation

GP Connect ARS uses a **FHIR Operation** (`$gpc.getstructuredrecord`) rather than a resource-based GET. The consumer POSTs a `Parameters` resource to the provider endpoint.

This approach was chosen for **clinical safety** — the provider constructs a complete response containing all clinically related information, reducing the risk of partial or unsafe data retrieval.

### Endpoint Pattern

```
POST https://{provider-endpoint}/Patient/$gpc.getstructuredrecord
```

The endpoint is discovered via the Spine Directory Service (SDS).

### HTTP Headers Required

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/fhir+json` |
| `Accept` | `application/fhir+json` |
| `Ssp-TraceID` | Consumer's UUID for this request |
| `Ssp-From` | Consumer ASID |
| `Ssp-To` | Provider ASID |
| `Ssp-InteractionID` | `urn:nhs:names:services:gpconnect:fhir:operation:gpc.getstructuredrecord-1` |
| `Authorization` | JWT Bearer token |

---

## Request Structure (Parameters Resource)

The request body is a FHIR `Parameters` resource containing:

1. **`patientNHSNumber`** — the patient's NHS number (mandatory)
2. **Clinical area parameters** — one or more per clinical area required

### Minimal Request Example

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "patientNHSNumber",
      "valueIdentifier": {
        "system": "https://fhir.nhs.uk/Id/nhs-number",
        "value": "9999999999"
      }
    },
    {
      "name": "includeAllergies",
      "part": [
        {
          "name": "includeResolvedAllergies",
          "valueBoolean": true
        }
      ]
    }
  ]
}
```

### Full Multi-Area Request Example

See `fhir_examples/multi_area_request_example.json` for a request covering all clinical areas.

---

## Clinical Area Parameters Reference

### Allergies
```json
{
  "name": "includeAllergies",
  "part": [
    { "name": "includeResolvedAllergies", "valueBoolean": true }
  ]
}
```

### Medications
```json
{
  "name": "includeMedication",
  "part": [
    { "name": "medicationSearchFromDate", "valueDate": "2020-01-01" },
    { "name": "includePrescriptionIssues", "valueBoolean": true }
  ]
}
```
- `medicationSearchFromDate` — returns all medications active on or after this date
- `includePrescriptionIssues` — default `true`; set to `false` to exclude MedicationRequest (intent=order)

### Consultations
```json
{
  "name": "includeConsultations",
  "part": [
    { "name": "consultationSearchPeriod", "valuePeriod": { "start": "2020-01-01", "end": "2020-12-31" } },
    { "name": "includeNumberOfMostRecent", "valueInteger": 3 }
  ]
}
```

### Problems
```json
{
  "name": "includeProblems",
  "part": [
    { "name": "filterStatus", "valueCode": "active" }
  ]
}
```
- `filterStatus` values: `active`, `inactive`

### Immunisations
```json
{
  "name": "includeImmunisations",
  "part": [
    { "name": "includeNotGiven", "valueBoolean": false },
    { "name": "includeStatus", "valueBoolean": true }
  ]
}
```

### Investigations
```json
{
  "name": "includeInvestigations",
  "part": [
    { "name": "investigationSearchPeriod", "valuePeriod": { "start": "2020-01-01", "end": "2020-12-31" } }
  ]
}
```

### Referrals
```json
{
  "name": "includeReferrals",
  "part": [
    { "name": "referralSearchPeriod", "valuePeriod": { "start": "2019-01-25", "end": "2019-06-25" } }
  ]
}
```

### Diary Entries
```json
{
  "name": "includeDiaryEntries",
  "part": [
    { "name": "diaryEntriesSearchDate", "valueDate": "2023-12-31" }
  ]
}
```
- Returns all diary entries due **on or before** this date. Active entries past their date are always included.

### Uncategorised Data
```json
{
  "name": "includeUncategorisedData",
  "part": [
    { "name": "uncategorisedDataSearchPeriod", "valuePeriod": { "start": "2020-01-01", "end": "2020-12-31" } }
  ]
}
```

---

## Response Structure

### HTTP Status

| Status | Meaning |
|--------|---------|
| `200 OK` | Successful retrieval |
| `400 Bad Request` | Invalid parameters |
| `403 Forbidden` | Access denied / data sharing not agreed |
| `404 Not Found` | Patient not found |
| `422 Unprocessable Entity` | Business rule violation |
| `500 Internal Server Error` | Provider system error |

### Response Bundle

A successful response is a **FHIR Bundle** (`type: collection`) conforming to `GPConnect-StructuredRecord-Bundle-1`.

#### Mandatory Resources in Every Response

| Resource | Purpose |
|----------|---------|
| `Patient` | The patient matching the NHS Number in the request |
| `Organization` (registered GP practice) | Referenced from `Patient.generalPractitioner` |
| `Organization` (serving org, if different) | Referenced from `Patient.managingOrganization` |
| `Practitioner` (usual GP, if they have one) | Referenced from `Patient.generalPractitioner` |
| `PractitionerRole` | Usual GP's role |

#### Clinical Resources (per clinical area requested)

Each clinical area returns:
1. A **primary List** identifying all items returned for that area
2. The **clinical resources** themselves (e.g., AllergyIntolerance, Medication, etc.)
3. For Consultations and Problems: additional **secondary Lists** linking related items
4. **Warning codes** where items were excluded

### Bundle Order

Provider systems SHOULD return resources in a consistent order:
1. Patient
2. Organizations
3. Practitioners / PractitionerRoles
4. Lists (primary, then secondary)
5. Clinical resources

> ⚠️ **Consumer systems MUST NOT rely on the order of resources in the Bundle.**

---

## JWT Authorisation

With each request, a JWT Bearer token must be included containing:

```json
{
  "iss": "https://consumer-system.example.com",
  "sub": "user-id",
  "aud": "https://provider-endpoint/Patient/$gpc.getstructuredrecord",
  "exp": 1672531200,
  "iat": 1672527600,
  "reason_for_request": "directcare",
  "requested_scope": "patient/*.read",
  "requesting_device": { ... },
  "requesting_organization": { "odsCode": "A12345", ... },
  "requesting_practitioner": { "id": "G13579135", ... }
}
```

The JWT must include:
- User details (including SDS user/role IDs if smartcards in use)
- Consumer system details
- Consumer organisation details (ODS code)
- `reason_for_request: directcare`

---

## OperationDefinition

The full operation definition: `GPConnect-GetStructuredRecord-Operation-1`

```
https://fhir.nhs.uk/STU3/OperationDefinition/GPConnect-GetStructuredRecord-Operation-1
```

---

## Capability Statement (FHIR Metadata)

To retrieve the provider's FHIR capability statement:

```
GET https://{provider-endpoint}/metadata
```

---

## Date Handling in Searches

### Partial Dates
- **Year only** (e.g., `2020`): treated as interval from `2020-01-01` to `2020-12-31`
- **Year + month** (e.g., `2020-06`): treated as interval from `2020-06-01` to `2020-06-30`

### Unknown Dates
Clinical information where an effective date is unknown or not recorded is **returned alongside** date-filtered results (not excluded).

### Medication Search Date Logic
- An **acute** medication is active only on its `effective.start`
- A **repeat** medication is active from `effective.start` onwards (no end = on-going)
- All **prescribed elsewhere** medications are always returned regardless of the search date

---

## Testing Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Internet-facing Demonstrator | https://orange.testlab.nhs.uk/ | Development and initial testing |
| Integration (INT) | See NHS Digital docs | End-to-end NHS system testing |

### Testing Streams

1. **Clinical testing** — ensure safe interoperability of information displayed/processed in consuming system. NHS England provides test patient records and hazard mitigation guidance.
2. **Technical testing** — assure messaging capability via Spine. See the SCAL (Supplier Conformance Assessment List).

---

## FHIR Assets (Profiles, Extensions, Value Sets)

All GP Connect profiles are hosted on Simplifier.net:

- **Profiles:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/FHIR-Assets/Profiles
- **Extensions:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/FHIR-Assets/Extensions
- **Value sets:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/FHIR-Assets/Value-sets
- **Code systems:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/FHIR-Assets/Code-systems

### Common Code Systems

| Name | System URL |
|------|-----------|
| SNOMED CT | `http://snomed.info/sct` |
| Read codes V2 | `http://read.info/readv2` |
| Read codes CTV3 | `http://read.info/ctv3` |
| EMIS drug codes | `https://fhir.hl7.org.uk/Id/emis-drug-codes` |
| Multilex drug codes | `https://fhir.hl7.org.uk/Id/multilex-drug-codes` |
| dm+d | `https://dmd.nhs.uk` |

### Common Identifier Systems

| Name | System URL |
|------|-----------|
| NHS Number | `https://fhir.nhs.uk/Id/nhs-number` |
| ODS organisation code | `https://fhir.nhs.uk/Id/ods-organization-code` |
| ODS site code | `https://fhir.nhs.uk/Id/ods-site-code` |
| SDS user ID | `https://fhir.nhs.uk/Id/sds-user-id` |
| SDS role profile ID | `https://fhir.nhs.uk/Id/sds-role-profile-id` |
| GMC number | `https://fhir.hl7.org.uk/Id/gmc-number` |
| GMP number | `https://fhir.hl7.org.uk/Id/gmp-number` |
| e-RS UBRN | `https://fhir.nhs.uk/Id/UBRN` |

