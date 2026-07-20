# 15. GP Connect Data Model Guide

**Source:** https://simplifier.net/guide/gpconnect-data-model/Home?version=current  
**Status:** Under active development by NHS England

---

## Overview

The GP Connect Data Model guide provides a comprehensive reference for how the GP Connect data model is represented using FHIR STU3. It covers the FHIR profiles, extensions, code systems, value sets, and the CodeableConcept implementation pattern that all GP Connect capabilities rely on.

GP Connect versions 1.x use FHIR STU3. The profiles are a mix of:
- **CareConnect-GPC-** profiles: GP Connect-specific constraints on CareConnect profiles (INTEROPen community)
- **GPConnect-** profiles: GP Connect-only profiles not derived from CareConnect

---

## Capabilities Using This Data Model

The FHIR STU3 representation underpins four GP Connect capabilities:

| Capability | Description | Key FHIR Resources |
|---|---|---|
| Access Record: Structured | Structured query of specific patient record elements | Patient, Encounter, Observation, Procedure, Immunization, DiagnosticReport |
| Access Document | Retrieve patient GP record in document format | DocumentReference, Composition, Binary |
| Appointment Management | Book/modify/cancel GP appointments | Schedule, Slot, Appointment, Organization |
| Update Record | Write specific information back to GP record | Encounter, Observation, Condition, MedicationDispense |

---

## Design Principles

### API Design Principles

**Open API:** GP Connect aligns with NHS England's Open API Policy — significant business functionality must be exposed through open interface definitions.

**Organization-level API:** The GP Connect API is designed at organisation level. Each GP practice has a single FHIR server tied to its ODS code. Consumers must make separate API calls for each organisation they wish to query. This means:
- GP practice branches share the main organisation FHIR server
- SDS stores Organisation FHIR server URLs against ODS codes
- A federation query requires N separate API calls

**Complexity distribution:** GP Connect places complexity on the provider, not the consumer. Where design decisions arise about where to locate logic, the default is to hide it behind the API in provider business logic.

**Core API design rules:**
- FHIR RESTful API principles by default (GET, POST, PUT)
- FHIR operation APIs for 'set piece' scenarios (e.g. `$gpc.getstructuredrecord`)
- Business identifiers (NHS Number) resolve resource logical identity
- Both XML and JSON supported; JSON preferred (30% smaller on wire)
- HTML content uses XHTML per FHIR narrative guidance
- ETags for version-aware updates

**CareConnect alignment:** GP Connect aligns as closely as possible with CareConnect API to maintain wider interoperability.

### Data Model Principles

- GP Connect 1.x uses FHIR STU3 for all API and profile specifications
- Profiles developed by NHS Digital, using CareConnect profiles from INTEROPen where available
- INTEROPen: creates nationally defined HL7 FHIR resources and interaction patterns for England's health and social care

**Profiling conventions:**
- Align to CareConnect profiles where available
- Profiles stored on GitHub and published to `fhir.nhs.uk`
- Major version in profile name (e.g. `gpconnect-patient-1`)
- Major/minor version in `StructureDefinition.version`
- Do not mandate elements unless cardinality applies to all current and future use cases
- Apply **Must Support** flags to key information elements

### Information Governance Principles

- All GP Connect API calls require valid authorisation via JWT Bearer Token
- Spine Security Proxy (SSP) routes and authenticates all requests
- TLS Mutual Authentication (mTLS) required on both legs of the SSP connection
- HSCN connectivity required
- Consumer systems must be registered and assured

### Clinical Terminologies

**Code handling rules:**

| Data origin | What to return |
|---|---|
| Originally entered as SNOMED CT | Return as SNOMED CT. Include DescriptionID (in addition to ConceptID) where available |
| If no suitable SNOMED code exists | Text only MAY be used |
| Originally entered as READ2 or CTV3 | Return in original code system AND also return SNOMED CT equivalent if NHS Digital assured mapping exists |

**Assured mappings:** Available from the NHS Data Migration download. Updated every 6 months; suppliers must update within GPSoC framework timescales.

**Case sensitivity:**
- `system` values are always case-sensitive
- FHIR-defined codes are always case-sensitive and must be used as provided (usually lowercase)

---

## FHIR Profiles

### Active Profiles (ARS-relevant)

| Profile | Used for |
|---|---|
| `CareConnect-GPC-AllergyIntolerance-1` | Allergy and adverse reaction records |
| `CareConnect-GPC-ClinicalImpression-1` | Clinical assessments |
| `CareConnect-GPC-Composition-1` | Document composition |
| `CareConnect-GPC-Condition-1` | Conditions (also base for ProblemHeader) |
| `CareConnect-GPC-DiagnosticReport-1` | Investigation results |
| `CareConnect-GPC-DocumentReference-1` | Document metadata references |
| `CareConnect-GPC-Encounter-1` | Consultation records |
| `CareConnect-Flag-1` | Clinical flags |
| `CareConnect-GPC-Immunization-1` | Immunisation records |
| `CareConnect-GPC-List-1` | List resources for organising query responses |
| `CareConnect-GPC-Location-1` | Practice/site locations |
| `CareConnect-GPC-Medication-1` | Medication resources |
| `CareConnect-GPC-MedicationDispense-1` | Medication dispensing |
| `CareConnect-GPC-MedicationRequest-1` | Prescription plan (intent=plan) and issue (intent=order) |
| `CareConnect-GPC-MedicationStatement-1` | Medication statement/history |
| `CareConnect-GPC-Observation-1` | Observations, test results, uncategorised data |
| `CareConnect-GPC-Organization-1` | Organisation (GP practice) |
| `CareConnect-GPC-Patient-1` | Patient demographics |
| `CareConnect-GPC-Practitioner-1` | Clinician/practitioner |
| `CareConnect-GPC-PractitionerRole-1` | Practitioner role at organisation |
| `CareConnect-GPC-ProblemHeader-Condition-1` | GP problem records |
| `CareConnect-GPC-ProcedureRequest-1` | Diary entries / test requests |
| `CareConnect-GPC-ReferralRequest-1` | Outbound referrals |
| `CareConnect-GPC-Specimen-1` | Specimens for investigations |
| `CareConnect-HealthcareService-1` | Healthcare services |
| `CareConnect-QuestionnaireResponse-1` | Questionnaire responses |
| `GPConnect-Appointment-1` | Appointment bookings |
| `GPConnect-Device-1` | Device records |
| `GPConnect-OperationOutcome-1` | Error and warning messages |
| `GPConnect-Schedule-1` | Appointment schedules |
| `GPConnect-Searchset-Bundle-1` | Search result bundles |
| `GPConnect-Slot-1` | Appointment slots |
| `GPConnect-StructuredRecord-Bundle-1` | ARS response bundle |
| `GPConnect-Task-1` | Task resources |
| `Binary` | Binary document content |

**Retired:** `CareConnect-GPC-Appointment-1`

---

## Extensions

Key extensions used in GP Connect (full list at `https://fhir.nhs.uk/STU3/StructureDefinition/`):

| Extension | Purpose |
|---|---|
| `Extension-CareConnect-GPC-ActualProblem-1` | Links problem header to the actual clinical item representing the problem |
| `Extension-CareConnect-GPC-AllergyCertainty-1` | Certainty of an allergy |
| `Extension-CareConnect-GPC-AllergyIntoleranceEnd-1` | End date/reason for resolved allergy |
| `Extension-CareConnect-GPC-ConditionEpisode-1` | Episodicity of a problem (first, new, review, etc.) |
| `Extension-CareConnect-GPC-ConditionRelationship-1` | Links problems to related clinical content |
| `Extension-CareConnect-GPC-DateRecorded-1` | Date a record entry was created |
| `Extension-CareConnect-GPC-Evidence-1` | Evidence supporting an allergy |
| `Extension-CareConnect-GPC-ListWarningCode-1` | Warning codes on List resources (confidential-items, data-in-transit, data-awaiting-filing) |
| `Extension-CareConnect-GPC-MedicationChangeSummary-1` | Summary of medication change |
| `Extension-CareConnect-GPC-MedicationRepeatInformation-1` | Repeat prescription details (allowed/issued count, expiry) |
| `Extension-CareConnect-GPC-MedicationStatusReason-1` | Reason for medication status change |
| `Extension-CareConnect-GPC-MedicationSupplyType-1` | Supply type for medication |
| `Extension-CareConnect-GPC-PrescribingAgency-1` | Agency responsible for prescribing |
| `Extension-CareConnect-GPC-PrescriptionType-1` | Type of prescription (acute/repeat/repeat dispensing) |
| `Extension-CareConnect-GPC-ProbabilityOfRecurrence-1` | Probability of allergy recurrence |
| `Extension-CareConnect-GPC-RegistrationDetails-1` | Patient registration details |

---

## Code Systems

| Code System | Purpose |
|---|---|
| `GPConnect-SecondaryListValues-1` | Codes for secondary list types (consultations/problems sub-lists) |
| `GPConnect-DeliveryChannel-1` | Appointment delivery channel (e.g. in-person, telephone, video) |
| `GPConnect-OrganisationType-1` | Organisation type codes |
| `GPConnect-ParticipantType-1` | Appointment participant type codes |
| `GPConnect-ReferralUrgency-1` | Referral urgency codes |

---

## Value Sets

| Value Set | Purpose |
|---|---|
| `GPConnect-DeliveryChannel-1` | Appointment delivery channels |
| `GPConnect-OrganisationType-1` | Organisation types |
| `GPConnect-ParticipantType-1` | Participant types |
| `GPConnect-PractitionerRole-1` | Practitioner role codes |
| `GPConnect-ReferralUrgency-1` | Referral urgency levels |
| `GPConnect-RequestPriority-1` | Request priority codes |

---

## Operation Definitions

The guide's FHIR Assets section lists three `OperationDefinition` resources (confirmed via the guide's FHIR-Assets/OperationDefinitions page):

| OperationDefinition | Canonical operation name | Purpose |
|---|---|---|
| `GPConnect-RegisterPatient-Operation-1` | `gpc.registerpatient` | Registers a patient at a GP practice (Update Record capability) |
| `GPConnect-GetStructuredRecord-Operation-1` | `gpc.getstructuredrecord` | Retrieves the structured patient record (Access Record: Structured capability) |
| `GPConnect-MigrateStructuredRecord-Operation` | `gpc.migratestructuredrecord` | Retrieves the structured patient record for GP2GP practice-to-practice record migration |

---

## General FHIR Resource Population Requirements

### Must Support

Where a Must Support flag is on an element, both providers and consumers SHALL populate it if data is available — regardless of cardinality (0..1 or 0..*). Must Support on a parent element implies Must Support on all sub-elements.

### Population of optional elements

GP Connect expects providers and consumers to populate all elements where data is available, even if cardinality is optional, to give patients the best possible care.

### Bundle.entry.fullUrl

| Bundle type | Provider | Consumer |
|---|---|---|
| `GPConnect-StructuredRecord-Bundle-1` | SHOULD NOT populate | MUST NOT use |
| `GPConnect-Searchset-Bundle-1` | SHOULD populate | MUST use |

### NOPAT Security Label

Resources containing information not to be disclosed to the patient MAY (for retrieve) / MUST (for migrate) carry a `NOPAT` security label in `Meta.security`:

```json
{
  "meta": {
    "security": [{
      "system": "http://hl7.org/fhir/v3/ActCode",
      "code": "NOPAT",
      "display": "no disclosure to patient, family or caregivers without attending provider's authorization"
    }]
  }
}
```

DocumentReferences for documents not to be disclosed to patients must also use `DocumentReference.securityLabel` with `NOPAT`. This label does not apply to: `CareConnect-GPC-List-1` (consultation lists), `GPConnect-StructuredRecord-Bundle-1`, or `Binary`.

### Address population

Use elements: `line`, `city`, `district` (county), `postalCode`, `country`. Do not populate `text`. Populate `use` for patient/contact addresses.

### ContactPoint population

Populate `value` (phone number/email), `system`, and `use` (for patient/contact telecom).

---

## Sources

- https://simplifier.net/guide/gpconnect-data-model/Home?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/Introduction/Introduction?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/Design/API-design-principles?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/Design/Data-model-principles?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/Design/Clinical-terminologies?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/FHIR-Assets/Profiles?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/FHIR-Assets/Extensions.page.md?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/FHIR-Assets/CodeSystems.page.md?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/FHIR-Assets/ValueSets.page.md?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/FHIR-Assets/OperationDefinitions.page.md?version=current
- https://simplifier.net/guide/gpconnect-data-model/Home/Build/FHIR-resources?version=current
