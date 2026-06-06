# GP Connect Access Record: Structured — Assurance Process

**Sources:**  
- https://digital.nhs.uk/services/gp-connect/develop-gp-connect-services  
- https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir

---

## Overview

Before a consumer system can go live with GP Connect Access Record: Structured, it must complete a **formal assurance and onboarding process** managed by the GP Connect team at NHS England.

The process has two parallel streams:
1. **Technical assurance** — conformance to FHIR specifications
2. **Clinical safety assurance** — safe presentation and processing of clinical data

---

## Prerequisites

### Technical Prerequisites
- Access to the **Health and Social Care Network (HSCN)**
- **PDS-compliant** (Personal Demographics Service) or capable of PDS searches

### Information Governance Prerequisites
- Organisation must be compliant with **GP Connect Direct Care API Information Governance Model**
- Must manage access using **local Role-Based Access Control (RBAC)**
  - Does not need to be compliant with the national RBAC model
  - GP Connect does not require smartcards (though they can be used)
- APIs for direct care purposes for NHS patients in England only

### Clinical Safety Prerequisites
- Must have a **Clinical Safety Officer (CSO)** responsible for:
  - **DCB0129** (clinical risk management for manufacturers of health IT)
  - **DCB0160** (clinical risk management for health IT deployment) if applicable

---

## Step-by-Step Consumer Onboarding Process

### Step 1: Check Prerequisites
Review prerequisites on the consumer portal before contacting NHS England.

### Step 2: Submit a Use Case

Submit a use case to the GP Connect team explaining:
- How you plan to use GP Connect APIs
- The business problem being addressed

Submit via: **Use Case Submission Form** (contact gpconnect@nhs.net for access)

After submission:
- NHS England responds within **14 calendar days**
- Development must start within **6 months** of use case approval

### Step 3: Develop Against Specifications

- Develop against the GP Connect API 1.5.0-beta specification
- Use the **internet-facing demonstrator** (https://orange.testlab.nhs.uk/) for initial testing
- Provide evidence of interactions between your system and the demonstrator

### Step 4: Test in Integration Environment (INT)

- Once evidence is confirmed, access the **Integration (INT) environment**
- Test against the full NHS England system: PDS, SDS, Spine
- Must test against each GP provider system you expect to consume in live
- Submit test evidence as part of the **SCAL (Supplier Conformance Assessment List)**

### Step 5: Technical Conformance

- SCAL reviewed and approved by NHS England Solutions Assurance Team
- **Technical Conformance Certificate** issued — approval to deploy in live

### Step 6: First of Type (FoT) Process (if applicable)

Risk-based assessment in live covering:
- **Clinical safety** — no risk in clinical setting
- **Information governance** — patient data protected to agreed standards
- **Technical conformance** — works with other systems
- **Functional** — does what it was designed to do

### Step 7: Deployment Activities

- Communication to stakeholders
- Benefits baseline and realisation plan
- Training materials and business change overview
- Correct roles assigned to users
- Consent management where appropriate
- Implementation plan
- **Signing of the National Data Sharing Arrangement (NDSA)**
- Endpoint configuration
- Connection Agreement signing

---

## Clinical Assurance Process

NHS England supports three meetings:

### 1. Initial Meeting
- Consumer's Clinical Safety Officer meets with GP Connect clinical team
- Reviews the clinical safety standards applicable
- Introduces the clinical assurance process

### 2. Clinical Safety Process Readiness Review
- Assessment of clinical safety case and hazard log progress
- Reviews risks identified by the consumer

### 3. Clinical Evaluation of Readiness for Deployment
- Final review before go-live
- Formal acceptance of clinical risks and mitigations
- Recommendations for further actions if needed

---

## Clinical Safety Standards

Consumer suppliers must comply with:

| Standard | Description |
|----------|-------------|
| **DCB0129** | Clinical risk management for manufacturers of health IT systems — applies to the system supplier |
| **DCB0160** | Clinical risk management for deployment of health IT — applies to the consumer organisation |

These are accepted under Section 250 of the Health and Social Care Act 2012.

---

## Hazard Log

The **GP Connect Access Record: Structured Generic Hazard Log** identifies clinical risks of using GP Connect through a consumer system.

Consumers must:
1. Review the generic hazard log
2. Identify risks relevant to their system's use case
3. Record these in their **own system-specific hazard log**
4. Take mitigating action to ensure clinical safety

Key hazard areas include:
- Misinterpretation of allergies (resolved vs active)
- Drug allergy interoperability and prescribing safety
- Degraded medication records
- Data in transit (GP2GP transfers not yet complete)
- Confidential items not returned

---

## Connection Agreement

Before going live, the connecting party must sign a **Connection Agreement** outlining:
- Responsibilities and obligations
- Terms of use for consumers
- If previously signed for another NHS England product, must be signed again to include GP Connect terms

---

## National Data Sharing Arrangement (NDSA)

The **GP Connect NDSA** sets out data sharing requirements and obligations. All consuming organisations must sign this agreement, which:
- Ratifies safe sharing of clinical information
- Defines the scope (direct patient care only)
- Sets out audit and compliance requirements

---

## Approved Consumer Systems

Systems already assured as GP Connect consumers are listed publicly by NHS England.

To check supplier progress: https://digital.nhs.uk/services/gp-connect

---

## Assurance Process Diagram

```
Use case approved by NHS England
           │
           ▼
    Development to specifications
    (Clinical + Technical in parallel)
           │
           ▼
    Test in internet-facing demonstrator
    [Gate 1]
           │
           ▼
    Test in Integration (INT) environment
    [Gate 2]
           │
           ▼
    Test against providers via INT
    [Gate 3]
           │
           ▼
    SCAL completed + submitted
           │
           ▼
    Technical Conformance Certificate issued
           │
           ▼
    Sign Connection Agreement
           │
           ▼
    Enabled for use in live
```

---

## Key Contacts

| Contact | Detail |
|---------|--------|
| GP Connect team | gpconnect@nhs.net |
| Consumer portal | Available via NHS England onboarding |
| SCAL process | Via NHS England Solutions Assurance Team |

