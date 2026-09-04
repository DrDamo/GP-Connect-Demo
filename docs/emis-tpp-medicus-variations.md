# EMIS / TPP / Medicus FHIR Output Variations — Internal Reference

This is a living catalog of every EMIS Web, TPP SystmOne, and Medicus (Optum) FHIR STU3 output
difference that is actually stated or implemented in **this repository's** extractor code,
validator, builder, sample data, or training-content docs — as of the code read for this audit
(2026-09-04). It is not an external spec; every row cites the file (and, where useful, line
numbers) it was derived from. Rows marked "inferred" describe a conditional branch or fallback
in the code that has no comment naming a vendor — the logic is real, the vendor attribution is a
best guess (usually carried over from the prior audit note or from sample-data evidence).

---

## 1. Problems (Condition)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| `Extension-CareConnect-ProblemSignificance-1` shape | Uses `valueCode` (string), not `valueCodeableConcept` | Same — `valueCode` | not observed / no data | `src/fhir/problems.ts:46-52` — extractor reads `valueCode` first, falls back to `valueCodeableConcept`/text. Comment on this exact fact lives in the (superseded) audit note, but the code itself no longer needs a comment since both paths are handled. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed** — every real instance in both bundles uses `valueCode` only. |
| SNOMED vs Read v2 coding order | Read v2 (`http://read.info/readv2`) at `coding[0]` with `userSelected: true`; SNOMED at `coding[1]` with no `userSelected` | not observed / no data | not observed / no data | Confirmed directly in sample data `src/sample-data/emis-consultations.json` (e.g. entry 14/15/16 `code.coding`); handled generically by `extractSnomedCode`/`extractOriginalTermText` in `src/fhir/utils.ts:118-179` (not problems-specific, but this is where Problems' codes are resolved). **Verified against a real TPP/EMIS bundle (Sep 2026): refuted** — neither real bundle has Read v2/Egton coding on `Condition.code` at all; both use single-coding SNOMED only. Real EMIS instead sets `userSelected:true` directly on the SNOMED coding; real TPP never sets `userSelected`. A repo-wide coding-system inventory found zero occurrences of `read.info/readv2` or `egton-codes` anywhere in either real bundle — this claim may be stale/from non-representative sample data. |
| `assertedDate`, `asserter`, `note[]` | Extracted for all vendors (no vendor-specific branch) | same | same | `src/fhir/problems.ts:54-58, 89-93` |
| `Extension-CareConnect-ActualProblem-1` / `Extension-CareConnect-RelatedClinicalContent-1` | Extracted generically as `linkedItems` | same | same | `src/fhir/problems.ts:60-78`; example extension shape documented generically (no vendor tag) in `src/training-content/11_problems.md:122` and `src/training-content/15_data_model_guide.md:146`. **Verified against a real TPP/EMIS bundle (Sep 2026): partially confirmed** — both extensions are present, but the "ActualProblem" extension URL itself differs by vendor: real TPP uses `https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-ActualProblem-1` (no "GPC" infix); real EMIS uses `https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-GPC-ActualProblem-1` (GPC infix, different host). `RelatedClinicalContent` only observed in real EMIS data (TPP's 2-Condition sample is too small to rule out). |
| `Extension-CareConnect-RelatedProblemHeader-1` (parent/child problem hierarchy) | Not found anywhere in code or docs | Not found anywhere in code or docs | not observed | Prior audit note claimed this was a "TPP" extension NOT yet extracted — a repo-wide grep found **no occurrence** of this string in code, docs, or sample data. Treat as unconfirmed/stale until a real bundle is found using it. **Verified against a real TPP/EMIS bundle (Sep 2026): refuted (now confirmed real)** — found exactly once in the real EMIS bundle, as a top-level extension on a `List` resource (not on `Condition` as previously assumed), at `https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-RelatedProblemHeader-1`. Not present in the real TPP bundle. See §13. |

## 2. Medications (MedicationStatement / MedicationRequest / Medication)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| Current vs Past classification — headline rule | Status alone is **not** reliable; needs `prescriptionType` + `statusReason` + date logic (see rules below) | `MedicationStatement`/`MedicationRequest.status` can be read straight off — `active` = current, `completed`/`stopped`/`entered-in-error` = past | Same rules as EMIS ("documented by the person who asked for this to behave the same way — there's no known bundle marker to distinguish it from EMIS yet") | `src/fhir/medications.ts:7-45` (design comment block), `classifyIsCurrent()` at `:75-128` |
| Vendor detection mechanism | Falls through to the non-TPP branch by default | `detectIsTpp()` returns true if any `Medication.code.coding[].system` string `includes('tpp')` | Same as EMIS (no distinguishing marker known) | `src/fhir/medications.ts:58-67`. **Verified against a real TPP/EMIS bundle (Sep 2026): refuted** — the real TPP bundle's `Medication.code.coding` uses only `http://snomed.info/sct`; no coding system string anywhere in the whole bundle contains "tpp". `detectIsTpp()` as described would never fire against this real TPP export. A more reliable real fingerprint found instead: `code.coding[].userSelected` is set `true` pervasively across Condition/AllergyIntolerance/Medication/Observation/ProcedureRequest in the real EMIS bundle, and never set at all anywhere in the real TPP bundle. See §13. |
| Acute prescription, `status: completed` | Marked `completed` as soon as issued regardless of whether the course has finished — extractor treats as current unless `stopped`/`entered-in-error`, or its `effectivePeriod.end` has passed | `completed` is trusted at face value (course genuinely finished) | Same as EMIS | `src/fhir/medications.ts:19-23, 115-127` |
| Repeat prescription, `status: completed` | Flips to `completed` once the last allowed issue has been made, but is still the patient's *current* repeat; only truly past once `stopped` or reauthorised (flagged via `statusReason` matching `/re[-\s]?authoris\|re[-\s]?authoriz/i`) | Trusted at face value | Same as EMIS | `src/fhir/medications.ts:24-30, 52-56, 109-113` |
| Repeat dispensing, `status: completed` | All issues are prescribed in one batch up front, so it flips to `completed` as soon as the first issue is made — still current until `stopped`/reauthorised | Trusted at face value | Same as EMIS | `src/fhir/medications.ts:31-33, 109-113` |
| "Prescribed elsewhere" (`Extension-CareConnect-GPC-PrescribingAgency-1` = `prescribed-by-another-organisation`, or legacy `prescriptionType: prescribed-elsewhere`) | Current unless actually `stopped`/`entered-in-error`, regardless of vendor | same | same | `src/fhir/medications.ts:86-98` (explicitly vendor-agnostic — checked *before* the TPP/EMIS split) |
| Delayed prescribing | Rules not defined for EMIS/Medicus yet — falls back to the TPP-style status-only rule | status-only rule applies | Falls back to TPP-style rule (undefined) | `src/fhir/medications.ts:41-42` |
| Medication.code alternate coding systems | `https://fhir.hl7.org.uk/Id/emis-drug-codes` alongside SNOMED | dm+d (`https://dmd.nhs.uk`) alongside SNOMED (seen in generic sample data, not vendor-confirmed) | not observed / no data | `src/fhir/supportingResources.ts:109-115` (`alternativeCodeLabel()` maps `emis-drug-codes`→"EMIS drug code", `tpp`→"TPP code", `dmd.nhs.uk`/`/dmd`→"dm+d code"); training doc table `src/training-content/02_api_calls_and_responses.md:328-337` lists `https://fhir.hl7.org.uk/Id/emis-drug-codes` as a known EMIS drug-code system. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for EMIS, refuted for TPP** — `emis-drug-codes` present on 52/52 real EMIS `Medication.code.coding` (ordered before SNOMED, i.e. `coding[0]`). The string `dmd.nhs.uk` does not appear anywhere in either real bundle — real TPP `Medication.code` is SNOMED-only, consistent with the doc's own caveat that the dm+d example came from an untagged generic sample file. |
| `numberOfRepeatPrescriptionsIssued`, `authorisationExpiryDate` sub-extensions of `Extension-CareConnect-GPC-MedicationRepeatInformation-1` | Extracted generically (no vendor branch) | same | same | `src/fhir/medications.ts:224-243`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed present in both** (TPP 53/392 MedicationRequests, EMIS 42/273). |
| `Extension-CareConnect-GPC-MedicationStatusReason-1` (`statusReason` + `statusChangeDate`) | Extracted generically | same | same | `src/fhir/medications.ts:261-269`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed present in both** (TPP 61/545 combined MedicationStatement+Request, EMIS 19/359). |
| `Extension-CareConnect-GPC-MedicationQuantityText-1` (unit text override on `dispenseRequest.quantity`) | Extracted generically | same | same | `src/fhir/medications.ts:246-255`. **Verified against a real TPP/EMIS bundle (Sep 2026): partially confirmed — major usage-rate difference found.** Present in 368/392 (94%) real TPP `MedicationRequest`s but 0/273 (0%) real EMIS `MedicationRequest`s. TPP's real prescribing data attaches it almost universally; EMIS's real data never does. See §13. |

## 3. Allergies (AllergyIntolerance)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| Resolved-allergy duplication | not observed / no data | Duplicates resolved allergies: once as a top-level bundle entry, again inside the "Ended allergies" List's `contained[]` array. Extractor de-duplicates by resource `id` (first occurrence wins). | not observed / no data | `src/fhir/allergies.ts:8-25` (comment explicitly says "e.g. TPP"). **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed** — 6 real TPP `List` resources contain a `contained[]` AllergyIntolerance whose `id` exactly matches a top-level bundle-entry AllergyIntolerance (6/6). The real EMIS bundle uses zero `contained[]` resources anywhere in the entire bundle — TPP is the only one of the two using `contained[]` at all. |
| Coding order in `code.coding[]` | Read v2 (`http://read.info/readv2`) placed at `coding[0]`, SNOMED elsewhere — extractor now prefers `system === 'http://snomed.info/sct'`, else `coding[0]` | not observed / no data | not observed / no data | `src/fhir/allergies.ts:30-34` (comment: "Prefer SNOMED CT coding — EMIS places Read v2 at coding[0]"). **Verified against a real TPP/EMIS bundle (Sep 2026): refuted** — every real `AllergyIntolerance.code.coding` in both bundles (TPP 28/28, EMIS 18/18) is single-coding, SNOMED-only; no Read v2/Egton coding observed on AllergyIntolerance in either real bundle. |
| `http://hl7.org/fhir/StructureDefinition/encounter-associatedEncounter` extension | not observed / no data | Prior audit attributes this to TPP (unconfirmed in current code comments — the extractor code itself is vendor-agnostic) | not observed / no data | `src/fhir/allergies.ts:59-61` — extracted generically as `encounterId`, no vendor string in the code comment. **Verified against a real TPP/EMIS bundle (Sep 2026): refuted as TPP-exclusive** — present in both real bundles (TPP 28/28 AllergyIntolerance, EMIS 1/18), confirming the code's vendor-agnostic framing over the older TPP attribution. |
| `Extension-CareConnect-GPC-AllergyIntoleranceEnd-1` (`endDate` + `reasonEnded` sub-extensions) | Extracted generically | same | same | `src/fhir/allergies.ts:4, 63-66`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for TPP (6/28, matching its resolved allergies exactly); unable to verify for EMIS** — the real EMIS bundle has zero resolved allergies (`clinicalStatus` is `active` for all 18), so there is no case to check the extension against. |
| Validator rule: resolved AllergyIntolerance must live in `List.contained`, never top-level | Flags **any** top-level resolved AllergyIntolerance as a warning (this is what makes TPP's known duplication pattern show up as "wrong" per strict GP Connect spec even though the extractor tolerates/de-dupes it for display) | same rule applies | same rule applies | `src/fhir/validator.ts:363-381` |

## 4. Immunisations (Immunization)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| `vaccineCode` NullFlavor pattern | `vaccineCode.coding` is often entirely `http://hl7.org/fhir/v3/NullFlavor` (e.g. "UNK") — the real SNOMED code lives in `Extension-CareConnect-VaccinationProcedure-1` instead | not observed / no data | not observed / no data | `src/fhir/immunisations.ts:11-33, 70-83` (comment: "VaccinationProcedure extension carries the real SNOMED code when vaccineCode = UNK"); same fallback logic duplicated in `src/fhir/utils.ts:246-256` (`resolveItemDisplay`). **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed exactly for EMIS; unable to verify for TPP** — all 9/9 real EMIS Immunizations have `vaccineCode.coding = [{system: NullFlavor, code: "UNK", display: "unknown"}]` and all 9/9 carry `VaccinationProcedure`. The real TPP bundle has zero Immunization resources at all, so nothing to check for TPP. |
| `Extension-CareConnect-DateRecorded-1` | Extracted generically | same | same | `src/fhir/immunisations.ts:21-22`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed present in EMIS (9/9); no TPP data to check.** |
| `Extension-CareConnect-ParentPresent-1` (boolean) | not observed / no data | Prior audit attributes this to TPP-only; current code extracts it generically with no vendor check | not observed / no data | `src/fhir/immunisations.ts:25-26`. **Verified against a real TPP/EMIS bundle (Sep 2026): unable to verify** — 0/9 real EMIS Immunizations use it, and the real TPP bundle has no Immunization resources at all to check the TPP-only attribution against. |
| `expirationDate`, `route` fields | not observed / no data | Prior audit attributes to TPP; extracted generically, no vendor branch in code | not observed / no data | `src/fhir/immunisations.ts:91-93`. **Verified against a real TPP/EMIS bundle (Sep 2026): partially refuted** — `expirationDate` is present in 5/9 real EMIS Immunizations, so it is not TPP-exclusive. `route` is present in 0/9 EMIS and unverifiable for TPP (no Immunization data). |
| `explanation.reason` vs `explanation.reasonNotGiven` | Generic handling — extractor prefers `reasonNotGiven` (e.g. "Did not attend") when present, since that's the clinically meaningful field when a vaccine wasn't given | same | same | `src/fhir/immunisations.ts:60-68` |
| Practitioner role handling | A single `practitioner[]` entry can carry **both** `EP` (entering practitioner) and `AP` (administering practitioner) role codes in its `role.coding[]` array — extractor checks all codings, not just the first, and falls back to an unroled entry as `AP` | same (no vendor branch) | same | `src/fhir/immunisations.ts:38-50` |
| Immunisation-related Observations (declined/consent/contraindication/DNA) surfaced via the Immunisations List | Generic — sourced from List code `1102181000000102`; also remain visible in Coded Data | same | same | `src/fhir/immunisations.ts:111-142` |

## 5. Investigations (DiagnosticReport / Observation / Specimen)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| Result grouping style | **Implicit grouping**: no explicit group-header SNOMED code; a header is inferred as "an Observation with no value, following either the start of the report or another Observation that *did* have a value" | **Explicit grouping**: uses SNOMED `364712009` ("Laboratory procedure"/"Laboratory test observable") as a dedicated group-header code | not observed / no data | `src/fhir/investigations.ts:39, 526-578` (`GROUP_HEADER_CODE` comment: "TPP explicit group marker"; `hasExplicitGroups` branch vs implicit-EMIS `isGroupHeader` heuristic). **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for TPP; unable to verify EMIS half** — 12 real TPP Observations carry code `364712009`. The real EMIS bundle has **zero `DiagnosticReport` resources at all**, so there is no grouped EMIS report to check the implicit-grouping mechanism against. See §13. |
| "New GP Connect style" has-member grouping | Also seen from EMIS — a has-member link may point directly to a per-result COMM note, and this pattern must not be confused with an actual analyte child | Applies uniformly wherever `related[type=has-member]` links exist | not observed / no data | `src/fhir/investigations.ts:408-525` — a third mode, detected ahead of the TPP/EMIS explicit/implicit split. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed present, refined** — real EMIS Observations use `related[]` with `type` populated 34 times (`has-member` and `derived-from`, always typed). Real TPP Observations use zero `related[]` entries at all — TPP appears to group purely via `DiagnosticReport.result[]` instead. |
| Untyped `related[]` (no `type` field at all) between Observations | not observed / no data | not observed / no data | not observed — attributed instead to **"Orange Labs"**, the NHS demonstrator/test system (see `src/training-content/02_api_calls_and_responses.md:309`), not to any of EMIS/TPP/Medicus | `src/fhir/investigations.ts:416-418` and `src/fhir/codedData.ts:54-57` both treat an untyped relation as has-member "in practice". **Verified against a real TPP/EMIS bundle (Sep 2026): refuted — not observed in either real bundle.** Zero untyped `related[]` entries found anywhere; every real EMIS `related[]` entry carries an explicit `type`. |
| Interpretation flag | Attaches brief flag text (e.g. `"(EMISTest) - Abnormal - Contact Patient"`) via a has-member-linked COMM note (`37331000000100`) on the individual analyte, rather than `Observation.interpretation` | Buries interpretation in the comment text as `"Interpretation Code: X"` inside `Observation.comment`, parsed by regex | not observed / no data | `src/fhir/investigations.ts:44-74` (`normalizeInterpretation`, `INTERP_CODE_DISPLAY` map), `:363-395` (comment: "EMIS attaches a brief flag text \"High\"/\"Low\" to individual analytes"), `:441-463` (has-member-to-COMM-note handling, same EMIS pattern). **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for TPP; refuted for EMIS.** TPP: 56/937 real Observations carry `"Interpretation Code:"` in `comment` — exact match. EMIS: the real bundle instead uses the **standard structured `Observation.interpretation` CodeableConcept field directly** (6/91, codesystem `http://terminology.hl7.org/CodeSystem/v2-0078`) — the opposite of a comment-embedded/COMM-note flag. See §13. |
| Group/report title fallback for a generic header | not observed / no data | Generic header text `"Laboratory procedures"`/`"Laboratory test observable"` is replaced with the `"Original text: {name}"` line buried in the header Observation's `comment`, when present | not observed / no data | `src/fhir/investigations.ts:151-182` (`GENERIC_GROUP_NAMES`, `cleanGroupComment`, `groupHeaderName`). **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for TPP (117 occurrences); not present in EMIS (0)** — may reflect that this EMIS patient simply has no GP2GP-transferred/degraded records rather than proof the pattern never occurs in EMIS. |
| DiagnosticReport.code generic category | Both EMIS and TPP file **all** lab DiagnosticReports under the same generic SNOMED code, whose display text is `"Diagnostic studies report"` — extractor skips this and falls back to a test-group/result name instead | same | not observed / no data | `src/fhir/investigations.ts:612-617` (comment: "the generic category code used for ALL TPP/EMIS lab DiagnosticReports"). **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for TPP; unable to verify EMIS** — all 32 real TPP DiagnosticReports share exactly one `code.coding` value and `code.text`. The real EMIS bundle has zero DiagnosticReport resources to check. |
| Transfer-degraded records | Real original text recovered from `"Original text: {name}"` in `comment` when the observation's code has been rewritten to the generic transfer-degrade concept `196411000000103` | same mechanism (not vendor-specific — this is the GP2GP/UK-Core degrade convention, see `snomedDegrade.ts`) | not observed / no data | `src/fhir/investigations.ts:163-196`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed present in TPP (33 real Observations use the degrade code); zero occurrences in EMIS**, consistent with this EMIS patient having no degraded/transferred-in records in this bundle rather than a hard vendor gap. |
| Parsed structured values from comment text (`Value:`, `Reference range:`, `Interpretation Code:`) when no `valueQuantity` is present | not observed / no data | This is the TPP-style comment-encoded result pattern | not observed / no data | `src/fhir/investigations.ts:108-133` (`parseCommentValue`, called "TPP-style comment text" in the function comment). **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed** — 54 real TPP Observations show the `Value:` + `Reference range:` comment-encoded pattern; 0 in EMIS. |
| `DiagnosticReport.performer[]` mixing Practitioner/Organization/HealthcareService actors | Generic handling — all captured, not just the first | same | same | `src/fhir/investigations.ts:248-280` |
| `DiagnosticReport.specimen[]` — multiple specimens per report | Generic — resolves per-result specimen first, falls back to the DR-level specimen only when exactly one is referenced overall | same | same | `src/fhir/investigations.ts:282-296, 589-598` |

## 6. Consultations (Encounter / List structure)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| `Encounter.type` shape | not observed / no data | Confirmed against a real TPP-exported Encounter: `{ "type": [{ "text": "Clinical" }] }` — plain text only, no coding, no dedicated codesystem | not observed / no data | `src/fhir/validator.ts:399-410` (comment cites this explicitly as "confirmed against a real GP Connect Encounter (TPP)"); mirrored in the builder's synthetic-data generator at `src/builder/generate/consultations.ts:206-211`. **Verified against a real TPP/EMIS bundle (Sep 2026): partially confirmed — shape yes, exclusivity and fixed value no.** The plain-text-only `type:[{text:"..."}]` shape (no `coding`) is confirmed in the real TPP bundle, but with 12 distinct real text values (e.g. "Admin", "Clinical - Letter", "Admin - Non-consultation data"), not a single fixed `"Clinical"`. Critically, the **real EMIS bundle uses the identical shape** too (4 distinct values, e.g. "GP Surgery", "Community Pharmacy..."), so this is a shared/generic GP Connect convention, not TPP-exclusive. See §13. |
| 3-level List structure (wrapper `325851000000107` → topic `25851000000105` → category `24781000000107`) | Generic mechanism, not vendor-specific | same | same | `src/fhir/consultations.ts:20-97`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed, both vendors** — all three codes present in both real bundles. |
| Comment Observations (`37331000000100`) rendered inline as topic narrative text | Generic | same | same | `src/fhir/consultations.ts:41-46` |
| "Unsupported Clinical Items in Consultations" placeholder (`item.display` with no `item.reference`) | Generic GP Connect mechanism, not vendor-attributed in code or docs | same | same | `src/fhir/consultations.ts:48-55`; documented generically (no vendor name) in `src/training-content/05_consultations.md:123` and `src/training-content/17_linkages_search_configuration.md:98`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for TPP (131 real occurrences); not observed in EMIS (0)** — may be data-driven (this EMIS patient's items all resolve to real references) rather than a hard vendor difference. |
| Sub-list entries that reference another List but aren't tagged as a category | Treated as direct items of the parent topic (fallback, not vendor-attributed) | same | same | `src/fhir/consultations.ts:79-85` |
| Encounter `identifier` carrying a practice-specific namespace URL | Confirmed in sample data: `"system": "https://EMISWeb/A82038"` (ODS-code-suffixed EMIS Web namespace) as a business identifier on `Encounter`/`Observation` resources — **not currently read by any extractor**, purely descriptive | Generic pattern per spec: `"system": "https://provider.nhs.uk/data-identifier"` (business identifier "scoped by supplier namespace") | not observed / no data | `src/sample-data/emis-consultations.json` (e.g. lines 211-213, 708-710, and 9 more occurrences); generic pattern documented in `src/training-content/14_lists_and_references.md:207-220`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for EMIS, refuted for TPP.** Real EMIS: every clinical resource's `identifier[].system` is exactly `https://EMISWeb/A82038`, matching the sample-data pattern exactly. Real TPP does **not** use the generic `https://provider.nhs.uk/data-identifier` placeholder at all — it uses a proprietary vendor namespace, `https://tpp-uk.com/Id/ccs-id`, across nearly every clinical resourceType instead. See §13. |

## 7. Referrals (ReferralRequest)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| Recipient resolution & display preference | Generic — resolves every `recipient[]` entry, classifies each as Practitioner/Organisation/HealthcareService, and prefers HealthcareService > Organisation > Practitioner for the headline "recipient" display | same | same | `src/fhir/referrals.ts:14-44` |
| `description`, `note[]`, `requester.agent`, `supportingInfo` (→ `DocumentReference` links) | All extracted generically, no vendor branch | same | same | `src/fhir/referrals.ts:49-75, 85-90` |
| `context` (linked Encounter) | **Not extracted** — no `context` field appears anywhere in `GpConnectReferral` or the extractor | **Not extracted** | **Not extracted** | `src/fhir/referrals.ts` (whole file); `src/fhir/types.ts:361-376` (`GpConnectReferral` has no `encounterId`/`context` field) |
| `intent` | **Not extracted** | **Not extracted** | **Not extracted** | same as above. **Verified against a real TPP/EMIS bundle (Sep 2026): unable to verify** — neither real bundle contains a single `ReferralRequest` resource at all (confirmed via full resourceType inventory), so none of this section's claims can be checked against real data from these two bundles. |

## 8. Diary Entries (ProcedureRequest)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| `note[]`, `context` (→ `encounterId`), `intent` | All extracted generically, no vendor branch | same | same | `src/fhir/diaryEntries.ts:16-17, 23-34, 46` — contradicts the (stale) prior audit note that flagged these as missing. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed fields exist, with a vendor gap noted** — the real TPP bundle's one `ProcedureRequest` has `intent`, `context`, and `note[]` all populated. The real EMIS bundle's two `ProcedureRequest`s have `intent` populated but **no `context` field at all** (0/2). Small N (1 TPP, 2 EMIS) — indicative, not conclusive. |
| `occurrencePeriod` vs `occurrenceDateTime` | Generic fallback chain — period start/end preferred, else single dateTime | same | same | `src/fhir/diaryEntries.ts:19-21`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed** — both real ProcedureRequests (TPP + EMIS) use `occurrenceDateTime` only; `occurrencePeriod` not present in either. |

## 9. Documents (DocumentReference)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| `author` reference type | Inferred behavior, no vendor comment in code: extractor tries to resolve `author[0]` as a Practitioner first, and falls back to Organization only if that fails — implying EMIS bundles are seen to sometimes give an Organization reference here (per prior audit), but the current code makes no vendor distinction | same fallback applies | same fallback applies | `src/fhir/documents.ts:14-22`. **Verified against a real TPP/EMIS bundle (Sep 2026): refuted — `author` is entirely absent.** `DocumentReference.author` does not appear at all in either real bundle (0/2 TPP, 0/20 EMIS) — neither a Practitioner nor an Organization reference. The fallback logic may never actually fire against real-world TPP/EMIS DocumentReference data. |
| `context.encounter`, `custodian`, `attachment.size`, `attachment.title` | All extracted generically | same | same | `src/fhir/documents.ts:24-30`. **Verified against a real TPP/EMIS bundle (Sep 2026): partially confirmed** — `context.encounter`, `custodian`, `attachment.size` all present 100% in both real bundles. `attachment.title` is absent in both (0/2 TPP, 0/20 EMIS) — genuinely never populated in this real data, not just untested. |
| `masterIdentifier` (prior audit flagged as TPP-specific) | not observed / no data | **Still not extracted** — no `masterIdentifier` handling anywhere in `documents.ts` or `GpConnectDocument` | not observed / no data | `src/fhir/documents.ts` (whole file); `src/fhir/types.ts:422-438`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed as TPP-specific.** Present in 2/2 real TPP DocumentReferences (`system: https://tpp-uk.com/Id/document-master-identifier`), absent in all 20/20 real EMIS DocumentReferences. Now a real-bundle-confirmed vendor split, not just a prior-audit guess — still genuinely unextracted by the current code either way. |
| `indexed` date | Used only as a fallback sort/display date alongside `created`; not exposed as its own field | same | same | `src/fhir/documents.ts:6-10, 36`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed present in both** (2/2 TPP, 20/20 EMIS). |

## 10. Coded/Uncategorised Data (Observation, non-investigation)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| Exclusion of investigation-linked Observations | Generic — builds a transitive closure of every Observation reachable from any `DiagnosticReport.result[]` via `related[type=has-member]` (including the untyped-relation "Orange Labs" case), and excludes all of them from Coded Data | same | same | `src/fhir/codedData.ts:30-67` — this directly resolves the "CRITICAL" gap flagged in the prior audit note (double-representation risk), which is no longer accurate for the current code |
| `comment`, `interpretation`, `component[]`, `performer`, `context` (→ `encounterId`) | All extracted generically | same | same | `src/fhir/codedData.ts:83-150` — also resolves several "NOT extracted" items from the prior audit |
| Qualifiers (laterality/severity/episodicity) concatenated into `Observation.comment` | Generic GP Connect convention — "Each provider system supports a different set of qualifiers... concatenates them with the text entered by the recorder, placing the qualifiers first" — not vendor-specific, no code currently parses these back out of the comment | same | same | `src/training-content/13_coded_data_uncategorised.md:72-74` (doc-only; not implemented in `codedData.ts`) |
| Transfer-degraded original text recovery | Generic, same `196411000000103` mechanism as Investigations | same | same | `src/fhir/codedData.ts:15-24` |
| Blood-pressure-style composite display (systolic/diastolic components with no top-level value) | Generic — a shared helper pairs `component[]` entries by matching `/systolic/i` / `/diastolic/i` in the component name | same | same | `src/fhir/utils.ts:89-106` (`formatCodedDataValue`) |

## 11. Encounters / Patient banner

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| `Encounter.type[].text` | not observed / no data | `{ "type": [{ "text": "Clinical" }] }` confirmed real (see Consultations section) | not observed / no data | `src/fhir/validator.ts:399-410`. **Verified against a real TPP/EMIS bundle (Sep 2026): see Consultations section (§6) — shape confirmed, single-value/TPP-exclusivity claim refuted.** |
| `location`, `period.end` on Encounter | Prior audit claims EMIS may lack these while TPP has them — current `extractConsultations()` extracts `endDate` (`period.end`) generically for all vendors; **`location` is still not extracted anywhere** in `consultations.ts` | same gap: `location` not extracted | same | `src/fhir/consultations.ts:99-160` (no `location` field read); `src/fhir/types.ts:202-215` (`GpConnectConsultation` has no location field). **Verified against a real TPP/EMIS bundle (Sep 2026): `location` present but underused; `period.end` absent in both.** Real TPP: `location` present on 317/317 Encounters (100%); real EMIS: only 3/23 (13%) — so `location` clearly *is* real, present data being left on the table by the extractor, more so for TPP. `period.end` is absent in both real bundles (0/317 TPP, 0/23 EMIS), consistent with the doc's "not extracted" framing at least matching real-world rarity of that field. |
| Patient `NHSCommunication`, `RegistrationDetails`, preferred branch surgery extensions | Extracted generically, no vendor branch | same | same | `src/fhir/utils.ts:303-436` (`extractPatientInfo`) |
| NHS Number verification status extension | Generic; extension URL only matched by substring `NHSNumberVerificationStatus` | same | same | `src/fhir/utils.ts:314-319` |

## 12. General coding-system conventions (cross-domain)

| Aspect | EMIS | TPP | Medicus | Source |
|---|---|---|---|---|
| SNOMED-vs-legacy-code coding order | Read v2 (`http://read.info/readv2`) and/or Egton codes (`https://fhir.hl7.org.uk/Id/egton-codes`) placed at `coding[0]` with `userSelected: true`; SNOMED at a later index — every extractor's `extractSnomedCode`/`extractOriginalTermText` compensates by preferring the SNOMED-system coding (or the `userSelected` one) rather than blindly taking `coding[0]` | not observed to invert order in current sample data (dm+d appears alongside SNOMED with SNOMED first in the generic `medications-bundle.json` sample, but that file isn't vendor-tagged) | not observed / no data | `src/fhir/utils.ts:118-179` (`extractSnomedCode`, `extractOriginalTermText`); confirmed directly in `src/sample-data/emis-consultations.json`. **Verified against a real TPP/EMIS bundle (Sep 2026): refuted across the board.** A full coding-system inventory of both real bundles found **zero occurrences** of `http://read.info/readv2` or `egton-codes` anywhere, in any resource type — every clinical code in both bundles is SNOMED, with EMIS additionally carrying `emis-drug-codes` on Medication only. This claim may be stale/from non-representative sample data; the real, reliable per-vendor coding fingerprint found instead is `code.coding[].userSelected` (see §13). |
| `Extension-coding-sctdescid` (SNOMED description-ID wrapper extension) | Confirmed shape "against a real EMIS-exported bundle": a wrapper extension with nested `descriptionId`/`descriptionDisplay` sub-extensions, not a flat `valueString` | Same STU3 shape expected (this is a CareConnect/GP Connect STU3-wide convention, not EMIS-only — the code comment specifically calls out that only the EMIS-confirmed shape has been directly verified) | not observed / no data | `src/fhir/utils.ts:130-146`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for EMIS, refined for TPP.** Real EMIS `sctdescid` extensions (153 occurrences) carry both `descriptionId` and `descriptionDisplay` sub-extensions, matching the doc's EMIS example. Real TPP `sctdescid` extensions (954 occurrences) carry **only** `descriptionId` — no `descriptionDisplay` ever appears. The two vendors' payloads genuinely differ, and the extension URL's **host also differs** by vendor (TPP: `fhir.hl7.org.uk`; EMIS: `fhir.nhs.uk`) — see §13. |
| `descriptionId`/`descriptionDisplay` for UK-Edition local-namespace descriptions | Training doc gives an explicit EMIS example: "an EMIS local namespace description" carries the local/national term via `descriptionDisplay` while `code`/`display` stay international SNOMED | not observed / no data | not observed / no data | `src/training-content/16_codeable_concept.md:129-148`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed** (see row above). |
| Drug/medication alternate coding systems recognised by label-mapping | `emis-drug-codes` → "EMIS drug code" | any system string containing `tpp` → "TPP code" | not observed / no data | `src/fhir/supportingResources.ts:109-115`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for EMIS, refuted for TPP** — the `tpp`-substring match would never fire against the real TPP bundle's `Medication.code.coding` (SNOMED-only). |
| Business identifier namespace pattern | `https://EMISWeb/{ODS code}` (e.g. `A82038`) seen on Encounter/Observation `identifier[]` in sample data | Generic per spec: `https://provider.nhs.uk/data-identifier` | not observed / no data | `src/sample-data/emis-consultations.json`; `src/training-content/14_lists_and_references.md:207-220`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed for EMIS, refuted for TPP** — real TPP business identifiers use `https://tpp-uk.com/Id/ccs-id`, not the generic spec placeholder. See §13. |
| Untyped `related[].type` on Observation-to-Observation has-member links | not observed / no data | not observed / no data | not observed — instead attributed to a fourth non-branded source, **"Orange Labs"** (NHS England's internet-facing FHIR demonstrator/test system, `https://orange.testlab.nhs.uk/`) | `src/fhir/investigations.ts:416-418`, `src/fhir/codedData.ts:54-57`; test environment named in `src/training-content/02_api_calls_and_responses.md:305-310`. **Verified against a real TPP/EMIS bundle (Sep 2026): refuted — not observed in either real bundle.** |
| `List` primary-domain SNOMED codes (14 known codes incl. 3 consultation-structure codes) | Generic GP Connect convention, not vendor-specific | same | same | `src/fhir/lists.ts:6-17`, `src/fhir/validator.ts:6-25`. **Verified against a real TPP/EMIS bundle (Sep 2026): confirmed, both vendors** — and see §13 for a second, previously-undocumented `GPConnect-SecondaryListValues-1` codesystem used identically by both vendors alongside these SNOMED domain codes. |
| NOPAT security label (`meta.security[].code === 'NOPAT'`) | Generic — surfaced as `notForPfs` on every domain type | same | same | `src/fhir/utils.ts:112-116`; used throughout every `src/fhir/*.ts` extractor. **Verified against a real TPP/EMIS bundle (Sep 2026): unable to verify** — zero resources in either real bundle carry `meta.security` at all (NOPAT or otherwise), and neither bundle has a `Bundle.meta.security` label either. May simply mean neither real patient has a record flagged sensitive. |
| Duplicate resource IDs / duplicate bundle entries | Prior audit and `getEntries()` comment note this is "seen in real GP Connect exports" without naming a specific vendor — de-duplicated by keeping the first occurrence | same | same | `src/fhir/utils.ts:5-22`. **Verified against a real TPP/EMIS bundle (Sep 2026): not observed in these two real bundles** — zero duplicate `resourceType/id` combinations found in either. Doesn't disprove the general claim for other exports; these two are clean. |
| Bare-id vs `ResourceType/id` reference resolution | Generic robustness fix, not vendor-specific — `resolveReference()` intentionally does *not* fall back to a bare-id match, to avoid `Organization/1` matching `Patient/1` | same | same | `src/fhir/utils.ts:38-47`. **Verified against a real TPP/EMIS bundle (Sep 2026): not observed as a real problem in these bundles** — every `.reference` string in both real bundles is a full `ResourceType/id` reference (plus 6 `#contained-id` references in TPP); no bare-id or `urn:uuid:` references found anywhere. |

---

## 13. Newly discovered structural differences (verified against real bundles, Sep 2026)

Everything in this section comes from structural analysis of two real GP Connect Access Record
Structured bundles (referred to only as "the real TPP bundle" and "the real EMIS bundle" — one
patient each) that were not part of any prior audit of this repository. All of it is genuinely new
to this doc — not a re-verification of an existing claim (those live inline above). As with the
rest of the doc, absence of a pattern in one bundle may reflect that patient's specific data rather
than a hard vendor capability gap; this is called out per row where relevant.

### Bundle-level

| Aspect | EMIS (real bundle) | TPP (real bundle) | Evidence |
|---|---|---|---|
| `Bundle.type` / `meta.profile` | `collection`; `GPConnect-StructuredRecord-Bundle-1` | Same | Identical in both — no vendor difference at the Bundle envelope level. |
| `entry[].fullUrl`, `entry[].search.mode`, `Bundle.total`, `Bundle.identifier`, `Bundle.link`, `Bundle.meta.security` | All absent | All absent | Neither bundle populates any of these optional Bundle-level fields. |
| Entry ordering | Resources batched contiguously by resourceType; `List` entries emitted first (before `Patient`) | Resources batched contiguously by resourceType; `Patient` emitted first | Both vendors group same-type resources together, but in a different domain order — neither uses a fixed canonical order. |
| Full resourceType inventory | 17 types: `List, Patient, MedicationRequest, Condition, AllergyIntolerance, Immunization, Observation, Encounter, MedicationStatement, ProcedureRequest, Organization, Practitioner, Location, Medication, QuestionnaireResponse, PractitionerRole, DocumentReference` (734 entries) | 16 types: `Patient, AllergyIntolerance, List, MedicationStatement, MedicationRequest, Medication, Observation, Encounter, DocumentReference, DiagnosticReport, Condition, ProcedureRequest, Organization, Practitioner, PractitionerRole, Location` (2627 entries) | EMIS has `Immunization` and `QuestionnaireResponse`; TPP has neither. TPP has `DiagnosticReport`; EMIS has zero. Neither bundle contains `ReferralRequest`, `Provenance`, `Composition`, `OperationOutcome`, `Specimen`, or `HealthcareService`. |
| `QuestionnaireResponse` resource | Present, 18 instances (`meta.profile = CareConnect-QuestionnaireResponse-1`); fields used: `authored`, `context.reference`, `item[].linkId`, `item[].answer[].valueReference`, `parent[].reference` | Not present at all | EMIS wires some structured/templated clinical content in via a full `QuestionnaireResponse` resource linked through `parent[]`/`context`; nothing in the real TPP bundle uses this resource type. |
| `DiagnosticReport` resource | **Absent entirely (0 instances)** | Present, 32 instances, wraps lab results via `result[]` | The real EMIS bundle's investigations appear to be represented as bare `Observation`s linked by typed `related[]` rather than grouped under `DiagnosticReport` at all — a different investigations model than assumed elsewhere in this doc. Possibly patient/data-scope dependent rather than a hard EMIS limitation. |

### Resource `id` formats

| Aspect | EMIS (real bundle) | TPP (real bundle) | Evidence |
|---|---|---|---|
| General id style | UUID-based almost everywhere (`Patient`, `AllergyIntolerance`, `Immunization`, `Observation`, `Encounter`, `ProcedureRequest`, `Organization`, `Practitioner`, `Location`, `Medication`, `DocumentReference`) | Never a pure UUID — fixed-length hex strings (commonly 16 hex chars), sometimes two 16-char blocks joined by `_` | Fundamentally different id-generation schemes per vendor. |
| Compound/derived ids | `MedicationStatement` id = parent `MedicationRequest` UUID + a short suffix (e.g. `-MS`); `List` id = UUID + a short suffix; `Condition` id = UUID + a `-PROx`-style suffix; `QuestionnaireResponse` = UUID + `-QRSP` | `MedicationRequest`/`MedicationStatement`/`Observation`/`List`/`DocumentReference` ids = two 16-hex-char blocks joined by `_`, sometimes with a short trailing word-like suffix (e.g. a plan/order tag, or a topic/no-topic tag on List) | Both vendors encode a resource-role hint into the id itself, via different mechanisms. |
| `PractitionerRole` id | 64 lowercase-hex characters (looks like two concatenated 32-char hashes) | 16 hex characters, same style as `Practitioner`/`Patient` | A reliable per-vendor id-shape fingerprint for this resourceType. |
| `Organization` id | Mix of pure UUIDs and a longer alphanumeric id ending in an `-XMO`-style suffix (for apparently external/non-owning organisations) | Consistent 16-hex-char style, same as Practitioner | EMIS appears to distinguish "local" vs "external" Organization records by id shape; not observed in TPP's data. |
| `meta.versionId` / `meta.lastUpdated` | `versionId` (small plain incrementing-looking number) present only on `Patient`, `Organization`, `Practitioner`, `Location`, `PractitionerRole`, `DocumentReference`; `lastUpdated` **never** present anywhere | `versionId` (opaque hash-like string) **and** `lastUpdated` (ISO datetime, `+HH:MM` offset) both present, but only on `Patient`, `Organization`, `Practitioner`, `PractitionerRole`, `Location` — never on clinical resources | Both vendors restrict versioning metadata to the same five reference/demographic resource types, but TPP's `versionId` is a real opaque hash with a timestamp; EMIS's is a small incrementing number with no timestamp at all. |

### Identifier namespaces

| Aspect | EMIS (real bundle) | TPP (real bundle) | Evidence |
|---|---|---|---|
| Clinical-resource business identifier | `https://EMISWeb/A82038` (ODS-code-suffixed) on Encounter/Observation/Condition/AllergyIntolerance/MedicationRequest/MedicationStatement/ProcedureRequest/DocumentReference/QuestionnaireResponse | `https://tpp-uk.com/Id/ccs-id` on the same set of resource types | A proprietary vendor namespace, not the generic `https://provider.nhs.uk/data-identifier` placeholder previously assumed for TPP. |
| `MedicationRequest` extra identifier (TPP only) | — | Also carries `https://fhir.nhs.uk/Id/eps-line-item-identifier` (NHS Electronic Prescription Service) alongside `ccs-id` | Not present on EMIS `MedicationRequest.identifier[]`. |
| `DocumentReference.masterIdentifier` system (TPP only) | Not present | `https://tpp-uk.com/Id/document-master-identifier` | See §9 update above. |
| Reference/demographic identifiers | `ods-organization-code` (Org), `sds-user-id` + `sds-role-profile-id` (Practitioner) | `ods-organization-code` (Org), `sds-user-id` (Practitioner), `ods-site-code` (Location) | Both vendors use the same NHS national namespaces for reference data — only the *clinical* business-identifier namespace differs per vendor. EMIS additionally tags Practitioner with `sds-role-profile-id`, which TPP does not. |

### Extension URLs and coding-system fingerprints

| Aspect | EMIS (real bundle) | TPP (real bundle) | Evidence |
|---|---|---|---|
| `Extension-coding-sctdescid` host | `fhir.nhs.uk` | `fhir.hl7.org.uk` | Same extension name, different host domain, consistent per vendor (153 EMIS / 954 TPP occurrences). |
| `Extension-CareConnect-ActualProblem-1` naming | `fhir.nhs.uk`, with a "GPC" infix (`...-GPC-ActualProblem-1`) | `fhir.hl7.org.uk`, no "GPC" infix (`...-ActualProblem-1`) | Same conceptual extension, migrated URL form in EMIS's real data vs. an older form still used by TPP's real data. |
| `CareConnect-SDSJobRoleName-1` codesystem host | `fhir.hl7.org.uk` | `fhir.nhs.uk` | The *reverse* host pairing from the two rows above — host choice is inconsistent per extension/codesystem, not a fixed per-vendor rule; each one needs checking individually. |
| `Extension-CareConnect-ValueApproximation-1` | Not present | Present (2 occurrences), on `Observation(.component[]).valueQuantity.extension[]`, carrying a `valueBoolean` | Not documented anywhere else in this doc — appears to flag an approximate/estimated numeric result. |
| `code.coding[].userSelected` boolean | Set `true` directly on the primary SNOMED coding, used pervasively across **Condition, AllergyIntolerance, Medication, Observation, ProcedureRequest** | **Never present anywhere** in the bundle | A strong, consistent, cross-resource-type real fingerprint distinguishing the two vendors — far more reliable in this data than the doc's existing Read v2/Egton coding-order signal, which was never observed at all in either real bundle. Worth considering as a `detectIsTpp()`/`detectIsEmis()` replacement signal. |
| `http://hl7.org/fhir/list-order` codesystem (TPP only, 645 occurrences) | Not present | Present | TPP explicitly encodes List entry ordering via a coded system rather than relying on array position alone — not documented anywhere else in this doc. |
| `GPConnect-SecondaryListValues-1` codesystem (shared, not vendor-specific) | Used (10 occurrences) | Used (11 occurrences) | A second, non-SNOMED family of `List.code` values exists alongside the doc's documented ~14-17 SNOMED primary-domain codes — slug-style codes like `"consultations-allergies-contained-in-consultations"` or `"problems-medications-related-to-problems"`. Identical mechanism in both vendors — genuinely new to this doc, but not a vendor difference. |
| `http://terminology.hl7.org/CodeSystem/v2-0078` (interpretation flags, EMIS only in this data) | Present (6 occurrences, code `A` = "Abnormal") | Not present | See §5 update above — EMIS's real interpretation mechanism is the standard structured field, not a comment-embedded flag. |

### Medications / Observations — additional real-data-only nuances

| Aspect | EMIS (real bundle) | TPP (real bundle) | Evidence |
|---|---|---|---|
| `Observation.category` | **Never present** (0/91) | Present on 165/937 (e.g. `http://hl7.org/fhir/observation-category` code `laboratory`) | Not documented anywhere else in this doc. |
| `MedicationRequest.dosageInstruction[]` structure | Sometimes structured (6/273 have `timing.repeat`/`doseQuantity`/`method`); otherwise text+patientInstruction only | **Never structured** (0/392) — always just `{text, patientInstruction}` | A consistent, genuine difference: real TPP dosage instructions carry no machine-readable timing/dose/method at all in this bundle; EMIS occasionally does. |
| `MedicationRequest.priorPrescription` | Present 23/273 | **Never present** (0/392) | EMIS links prescription-reissue chains via this field; TPP relies solely on the `MedicationStatementLastIssueDate` extension instead. |
| `Location` resource shape | No business `identifier[]`; has `address.type`/`address.use`, `type`/`type.text`, `managingOrganization.display`, `telecom[].rank` | Has business `identifier[]` (`ods-site-code`) and `meta.lastUpdated`; lacks the EMIS-only fields | Different Location-resource population strategy per vendor. |
| `Organization.type` field | `type[].text` (free text, no coding) | `type[].coding[].display` (coded) | TPP's Organization type is a proper coded CodeableConcept; EMIS's is text-only in this data. |

### Cross-cutting / general

| Aspect | EMIS (real bundle) | TPP (real bundle) | Evidence |
|---|---|---|---|
| `contained[]` usage anywhere in the bundle | **Zero** — no resource of any type | Only `List` → `AllergyIntolerance` (6 instances, the resolved-allergy duplication pattern) | TPP is the only bundle using `contained[]` at all, and only for this one purpose. |
| Narrative `text.div` | **Absent on every resource instance in the entire bundle** | **Absent on every resource instance in the entire bundle** | A full match between vendors — neither populates FHIR narrative anywhere; not previously documented in this doc at all. |
| Date/time format | `+HH:MM` offset only, never `Z`; mix of date-only, full datetime, datetime-with-milliseconds, and `YYYY-MM` partial dates | Same set of shapes, same offset convention | No difference found between vendors here. |
| Practitioner/Organization/PractitionerRole modelling | Split into three separate resource types | Split into three separate resource types, identical field set | No difference found — both vendors use the identical split-resource GP Connect modelling. |
| Reference style | 100% `ResourceType/id`; zero `urn:uuid:`, zero bare-id references (despite EMIS resource *ids* being UUIDs) | 100% `ResourceType/id`, plus 6 `#contained-id` references | Neither bundle uses `urn:uuid:` references anywhere, regardless of the underlying id format used. |

**Scope note:** the real TPP bundle has only 2 `Condition` resources and 0 `Immunization`/
`QuestionnaireResponse`/`ReferralRequest` resources; the real EMIS bundle has 0 `DiagnosticReport`
resources. Several rows above (and inline verification notes elsewhere in this doc) are therefore
scoped as "unable to verify" for one side rather than a confirmed absence — see the full
verification report for exact counts and caveats.

---

## Scope reference: GP Connect Access Record Structured — Live/FoT status by supplier

Captured verbatim from `src/training-content/01_basics_of_the_service.md:32-45` (source: NHS
England Digital, "Last updated on source: 12 May 2026"). Note the doc calls the third supplier
**Optum**, not "EMIS" — Optum appears to be the branded/consuming name used for the live rollout
status table, while "EMIS Web" is named separately as one of the GP provider systems in the
architecture description (`01_basics_of_the_service.md:93`, alongside SystmOne/TPP and Medicus).
The rest of this document (and the rest of the codebase) uses "EMIS"/"TPP"/"Medicus" as its
vendor vocabulary, so this table is reproduced with its own original wording intact rather than
translated into that vocabulary:

| Clinical Area | Status (as of 2025/2026) |
|---|---|
| Medications | Live — in active use (since 2019) |
| Allergies | Live — in active use (since 2019) |
| Immunisations | Live — Optum; FoT — TPP; FoT ready — Medicus |
| Investigations | Live — Optum and TPP; FoT ready — Medicus |
| Uncategorised data | Live — Optum and TPP; FoT ready — Medicus |
| Consultations | Live — Optum and TPP; FoT ready — Medicus |
| Problems | Live — Optum and TPP; FoT ready — Medicus |
| Referrals (Outbound) | Live — Optum and TPP; FoT ready — Medicus |
| Diary Entries | Live — Optum and TPP; FoT ready — Medicus |
| Documents (metadata) | Returned as part of Consultations/Problems queries |

> 'FoT' = First of Type — an iterative cycle for development, self-assessment, assurance and live
> deployment.

---

## Open questions / gaps

- **Medicus has no distinguishing bundle marker.** Every current/past medication rule in
  `src/fhir/medications.ts` groups Medicus with EMIS purely because "the person who asked for
  this to behave the same way" said so (`src/fhir/medications.ts:18-20`) — there is no known
  field, system string, or extension that lets the code actually detect a Medicus bundle. If a
  real Medicus export ever contradicts the EMIS ruleset, this whole branch needs revisiting.
- **`Extension-CareConnect-RelatedProblemHeader-1`** (parent/child problem hierarchy) — claimed
  by the prior audit to be a TPP extension not yet handled, but a full-repo search found no
  occurrence of this extension name in code, sample data, or training docs. Unconfirmed; may be
  stale information from that earlier audit, or may require a real-world bundle to verify.
  **RESOLVED against a real bundle (Sep 2026):** it's real — found once in the real EMIS bundle
  as a top-level extension on a `List` resource (not on `Condition`), at
  `https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-RelatedProblemHeader-1`.
  Not present in the real TPP bundle, so the prior audit's TPP attribution looks backwards — this
  is an EMIS-observed extension, still unextracted by the current code. See §13.
- **`Extension-CareConnect-ParentPresent-1`, `expirationDate`, `route` on Immunization** — prior
  audit attributed these to TPP specifically. The current extractor (`src/fhir/immunisations.ts`)
  reads them with no vendor gate at all, so there's no code-level confirmation either way; treat
  the TPP attribution as unconfirmed. **Partially resolved (Sep 2026):** the real TPP bundle has
  zero Immunization resources at all, so the TPP attribution remains unverifiable from real data.
  The real EMIS bundle shows `expirationDate` present on 5/9 Immunizations and `route`/`ParentPresent`
  on none — so at minimum, `expirationDate` is not TPP-exclusive.
- **`encounter-associatedEncounter` extension on AllergyIntolerance** — same situation: implemented
  generically in `src/fhir/allergies.ts:59-61`, prior-audit-attributed to TPP, no vendor check in
  the code itself. **RESOLVED against a real bundle (Sep 2026):** present in both real bundles
  (TPP 28/28, EMIS 1/18) — confirmed as shared/generic, not TPP-exclusive.
- **Documents `author` = Organization vs Practitioner** — the code's Practitioner-then-Organization
  fallback (`src/fhir/documents.ts:14-22`) is consistent with the prior audit's EMIS claim, but
  nothing in the current code or docs names a vendor for this behavior; it's inferred solely from
  the fallback's existence. **RESOLVED against a real bundle (Sep 2026):** `DocumentReference.author`
  is entirely absent in both real bundles (0/2 TPP, 0/20 EMIS) — the fallback logic has no real
  Practitioner-or-Organization reference to resolve in either vendor's real output.
- **`masterIdentifier` on DocumentReference** — prior audit flagged as TPP-specific and still
  unextracted. Confirmed still absent from `src/fhir/documents.ts` and `GpConnectDocument`
  (`src/fhir/types.ts`). No vendor confirmation either way in current code/docs. **RESOLVED against
  a real bundle (Sep 2026):** confirmed TPP-specific — present in 2/2 real TPP DocumentReferences
  (`system: https://tpp-uk.com/Id/document-master-identifier`), absent in all 20/20 real EMIS
  DocumentReferences. Still genuinely unextracted by the current code.
- **Referrals: `context` (linked Encounter) and `intent`** — genuinely unextracted for every
  vendor; no code path reads them and `GpConnectReferral` has no field for either.
- **"Orange Labs" as a fourth data source** — two separate files (`investigations.ts`,
  `codedData.ts`) call out "Orange Labs" (the NHS demonstrator/test system referenced in
  `src/training-content/02_api_calls_and_responses.md`) as the source of untyped `related[]`
  relations. This isn't EMIS/TPP/Medicus, but it's a real, code-referenced quirk worth knowing
  about when debugging why a has-member link doesn't parse.
- **Generic `medications-bundle.json` sample isn't vendor-tagged.** Unlike
  `emis-consultations.json` (clearly EMIS, confirmed via Read v2 `coding[0]` + `userSelected` +
  `EMISWeb` identifiers), `medications-bundle.json` uses SNOMED-first coding with no
  `userSelected` markers and no vendor-identifying namespace — it appears to be synthetic/generic
  GP Connect sample data rather than a real EMIS, TPP, or Medicus export. Don't cite it as
  evidence for either vendor's conventions.
- **No TPP or Medicus equivalent of `emis-consultations.json` exists in the repo.** Every
  coding-order / `userSelected` / identifier-namespace claim about EMIS in this document is
  directly checkable against that one sample file; no comparable raw sample exists for TPP or
  Medicus, so any TPP/Medicus claim in this document is necessarily sourced from a code comment
  or training doc rather than from inspectable sample JSON.

---

## Files read in full for this audit

`src/fhir/allergies.ts`, `codedData.ts`, `consultations.ts`, `diaryEntries.ts`, `documents.ts`,
`immunisations.ts`, `investigations.ts`, `lineIndex.ts`, `lists.ts`, `medications.ts`,
`nhsNumber.ts`, `parser.ts`, `problems.ts`, `referrals.ts`, `snomedDegrade.ts`,
`supportingResources.ts`, `types.ts`, `utils.ts`, `validator.ts`; `src/builder/types.ts`,
`src/builder/generate/consultations.ts` (targeted sections), `src/builder/forms/ConsultationForm.tsx`
and `ProblemForm.tsx` (targeted grep + context); `src/components/clinical/InvestigationsView.tsx`
(targeted grep + context); `src/training-content/01_basics_of_the_service.md`,
`02_api_calls_and_responses.md`, `16_codeable_concept.md` in full, plus targeted checks of every
other `src/training-content/*.md` file for vendor mentions; `src/sample-data/emis-consultations.json`
and `medications-bundle.json` (structurally inspected via script, not read line-by-line — both are
plain JSON with no vendor-specific prose to miss); `.claude/agent-memory/hydra-analyst/project-gpc-audit.md`
(prior audit, re-verified against current code — several of its "NOT extracted" claims are now
stale, as noted throughout this document); root `CLAUDE.md` (no vendor content found).

**Sep 2026 real-bundle verification pass:** every EMIS/TPP-specific claim in this document was
additionally checked against two real GP Connect Access Record Structured bundles (one TPP
patient, one EMIS patient — referred to throughout only as "the real TPP bundle"/"the real EMIS
bundle", never by filename or patient identity) using Node scripts that inspected structure only
(resource counts, coding-system/extension-URL/id-format shapes, field presence) and never
persisted patient-identifying content or clinical narrative. Results are folded inline above as
"**Verified against a real TPP/EMIS bundle (Sep 2026):** ..." notes, with newly discovered
differences in §13. See the full verification report for exact counts and methodology.
