# 18. GitHub Repositories — Technical Implementation Resources

**Repositories covered:**
1. [NHSDigital/gp-connect-access-record-structured-fhir](https://github.com/NHSDigital/gp-connect-access-record-structured-fhir) — OpenAPI spec & Apigee proxy for GP Connect ARS
2. [NHSDigital/NHSEngland-FHIR-ImplementationGuide](https://github.com/NHSDigital/NHSEngland-FHIR-ImplementationGuide) — NHS England FHIR R4 IG (profiles, extensions, code systems)
3. [NHSDigital/IOPS-FHIR-Test-Scripts](https://github.com/NHSDigital/IOPS-FHIR-Test-Scripts) — FHIR validation and test tooling (TypeScript/Jest)
4. [NHSDigital/FHIR-Validation](https://github.com/NHSDigital/FHIR-Validation) — HAPI FHIR server with NHS Ontoserver terminology proxy (Docker/Java)

**Licensing:** Dual-licensed MIT + OGL (Open Government Licence). Crown Copyright (C) applies to all content.

---

## 1. gp-connect-access-record-structured-fhir

**URL:** https://github.com/NHSDigital/gp-connect-access-record-structured-fhir  
**Branch:** `master`  
**Purpose:** The canonical OpenAPI 3.0 specification for the GP Connect ARS FHIR API, plus Apigee proxy configuration and a NodeJS sandbox mock.

### Repository Structure

| Folder/File | Purpose |
|---|---|
| `specification/gp-connect-access-record-structured-fhir.yaml` | **Main OpenAPI 3.0 specification** — endpoints, parameters, request/response schemas, documentation |
| `specification/images/` | SVGs: GP Connect ecosystem diagram, consumer assurance process flow, clinical assurance process flow |
| `sandbox/` | NodeJS mock implementation — simulates provider responses for development/demo |
| `proxies/live/` | Apigee API proxy for production (routes to real GP system backend) |
| `proxies/sandbox/` | Apigee API proxy for sandbox (routes to NodeJS mock) |
| `scripts/` | Build utilities: `yaml2json.py`, `calculate_version.py`, `set_version.py` |
| `azure/` | Azure DevOps CI/CD pipeline definitions (build, PR, release) |
| `tests/` | End-to-end tests (Python/PyTest) |

### API Overview (from OpenAPI spec)

**Endpoint:** `POST /Patient/$gpc.getstructuredrecord`

**API version:** 1.5.0 — this is the "current working version" per the [NHS Digital API catalogue](https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir) (verified 19 Jul 2026; the page states verbatim: *"The current working version is 1.5.0"*), consistent with the v1.5.0 baseline this whole training pack targets (see `00_INDEX.md`). NHS England's separate direction of travel is v1.6.2 of the Implementation Guide (draft) — see the 🔄 v1.6.2 callouts throughout this pack for confirmed differences.
>
> **Note on this repo's own versioning:** don't treat this GitHub repo's version signals as authoritative for "what API version is current" — its git release tags follow an unrelated pre-1.0 alpha scheme (latest `v1.0.39-alpha`, Sept 2023) that predates and doesn't map to the 1.5.x/1.6.x product versioning at all, and the OpenAPI spec's own `info.version` field isn't even a static value in the source (`specification/gp-connect-access-record-structured-fhir.yaml` on `master` literally contains `version: 'Computed and injected at build time by scripts/set_version.py'`). This repo also appears to lag behind the live product in general (see the corrections to repos #3 and #4 below). For version questions, use the NHS Digital API catalogue and the Implementation Guide, not this repo.

**Status by clinical area** (per API catalogue, verified 19 Jul 2026):
- Medications and allergies: **in production (out of beta)** — no breaking changes
- Immunisations, investigations, uncategorised data: **in production, beta** — breaking changes possible with notice
- Consultations, problems, outbound referrals, diary entries: the catalogue page separately states *"Data is currently unavailable for the following clinical areas: consultations, problems, outbound referrals, diary entries"* — this is a stronger caveat than "beta" and appears alongside (not clearly reconciled with) the general "in production, beta for other aspects of the clinical record" statement on the same page. **Still logged as a conflict below** (this one isn't a GitHub-vs-product discrepancy, it's the API catalogue contradicting itself, so it needs a human check regardless of how much weight the repo itself is given).

**Service level:** Silver — operational 24/7/365, supported 08:00–18:00 Mon–Fri (excl. bank holidays)

**Network access:** HSCN required; not currently available over public internet (planned)

### Required HTTP Headers

| Header | Description | Example |
|---|---|---|
| `Ssp-TraceID` | Consumer-generated GUID/UUID per request | `09a01679-2564-0fb4-5129-aecc81ea2706` |
| `Ssp-From` | Consumer ASID (requesting organisation) | `200000000359` |
| `Ssp-To` | Provider ASID (from SDS lookup) | `918999198738` |
| `Ssp-InteractionID` | Spine Interaction ID | `urn:nhs:names:services:gpconnect:fhir:operation:gpc.getstructuredrecord-1` |
| `Authorization` | JWT Bearer token | `Bearer <jwt>` |
| `Content-Type` | Request content type | `application/fhir+json` |

### Full Request Example (from OpenAPI spec)

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "patientNHSNumber",
      "valueIdentifier": {
        "system": "https://fhir.nhs.uk/Id/nhs-number",
        "value": "9000000009"
      }
    },
    {
      "name": "includeAllergies",
      "part": [{"name": "includeResolvedAllergies", "valueBoolean": true}]
    },
    {
      "name": "includeMedication",
      "part": [
        {"name": "includePrescriptionIssues", "valueBoolean": true},
        {"name": "medicationSearchFromDate", "value": "2019-12-21"}
      ]
    },
    {
      "name": "includeConsultations",
      "part": [
        {"name": "consultationSearchPeriod", "valuePeriod": {"start": "2019-12-21", "end": "2020-02-21"}},
        {"name": "includeNumberOfMostRecent", "value": 5}
      ]
    },
    {
      "name": "includeProblems",
      "part": [
        {"name": "filterStatus", "valueCode": "active"},
        {"name": "filterSignificance", "valueCode": "major"}
      ]
    },
    {
      "name": "includeImmunisations",
      "part": [
        {"name": "includeNotGiven", "valueBoolean": true},
        {"name": "includeStatus", "valueBoolean": true}
      ]
    },
    {
      "name": "includeUncategorisedData",
      "part": [{"name": "uncategorisedDataSearchPeriod", "valuePeriod": {"start": "2019-12-21", "end": "2020-02-21"}}]
    },
    {
      "name": "includeInvestigations",
      "part": [{"name": "investigationSearchPeriod", "valuePeriod": {"start": "2019-12-21", "end": "2020-02-21"}}]
    },
    {
      "name": "includeReferrals",
      "part": [{"name": "referralSearchPeriod", "valuePeriod": {"start": "2019-12-21", "end": "2020-02-21"}}]
    },
    {
      "name": "includeDiaryEntries",
      "part": [{"name": "diaryEntriesSearchDate", "value": "2019-12-21"}]
    }
  ]
}
```

**Response:** `GPConnect-StructuredRecord-Bundle-1` (HTTP 200)

> 🔄 **Removed in v1.6.2 — `filterSignificance`:** valid on the current v1.5.0 baseline shown here (per the ARS Implementation Guide's API-version-compatibility page), but dropped entirely for problems from guide version 1.6.2 onward. See the same flag in `11_problems.md`. Source: [API version compatibility](https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/API-version-compatibility?version=current)

### Security — Provider System Requirements

Providers SHALL:
- Only accept connections from the Spine Secure Proxy (SSP)
- Authenticate the SSP via its client certificate (TLS MA)
- Only accept encrypted connections; drop insecure protocol requests
- Only accept requests for their allocated ASID (from `Ssp-To` header)
- Verify `Ssp-InteractionID` matches the endpoint being called
- Check all SSP headers are present
- Verify JWT bearer token is present and correctly formed

**Supported TLS ciphers (in preference order):**
1. AESGCM+EECDH
2. AESGCM+EDH
3. AES256+EECDH
4. AES256+EDH

### Testing Environments

| Environment | URL |
|---|---|
| Internet-facing demonstrator | https://orange.testlab.nhs.uk/ |
| OpenTest | https://orange.testlab.nhs.uk/opentest.html |
| Integration (INT) | Provided during onboarding |

### Testing Streams

**Clinical testing** — assures safe interoperability of exported data. Resources:
- Patient record(s) requestable from the GP Connect demonstrator
- Description of each test data item, what it tests, and which hazards it mitigates
- See: [Clinical test data](https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir/clinical-test-data)

**Technical testing** — assures messaging capability via Spine:
- [GP Connect automated test suite for API providers](https://github.com/nhsconnect/gpconnect-provider-testing) — publicly available provider test harness
- [Consumer Supplier Test Assurance guide (PDF)](https://github.com/nhsconnect/gpc-consumer-support/wiki/Document-library#consumer-supplier-test-assurance-for-achieving-technical-conformance)

### Onboarding Steps

1. Submit a use case to gpconnect@nhs.net (business problem, GP Connect products, end-user organisations, CSO details)
2. Response within 14 days
3. Start development within 6 months of use case approval
4. Technical assurance via SCAL
5. Clinical assurance: initial meeting → safety process readiness review → clinical evaluation of readiness for deployment

### Key External Links

| Resource | URL |
|---|---|
| Clinical Safety Guide for ARS | https://github.com/nhsconnect/gpc-consumer-support/blob/master/Clinical%20Safety%20Officer%20Guidance%20for%20GP%20Connect%20V0.6%20Structured.pdf |
| Generic Hazard Log (Excel) | http://github.com/nhsconnect/gpc-consumer-support/raw/master/test_data_files/GP_Connect_Hazard_Log_Consumers_v1.0.xlsx |
| Clinical Safety Principles | https://github.com/nhsconnect/gpc-consumer-support/wiki/Clinical-Safety-Principles |
| IG Information Governance Model | https://github.com/nhsconnect/gpc-consumer-support/wiki/Information-Governance-(IG) |
| Provider Automated Test Suite | https://github.com/nhsconnect/gpconnect-provider-testing |
| Interaction IDs | https://digital.nhs.uk/developer/api-catalogue/gp-connect-general-pages/interaction-ids |
| Supplier Progress / Rollout Status | https://digital.nhs.uk/services/gp-connect/supplier-progress |
| Spine Secure Proxy | https://digital.nhs.uk/developer/api-catalogue/gp-connect-general-pages/spine-secure-proxy |
| Cross-organisation Audit & Provenance | https://digital.nhs.uk/developer/api-catalogue/gp-connect-general-pages/cross-organisation-audit-and-provenance |
| Error Handling | https://digital.nhs.uk/developer/api-catalogue/gp-connect-general-pages/error-handling |
| Security | https://digital.nhs.uk/developer/api-catalogue/gp-connect-general-pages/security |

---

## 2. NHSDigital/NHSEngland-FHIR-ImplementationGuide

**URL:** https://github.com/NHSDigital/NHSEngland-FHIR-ImplementationGuide  
**Branch:** `stu1_develop`  
**Purpose:** The source repository for the [NHS England FHIR Implementation Guide](https://simplifier.net/guide/NHSDigital/Home) — FHIR R4 profiles, extensions, code systems, value sets, and naming systems used across NHS England APIs.

> **Important note:** This is the newer **FHIR R4** NHS England IG, not the same as the GP Connect ARS **FHIR STU3** profiles. GP Connect ARS 1.x uses STU3 CareConnect-GPC profiles. This R4 IG is the direction of travel for future NHS England APIs.

### Package Identity

```json
{
  "name": "uk.nhsengland.r4",
  "description": "NHS England FHIR Implementation Guide",
  "fhirVersions": ["4.0.1"],
  "dependencies": {
    "hl7.fhir.r4.core": "4.0.1",
    "fhir.r4.ukcore.stu3.currentbuild": "0.22.0-pre-release"
  },
  "jurisdiction": "urn:iso:std:iso:3166:-2:GB-ENG"
}
```

### Repository Structure

| Folder | Contents |
|---|---|
| `CapabilityStatement/` | FHIR CapabilityStatement resources defining API capabilities |
| `NamingSystems/` | NamingSystem resources (identifier system URIs) |
| `codesystems/` | CodeSystem resources (custom NHS England code systems) |
| `structuredefinitions/` | StructureDefinition resources (profiles and extensions) |
| `valuesets/` | ValueSet resources |

### Extensions Defined

| Extension | Description |
|---|---|
| `Extension-England-FlagRemovalReason` | Reason for removing a clinical flag |
| `Extension-England-LocationExtension` | Additional location data |
| `Extension-England-OrganisationRole` | Role of an NHS organisation |
| `Extension-England-TypedDateTime` | DateTime with a type code (e.g. birth, death) |
| `Extension-England-TypedPeriod` | Period with a type code |

### Relationship to GP Connect ARS

This R4 IG does not directly affect GP Connect ARS 1.x (which uses STU3). However, it is relevant because:
- GP Connect is expected to migrate to R4/UK Core in future versions
- The naming system URIs (e.g. `https://fhir.nhs.uk/Id/nhs-number`) are shared between STU3 and R4
- The UK Core dependency (`fhir.r4.ukcore.stu3.currentbuild`) shows the UK Core R4 trajectory

### CI Validation

The repo uses GitHub Actions with the [IOPS-FHIR-Test-Scripts](https://github.com/NHSDigital/IOPS-FHIR-Test-Scripts) validation framework, validating assets against the FHIR R4 spec and UK Core profiles on each push.

---

## 3. NHSDigital/IOPS-FHIR-Test-Scripts

**URL:** https://github.com/NHSDigital/IOPS-FHIR-Test-Scripts  
**Branch:** `main`  
**Purpose:** FHIR validation and quality control tooling used by NHS Digital and NHS England teams to validate FHIR assets (profiles, examples, IGs) against the FHIR spec and terminology.

> **Correction (verified 19 Jul 2026 via the live repo tree):** this repo is no longer TypeScript/Jest-based as previously described here. The repository root now contains no `/src/` folder, no root `package.json`, and no `.ts` files at all — `gh api .../git/trees/main?recursive=true` shows only 11 `.py` files plus config/README. The README text still opens with "This is a typescript module..." and shows `npm test` examples, but that description is now stale relative to the actual tree; treat the description below as reflecting the current file layout, not the README's prose.

### What It Does

A modular set of CI tools for:
1. **FHIR asset validation** — validates FHIR resources against profiles by pulling a prebuilt validator Docker image (see Validation Pipeline below)
2. **IG content quality** — Python scripts (`IGPageContentValidator/errorChecker.py`, `linkScraper.py`) check Simplifier IGs for spelling errors and broken links
3. **FHIR asset quality control** — `QualityControlChecker/QualityControlChecker.py` checks naming conventions and design-approach conformance

### Components (current tree)

| Component | Folder | Description |
|---|---|---|
| FHIR Validation Action | `FHIRValidationAction/` | Python scripts (`scripts/*.py`) that configure and drive the validator in CI, plus a `test/` folder of UK Core R4 example resources (`Extension-UKCore-*`, `UKCore-*`) and IG packages (`packages/*.tgz`) — no GP Connect STU3 examples present |
| IG Page Content Validator | `IGPageContentValidator/` | Python (`errorChecker.py`, `linkScraper.py`, `relToAbsLinks.py`) — checks Simplifier IG pages for spelling/link errors |
| Quality Control Checker | `QualityControlChecker/` | Python (`QualityControlChecker.py`, `repoVariables.py`) — checks FHIR asset quality per UK Core/NHSE design approach |

The `npm test -- --examples=...` / `--source=...` / `options.json` workflow described in earlier versions of this file could not be confirmed against the current repo — no `options.json`, no root `package.json`, and no `/src/` test runner exist in the tree today. Treat those specific commands as unverified/likely stale rather than repeating them here.

### CI Workflows (current, from `.github/workflows/`)

| Workflow | What it does |
|---|---|
| `masterfhirvalidation.yml` | Reusable workflow (`workflow_call`) — pulls a prebuilt validator image and validates FHIR assets against it |
| `Package-Test-Runner.yml` | Checks NHS assets for conformance to specific UK Core packages |
| `QualityControlChecker.yml` | Spelling + FHIR asset conformance checks against external FHIR repos |
| `testingbranch.yml` | Tests latest validator against the test suite |
| `websiteChecker.yml` | Simplifier IG spelling/link checking (consolidates what earlier documentation called separate `errorChecker`/`linkChecker`/`spellChecker` workflows — those no longer exist as distinct workflow files) |

### Validation Pipeline (how it works, current `masterfhirvalidation.yml`)

```
GitHub push to FHIR repo (via reusable workflow_call)
  → Check out the calling repo
  → Set up Java 21 (temurin)
  → Sparse-checkout NHSDigital/IOPS-FHIR-Test-Scripts (FHIRValidationAction/ only)
  → Check out NHSDigital/FHIR-Validation as `validation-service-fhir-r4`
  → Log in to GHCR
  → docker pull ghcr.io/nhsdigital/validation-service-fhir-r4:latest   (prebuilt image, not built locally)
  → python3 configure-packages-application-yaml.py (adds IG packages to hapi.application.yaml)
  → docker compose -f docker-compose.ci.yml up -d   (start the validator)
  → run FHIR asset tests against the running validator's REST API
```

This is a materially different pipeline from the "clone → `mvn clean install` → `nohup java -jar`" flow described in earlier versions of this file: the validator now ships as a prebuilt GHCR image (`ghcr.io/nhsdigital/validation-service-fhir-r4`) built from the `NHSDigital/FHIR-Validation` repo itself (see its `.github/workflows/publish-hapi-image.yaml`), rather than a separately-maintained `IOPS-FHIR-Validation-Service` repo being built from source in CI.

### Validation Service

`NHSDigital/IOPS-FHIR-Validation-Service` still exists as a repository (confirmed not archived), but the live `masterfhirvalidation.yml` pipeline checks out and runs `NHSDigital/FHIR-Validation` (image name `validation-service-fhir-r4`) instead — see section 4 below. Whether `IOPS-FHIR-Validation-Service` is still an active/parallel validator or has been effectively superseded by `FHIR-Validation` could not be confirmed from the repo metadata alone; flagged as a conflict.

When validating against UK Core profiles, a `CapabilityStatement` must be present in the source to declare which profiles to validate against. See the [UK Core CapabilityStatement](https://github.com/NHSDigital/FHIR-R4-UKCORE-STAGING-MAIN/blob/develop/CapabilityStatement/CapabilityStatement-UKCore.xml).

---

## 4. NHSDigital/FHIR-Validation

**URL:** https://github.com/NHSDigital/FHIR-Validation  
**Branch:** `main`  
**Purpose:** A deployable HAPI FHIR JPA Server with two key customisations: (1) a terminology proxy that forwards SNOMED CT and other NHS terminology requests to the NHS Ontology Server, and (2) an OpenAPI patch to expose `application/fhir+xml` in Swagger UI. Also published as a prebuilt image, `ghcr.io/nhsdigital/validation-service-fhir-r4`, via `.github/workflows/publish-hapi-image.yaml` — this is the image the `IOPS-FHIR-Test-Scripts` CI pipeline now pulls (see section 3 above).

> **Correction (verified 19 Jul 2026 against `hapi.application.yaml` on `main`):** the server is configured with `fhir_version: R4` and its example `implementationguides` entries (commented out) reference R4/UK Core packages (e.g. `fhir.r4.nhsengland.pathology`); the GHCR image name itself is `validation-service-fhir-r4`. This is **not** an out-of-the-box STU3 validator for GP Connect ARS/CareConnect-GPC profiles — using it to validate this project's FHIR STU3 resources would require reconfiguring `fhir_version` to `DSTU3` and adding the GP Connect STU3 IG packages, which is not how the repo ships. The line below has been corrected accordingly; treat any earlier claim that this "validates GP Connect ARS FHIR resources" out of the box as inaccurate.

> **Practical use:** As shipped, this validates FHIR **R4** resources (e.g. against UK Core/NHS England R4 profiles) with SNOMED CT terminology proxied to NHS Ontoserver. It provides a local FHIR validation endpoint, but is not preconfigured for this project's FHIR **STU3** GP Connect ARS profiles without additional IG package configuration.

### Architecture

```
Client → HAPI FHIR (port 8080) → TerminologyOperationInterceptor
                                         ↓
                              NHS Ontology Server (Ontoserver)
                              (OAuth2 Bearer token auto-injected)

Browser → Swagger UI → /fhir/swagger-ui/
                     → /fhir/api-docs (OpenAPI spec, XML patched in)
```

### Quick Start

```bash
# 1. Build Maven package
mvn package clean

# 2. Build and start Docker container
docker compose build --no-cache
docker compose up -d

# 3. Access
# Landing page:  http://localhost:8080
# Swagger UI:    http://localhost:8080/fhir/swagger-ui/
# FHIR endpoint: http://localhost:8080/fhir
```

### Configuration — Environment Variables (`.env` file)

```bash
ONTO_AUTH_URL=https://ontology.nhs.uk/authorisation/auth/realms/nhs-digital-terminology/protocol/openid-connect/token
ONTO_CLIENT_ID=your-client-id
ONTO_CLIENT_SECRET=your-client-secret
ONTO_SERVER_URL=https://ontology.nhs.uk/production1/fhir
```

> You need a system-to-system account from the [NHS England Terminology Server](https://digital.nhs.uk/services/terminology-server#how-to-access-this-service) to get credentials.

### Adding Implementation Guide Packages

Edit `hapi.application.yaml` under `hapi.fhir.implementationguides`, or use:
```bash
python3 update-packages.py
```

### Terminology Operations Proxied to NHS Ontoserver

The interceptor forwards these operations to NHS Ontology Server automatically:
- `$expand` — expand a ValueSet
- `$validate-code` — check if a code is valid in a ValueSet/CodeSystem
- `$lookup` — look up a concept
- `$translate` — translate a concept between code systems

Without this proxy, HAPI cannot expand SNOMED CT ValueSets as it does not hold terminology content locally.

### Logical URLs Configured

The `hapi.application.yaml` marks these as logical (remote) URLs so HAPI does not try to resolve them locally:

| System | URL pattern |
|---|---|
| SNOMED CT | `http://snomed.info/*`, `https://snomed.info/*` |
| HL7 Terminology | `http://terminology.hl7.org/*`, `https://terminology.hl7.org/*` |
| dm+d | `https://dmd.nhs.uk*` |
| ICD-10 | `http://hl7.org/fhir/sid/icd-10*`, `https://icd.who.int/browse10*` |
| Read Codes | `http://read.info*` |
| NICIP | `https://nicip.nhs.uk*` |
| OPCS-4 | `http://www.datadictionary.nhs.uk/data_dictionary/attributes/o/opcs_4*` |

### Testing Terminology Expansion

```bash
curl -X POST "http://localhost:8080/fhir/ValueSet/\$expand" \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Parameters",
    "parameter": [{
      "name": "url",
      "valueUri": "http://snomed.info/sct?fhir_vs=isa/73211009"
    }]
  }'
```

### MCP Server Integration

The HAPI server exposes a Model Context Protocol (MCP) endpoint at `/mcp/messages` for AI tooling integration:

```json
{
  "mcpServers": {
    "hapi": {
      "command": "npx",
      "args": ["mcp-remote@latest", "http://localhost:8080/mcp/messages"]
    }
  }
}
```

This allows Claude (Desktop) or Cursor to query FHIR resources directly from the validation server.

### Java Source Components

| File | Purpose |
|---|---|
| `TerminologyInterceptor.java` | OAuth2 token lifecycle management (fetch, cache, refresh 60s before expiry) |
| `TerminologyOperationInterceptor.java` | Spring servlet filter — intercepts and proxies terminology requests |
| `TerminologyFilterConfig.java` | Registers both filters with Spring Boot |
| `OpenApiCustomizer.java` | Patches OpenAPI spec to add `application/fhir+xml` to Swagger UI |

---

## Development Setup Summary

To set up a complete local GP Connect ARS development and validation environment:

### 1. Clone the ARS OpenAPI spec and sandbox

```bash
git clone https://github.com/NHSDigital/gp-connect-access-record-structured-fhir.git
cd gp-connect-access-record-structured-fhir
make install
make serve   # Preview OpenAPI spec locally
```

### 2. Run the FHIR Validation server

```bash
git clone https://github.com/NHSDigital/FHIR-Validation.git
cd FHIR-Validation
cp .env.example .env   # Fill in NHS Ontoserver credentials
mvn package
docker compose up -d
# → http://localhost:8080/fhir/swagger-ui/
```

> By default this starts an **R4** validator (`fhir_version: R4` in `hapi.application.yaml`) — see the correction under section 4 above. To validate this project's FHIR STU3 GP Connect ARS resources, `fhir_version` and `implementationguides` would need to be reconfigured for STU3/CareConnect-GPC packages first; unverified whether/how that is supported.

### 3. Run FHIR asset validation

```bash
git clone https://github.com/NHSDigital/IOPS-FHIR-Test-Scripts.git
cd IOPS-FHIR-Test-Scripts
npm install
# Start validation service first (step 2), then:
npm test -- --examples=../your-fhir-examples
```

> **Unverified against current repo (checked 19 Jul 2026):** the live `IOPS-FHIR-Test-Scripts` repo tree has no root `package.json`, no `/src/`, and no `npm test` entry point — see the correction under section 3 above. This three-line quick-start may no longer work as written; the repo's actual current CI usage is via the `masterfhirvalidation.yml` reusable workflow (Docker-image based), not a local `npm install && npm test` flow.

### 4. Reference NHS England FHIR R4 profiles

```bash
git clone https://github.com/NHSDigital/NHSEngland-FHIR-ImplementationGuide.git
# Add to HAPI via hapi.application.yaml implementationguides section
```

---

## Sources

- https://github.com/NHSDigital/gp-connect-access-record-structured-fhir
- https://github.com/NHSDigital/NHSEngland-FHIR-ImplementationGuide
- https://github.com/NHSDigital/IOPS-FHIR-Test-Scripts
- https://github.com/NHSDigital/FHIR-Validation
- https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir (version/status verified 19 Jul 2026)
- https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir/clinical-assurance-process-details
- https://digital.nhs.uk/services/terminology-server
- https://simplifier.net/guide/gp-connect-access-record-structured/Home/Build/API-version-compatibility?version=current (ARS Implementation Guide version 1.6.2, referenced for the version conflict noted above)
