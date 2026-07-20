# GP Connect Access Record: Structured — Documents

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Documents-Guidance  
**Note:** Documents are primarily handled by the separate **Access Document** capability. ARS only returns document **metadata**.

---

## Overview

A clinical document is a written, printed or electronic record providing evidence of medical care. ARS does not retrieve document binary content — it returns `DocumentReference` resources containing **metadata only**.

---

## How Documents Appear in ARS Responses

Documents are returned as `DocumentReference` resources when querying for **Consultations** or **Problems** — where a document is linked to a consultation or problem.

### Rules
- `DocumentReference` resources contain **metadata only** (location, type, date)
- The **binary content** is NOT returned by ARS
- To retrieve the binary file, consumers must be assured for the **Access Document capability**
- The document location URL is returned so consumers can make a separate Access Document call

---

## DocumentReference Profile

**Profile:** `CareConnect-GPC-DocumentReference-1`

Key elements returned:

| Element | Description |
|---------|-------------|
| `id` | Unique identifier for the document reference |
| `status` | Document status |
| `type` | Type of document (coded) |
| `subject` | Reference to Patient |
| `created` | When the document was created |
| `indexed` | When indexed into the GP system |
| `author` | Who authored the document |
| `description` | Human-readable description |
| `content.attachment.url` | Location for retrieving the binary via Access Document |
| `content.attachment.contentType` | MIME type (e.g., `application/pdf`) |
| `context.encounter` | Linked consultation encounter |
| `context.practiceSetting` | Clinical setting |

---

## Relationship to Access Document Capability

The GP Connect **Access Document** capability allows:
- Querying for documents by patient
- Retrieving specific documents using the URL from the `DocumentReference`

Access Document is a **separate assurance and onboarding** process from ARS.

The Access Document search API's `author` parameter can only be used to search by **organisation** author — it **cannot** be used to search by practitioner author.

> 🔄 **Coming in v1.6.2 — clarified in release notes:** this organisation-only restriction is confirmed explicitly in the v1.6.2 release notes; treat it as current good practice, with the v1.6.2 text as the definitive source.

---

## Deceased Patients' Documents

- GP Connect API **1.5.0-beta** did not support access to a deceased patient's documents.
- **1.5.1-beta** introduced the ability for providers to access documents for deceased patients.
- **1.6.1** and **1.6.2** further clarified this guidance: providers **MAY** provide access to a deceased patient's documents, and clarify how providers **SHOULD** respond, including the error responses expected when access is attempted outside of the permitted access period for the Access Document 'Find a patient' and 'Search for a patient's document' APIs.

---

## Documents in Consultations Secondary List

When consultations are requested, any linked documents are identified via:
- Secondary list: `Consultations - documents contained in consultations`

When problems are requested:
- Secondary list: `Problems - documents related to problems`

---

## Security Labelling

> 🔄 **Coming in v1.6.2 — security labelling:** not present on the current v1.5.0 baseline.

`DocumentReference` resources **MAY** have `Meta.security` populated with a security label indicating information is not to be disclosed to the patient, in response to a retrieve-a-patient's-structured-record request (for applicable resources). This label **MUST** be populated on the equivalent migrate-a-patient's-record response, where applicable.

---

## Source URLs

- Design guidance: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Documents-Guidance?version=current
- Access Document API: https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-document-fhir
- Release notes (deceased patients v1.5.1+, 🔄 v1.6.2 items — author parameter clarification, security labelling): https://simplifier.net/guide/gp-connect-access-record-structured/Home/Introduction/Release-notes?version=1.6.2

