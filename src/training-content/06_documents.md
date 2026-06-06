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

The GP Connect **Access Document** capability (GP Connect API 1.5.1-beta) allows:
- Querying for documents by patient
- Retrieving specific documents using the URL from the `DocumentReference`

Access Document is a **separate assurance and onboarding** process from ARS.

---

## Documents in Consultations Secondary List

When consultations are requested, any linked documents are identified via:
- Secondary list: `Consultations - documents contained in consultations`

When problems are requested:
- Secondary list: `Problems - documents related to problems`

---

## Source URLs

- Design guidance: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Documents-Guidance?version=current
- Access Document API: https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-document-fhir

