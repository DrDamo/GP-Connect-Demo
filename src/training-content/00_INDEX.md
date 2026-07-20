# GP Connect Access Record: Structured — Implementation Resource Index

> **Purpose:** A curated collection of resources for implementing GP Connect Access Record: Structured (ARS).  
> **Compiled:** May 2026 | **Standard:** FHIR STU3 | **Specification Version:** 1.5.0-beta / 1.6.2

## Version Scope of This Pack

**v1.5.0 is the current working version in production** (per the [NHS Digital API catalogue](https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir)) and is the version the majority of live GP Connect consumers integrate against today. This pack therefore documents **v1.5.0 behaviour as the baseline** throughout.

NHS England's own direction of travel is towards **v1.6.2** of the Implementation Guide (currently in draft). Where this audit identified a specific, confirmed difference in v1.6.2 — a new parameter, a removed parameter, new security labelling, etc. — it is called out inline with a **🔄 Coming in v1.6.2** marker, so a v1.5.0-consumer build isn't required to implement it yet, but a team planning ahead knows it's coming. If you're building against 1.5.0, anything not marked with that flag is safe to treat as current behaviour.

---

## About This Resource Pack

This resource pack collects, organises and summarises all publicly available guidance for implementing **GP Connect Access Record: Structured (ARS)** — the NHS England interoperability standard for retrieving structured, coded, machine-readable patient data from GP practice systems.

The documentation is organised into topic-specific files aligned with the clinical areas supported by the standard.

---

## Files in This Pack

| File | Topic |
|------|-------|
| `01_basics_of_the_service.md` | Basics — what GP Connect ARS is, who it's for, how it works |
| `02_api_calls_and_responses.md` | API structure, request/response format, FHIR operations |
| `03_assurance_process.md` | Consumer assurance, onboarding, clinical safety |
| `04_allergies.md` | Allergies & Intolerances |
| `05_consultations.md` | Consultations |
| `06_documents.md` | Documents |
| `07_diary_entries.md` | Diary Entries / Recalls |
| `08_immunisations.md` | Immunisations / Vaccinations |
| `09_medications.md` | Medications & Medical Devices |
| `10_investigations.md` | Investigations (Lab Results) |
| `11_problems.md` | Problems |
| `12_referrals.md` | Referrals (Outbound) |
| `13_coded_data_uncategorised.md` | Coded / Uncategorised Data |
| `14_lists_and_references.md` | Lists, Warning Codes & FHIR References |
| `15_data_model_guide.md` | GP Connect Data Model Guide — design principles, all profiles, extensions, code systems, value sets |
| `16_codeable_concept.md` | CodeableConcept implementation — SNOMED/READ2/CTV3 coding, degradation, original term text rules |
| `17_linkages_search_configuration.md` | Linkages between FHIR resources, search criteria per clinical area, site configuration, Using Lists |
| `18_github_repositories.md` | GitHub repos: OpenAPI spec, HAPI validation server, FHIR test scripts, NHS England FHIR R4 IG |

## FHIR Example Files (`fhir_examples/` folder)

| File | Description |
|------|-------------|
| `allergy_example1_request.json` | Parameters request — allergies incl. resolved |
| `allergy_example1_response_bundle.json` | Bundle response — active + resolved allergies |
| `allergy_example2_request_no_resolved.json` | Parameters request — active allergies only |
| `allergy_nka_resource_snippet.json` | AllergyIntolerance — No Known Allergy (NKA) |
| `allergy_empty_list_snippet.json` | Empty List — no allergies recorded |
| `allergy_resolved_snomed_snippet.json` | Resolved allergy — SNOMED coded |
| `allergy_resolved_readcode_snippet.json` | Resolved allergy — Read coded |
| `medication_example1_request.json` | Parameters request — medications + issues |
| `medication_statement_active_repeat_snippet.json` | MedicationStatement — active repeat |
| `medication_request_intent_plan_snippet.json` | MedicationRequest (intent=plan) — authorisation |
| `medication_request_intent_order_snippet.json` | MedicationRequest (intent=order) — issue |
| `medication_dosage_change_example.json` | Bundle — dosage change with priorPrescription link |
| `immunisation_example_request.json` | Parameters request — immunisations |
| `investigation_example_request.json` | Parameters request — investigations with date filter |
| `referral_example_request.json` | Parameters request — referrals with date range |
| `diary_entry_example_request.json` | Parameters request — diary entries with date |
| `consultation_example_request.json` | Parameters request — consultations with date range |
| `problems_example_request.json` | Parameters request — active problems |
| `uncategorised_data_example_request.json` | Parameters request — uncategorised data |
| `multi_area_request_example.json` | Parameters request — all clinical areas combined |
| `consultation_list_structure_snippet.json` | Bundle — Encounter + List hierarchy for consultation |
| `uncategorised_blood_pressure_snippet.json` | Observation — blood pressure triple structure |
| `list_with_warning_code_snippet.json` | List — with confidential items warning code |
| `list_empty_no_content_snippet.json` | List — empty with no-content-recorded emptyReason |
| `encounter_example.json` | Encounter resource — full CareConnect-GPC-Encounter-1 example |
| `medication_request_full_example.json` | MedicationRequest (intent=order) — full example with repeat info and dispense |
| `operation_outcome_disabled_area.json` | OperationOutcome — warning when clinical area disabled |
| `nopat_security_label_snippet.json` | Meta.security — NOPAT label for patient-restricted information |
| `codeable_concept_degraded_allergy.json` | CodeableConcept — degraded drug allergy with SNOMED degrade code |
| `codeable_concept_translation_set.json` | CodeableConcept — READ2 code + SNOMED translation set |
| `encounter_example.json` | Encounter — full CareConnect-GPC-Encounter-1 example |
| `medication_request_full_example.json` | MedicationRequest (intent=order) — full example with repeat info |
| `operation_outcome_disabled_area.json` | OperationOutcome — warning when a clinical area is disabled |
| `nopat_security_label_snippet.json` | NOPAT security label for patient-restricted information |

---

## Key Source URLs

| Source | URL | Last Updated |
|--------|-----|-------------|
| GP Connect ARS Implementation Guide (Simplifier.net) | https://simplifier.net/guide/gp-connect-access-record-structured?version=current | Current |
| GP Connect — NHS England Digital | https://digital.nhs.uk/services/gp-connect | 12 May 2026 |
| GP Connect Access Record — NHS England Digital | https://digital.nhs.uk/services/gp-connect/gp-connect-in-your-organisation/gp-connect-access-record | 30 Jan 2026 |
| Develop GP Connect Services — NHS England Digital | https://digital.nhs.uk/services/gp-connect/develop-gp-connect-services | 21 May 2026 |
| GP Connect ARS FHIR API — API Catalogue | https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir | 27 Nov 2025 |
| GP Connect Specifications for Developers | https://digital.nhs.uk/services/gp-connect/develop-gp-connect-services/specifications-for-developers | 7 Nov 2025 |
| Development Guidance | https://digital.nhs.uk/services/gp-connect/develop-gp-connect-services/development | 14 Nov 2025 |
| GP Connect Data Model (Simplifier.net) | https://simplifier.net/guide/gpconnect-data-model/Home?version=current | Current |
| Archived GP Connect 1.5.0 Developer Docs — `developer.nhs.uk` was retired; this is a web-archive snapshot. Current developer resources live at https://digital.nhs.uk/developer (community discussion at https://developer.community.nhs.uk/) | https://webarchive.nationalarchives.gov.uk/ukgwa/20240629120128/https://developer.nhs.uk/apis/gpconnect-1-5-0/ | Archived 29 Jun 2024 |
| GP Connect API 1.5.0-beta specification | https://simplifier.net/guide/gp-connect-access-record-structured?version=current | Current |

---

## Quick Reference: Clinical Area Parameters

| Clinical Area | Request Parameter | Search Options |
|---------------|-------------------|----------------|
| Allergies | `includeAllergies` | `includeResolvedAllergies` (bool) |
| Medications | `includeMedication` | `medicationSearchFromDate`, `includePrescriptionIssues` |
| Consultations | `includeConsultations` | `consultationSearchPeriod`, `includeNumberOfMostRecent` |
| Problems | `includeProblems` | `filterStatus` (active/inactive) |
| Immunisations | `includeImmunisations` | `includeNotGiven`, `includeStatus` |
| Investigations | `includeInvestigations` | `investigationSearchPeriod` |
| Referrals | `includeReferrals` | `referralSearchPeriod` |
| Diary Entries | `includeDiaryEntries` | `diaryEntriesSearchDate` |
| Uncategorised Data | `includeUncategorisedData` | `uncategorisedDataSearchPeriod` |

---

## Key FHIR Profiles Used

| Resource | GP Connect Profile |
|----------|--------------------|
| Bundle | `GPConnect-StructuredRecord-Bundle-1` |
| Patient | `CareConnect-GPC-Patient-1` |
| Organization | `CareConnect-GPC-Organization-1` |
| Practitioner | `CareConnect-GPC-Practitioner-1` |
| PractitionerRole | `CareConnect-GPC-PractitionerRole-1` |
| List | `CareConnect-GPC-List-1` |
| AllergyIntolerance | `CareConnect-GPC-AllergyIntolerance-1` |
| Medication | `CareConnect-GPC-Medication-1` |
| MedicationStatement | `CareConnect-GPC-MedicationStatement-1` |
| MedicationRequest | `CareConnect-GPC-MedicationRequest-1` |
| Immunization | `CareConnect-GPC-Immunization-1` |
| Observation | `CareConnect-GPC-Observation-1` |
| Condition (ProblemHeader) | `CareConnect-GPC-ProblemHeader-Condition-1` |
| DiagnosticReport | `CareConnect-GPC-DiagnosticReport-1` |
| Specimen | `CareConnect-GPC-Specimen-1` |
| ProcedureRequest | `CareConnect-GPC-ProcedureRequest-1` |
| ReferralRequest | `CareConnect-GPC-ReferralRequest-1` |
| DocumentReference | `CareConnect-GPC-DocumentReference-1` |
| Encounter | `CareConnect-GPC-Encounter-1` |

