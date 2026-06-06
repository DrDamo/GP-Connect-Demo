# GP Connect Access Record: Structured — Referrals (Outbound)

**Source:** https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Referrals-Guidance  
**FHIR Profile:** `CareConnect-GPC-ReferralRequest-1`

---

## What Is an Outbound Referral?

GP Connect returns **outbound referral events** as recorded in the GP system's referral feature — the event of a referral being made or an intention to refer.

It does NOT reflect:
- Acceptance by the recipient
- Onward progress of the referral
- Inbound referrals (these are returned as Uncategorised Data)

---

## Request Parameters

```json
{
  "name": "includeReferrals",
  "part": [
    { "name": "referralSearchPeriod", "valuePeriod": { "start": "2019-01-25", "end": "2019-06-25" } }
  ]
}
```

Search is based on `ReferralRequest.authoredOn` date.

---

## ReferralRequest — Key Elements

| Element | Optionality | Notes |
|---------|-------------|-------|
| `id` | Mandatory | Unique business identifier |
| `status` | Mandatory | Always `unknown` |
| `intent` | Mandatory | `proposal` or `order` |
| `reasonCode` | Mandatory | Main coded classification (READ or SNOMED CT) |
| `subject` | Mandatory | Reference to Patient |
| `authoredOn` | Mandatory | User-entered referral date |
| `requester.agent` | Required | Practitioner who recorded the referral |
| `requester.onBehalfOf` | Conditional | GP practice if different from practitioner's org |
| `priority` | Optional | Mapped to eRS priority codes only |
| `serviceRequested` | Optional | Service being referred to |
| `specialty` | Optional | Clinical specialty |
| `recipient` | Optional | Organisation/practitioner referred to |
| `identifier` | Required if UBRN present | NHS eRS Unique Booking Reference Number |
| `note` | Optional | Additional detail, status progress, or priority not in eRS codes |
| `supportingInfo` | Optional | Related documents |

---

## Referral Classification

The main coded field in GP systems does not cleanly align to a single FHIR element. Analysis showed that referral codes can represent:
- The reason for referral (e.g., "Chest pain")
- The service referred to (e.g., "Cardiology referral")
- A procedure (e.g., "Refer for ultrasound")

**Decision:** The main code is returned in `reasonCode`. Providers MAY additionally populate `serviceRequested`, `specialty`, `reasonCode` (multiple), `supportingInfo`, and/or `note` as appropriate.

> ⚠️ Consumers should be aware that `reasonCode` may contain codes outside the strict referral hierarchy.

---

## Referral Status

**Always `unknown`** — GP systems don't standardise referral status values, and practices may only learn of status changes retrospectively.

> ⚠️ Consumers MUST NOT portray referrals as indicating current involvement by recipients.

---

## Referral Priority

Mapped to eRS priority codes:

| eRS Priority | Code |
|-------------|------|
| Urgent | `urgent` |
| Routine | `routine` |
| Two-week wait | `asap` |
| Soon | `stat` |

If source system priority cannot be mapped to eRS codes → priority omitted, placed in `note` as key/value pair.

---

## NHS eRS Referrals

eRS referrals MUST be included where recorded in the GP system. The UBRN MUST be included as an identifier:

```json
{
  "identifier": [{
    "system": "https://fhir.nhs.uk/Id/UBRN",
    "value": "000000000001"
  }]
}
```

Note: eRS referrals may have limited detail (recipient not specified, generic reasonCode).

---

## Date of Referral

`authoredOn` is the **user-entered referral date**. Its exact meaning may vary slightly by GP system.

---

## Inbound Referrals

Inbound referrals are returned as **Uncategorised Data** (Observation resources).

Self-referrals: text "Self referral" MUST be included in the `comment` element.

---

## List Returned for Referrals

| List SNOMED Code | Title |
|-----------------|-------|
| `792931000000107` | Outbound referral |

---

## FHIR Examples

See `fhir_examples/`:
- `referral_example_request.json`
- Examples: https://simplifier.net/guide/gp-connect-access-record-structured/Home/Examples/Referral-examples?version=current

