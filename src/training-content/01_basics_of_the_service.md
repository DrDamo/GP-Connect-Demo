# GP Connect Access Record: Structured — Basics of the Service

**Source:** NHS England Digital | **Last updated on source:** 12 May 2026  
**URL:** https://digital.nhs.uk/services/gp-connect

---

## What Is GP Connect?

GP Connect is a national NHS service that securely connects approved clinical and care systems to GP records, supporting **direct patient care outside the GP practice**. It provides health and care staff with secure access to a patient's GP record when patients are treated away from their registered GP practice.

GP Connect is **not**:
- Used beyond direct patient care
- A replacement for local clinical systems or records
- Accessed directly by patients (though patient-facing APIs are in development)

---

## What Is Access Record: Structured?

**Access Record: Structured (ARS)** is one of the GP Connect products. It provides access to a patient's GP care record in a **machine-readable, structured, coded format** that can be:
- Imported into consuming systems
- Processed and interpreted by software
- Displayed to clinicians in different sections

This is distinct from **Access Record: HTML** (which provides a read-only view of the entire record as a document) and **Access Document** (which retrieves attached clinical documents).

### Scope of ARS

The capability exposes data for these clinical areas:

| Clinical Area | Status (as of 2025/2026) |
|---------------|--------------------------|
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

> **'FoT'** = First of Type — an iterative cycle for development, self-assessment, assurance and live deployment.

### What Is NOT in scope

- Extended demographics (e.g., carers)
- Flags and alerts
- Templates
- Test requests (except as part of investigation reports)
- Inbound referrals (returned as Uncategorised Data)
- Writing back to the GP record

---

## FHIR Standard Used

GP Connect Access Record: Structured uses **FHIR Standard for Trial Use 3 (STU3)** — the version current when development began. All profiles use the `https://fhir.nhs.uk/STU3/` namespace.

> The project is exploring an uplift to UKCore (FHIR R4) but this is ongoing. STU3 remains the operational version.

---

## Who Can Use It?

### Health and Care Professionals
- Clinicians working outside GP practices
- Professionals in community, urgent or non-acute settings
- Care home staff (filtered access for non-clinical staff)
- Pharmacists (community pharmacy — Access Record: Structured rollout from March 2025)
- Medical examiners (statutory purpose of reviewing deaths)

### Organisations
- NHS and other health organisations
- Social care organisations providing regulated care
- Must meet national requirements and use approved systems

### Common Use Cases
- Access GP medications on admission to secondary care
- Active checking of prescriptions in unscheduled care
- Out-of-hours GP accessing medications, allergies and problems
- Midwife/community nurse viewing record before visiting patient
- Care home staff viewing medication and allergy summary

---

## How GP Connect Works (Technical Summary)

1. **Consumer system** sends a FHIR API request to the **Spine Secure Proxy (SSP)**
2. SSP checks data-sharing agreements and routes the request to the **GP provider system**
3. GP provider system (EMIS Web, SystmOne, Medicus, Optum) returns patient data as a **FHIR Bundle**
4. Consumer system processes and displays the structured data

### Key Infrastructure Dependencies

| Service | Role |
|---------|------|
| Personal Demographics Service (PDS) | Retrieve patient's registered GP (ODS code) |
| Spine Directory Service (SDS) | Retrieve GP system endpoints |
| Spine Secure Proxy (SSP) | Route and authenticate all requests |
| HSCN | Network access (not currently available over internet) |

---

## National Usage Policy

### For Providers (GP practices)
- Providing access via GP Connect is **mandated** for all GP practices in England
- Mandated for GP software suppliers under **GP IT Futures** framework (and upcoming Digital Services for Integrated Care framework)
- As of the 2025/26 GP contract: practices must ensure GP Connect (HTML and Structured) is **enabled by 1 October 2025**

### For Consumers
- Use of GP Connect is **not generally mandated** for consuming organisations
- May be mandated by specific commercial frameworks
- Strongly recommended — can improve patient outcomes

### Data Sharing Restrictions
- **Only for direct patient care** (or medical examiner statutory purposes)
- No secondary use (planning, research) permitted
- Patient opt-out respected — a local **patient dissent to share flag** held within the GP practice system must be honoured when accessing the record, and **cannot be overridden** by consent given at the point of care
- RCGP sensitive dataset excluded (fertility, pregnancy terminations, gender reassignment, STDs)
- Data marked private, sealed, locked, or practice-confidential must not be shared outside the practice, as an additional protection beyond the RCGP exclusion set

> Source: [GP Connect Data Model Guide — Information Governance Principles](https://simplifier.net/guide/gpconnect-data-model/Home/Design/Information-governance-principles)

---

## GP Connect Products Overview

| Product | Description |
|---------|-------------|
| **Access Record: HTML** | Read-only view of full record as a document |
| **Access Record: Structured** | Structured, coded, machine-readable sections |
| **Access Document** | Unstructured documents attached to the GP record |
| **Update Record** | Update GP record from community pharmacy |
| **Send Document** | Attach consultation summary to GP record |
| **Patient Facing APIs** | Patient views own record via NHS App |

---

## Service Level

GP Connect is a **silver service**:
- Available **24 hours a day, 365 days a year**
- Supported **8am to 6pm, Monday to Friday** (excluding bank holidays)

---

## Current API Version

- **Working version:** 1.5.0 (beta for most clinical areas)
- **Medications and allergies:** Production (no breaking changes)
- **Other clinical areas:** Production beta (breaking changes possible with notice)

---

## Contact

| Enquiry Type | Contact |
|--------------|---------|
| General | gpconnect@nhs.net |
| Live service incidents | National Service Desk: ssd.nationalservicedesk@nhs.net / 0300 303 5035 |
| Strategic direction | shan.rahulan@nhs.net |
| Developer Community | https://developer.community.nhs.uk/ |

