# App Guide: Record Builder

The Record Builder lets you hand-compose a fully synthetic GP Connect FHIR patient — useful for testing and demonstrations without needing a real extract.

## Building your first synthetic patient

A typical path through the Builder:
1. Open **Admin** and fill in patient demographics, or add a practitioner/organisation/location first if you want to reference them later.
2. Add a **Consultation**, then build it up with Topics → Categories → Items (see "Consultation structure" below).
3. Add **Medications** using the dm+d picker (see "Medication coding" below).
4. Click **Preview** to check the generated FHIR and see any validation errors.
5. **Save to shared**, **download as JSON**, or **Load into viewer** to see it rendered in Clinical View.

## Three ways a record can enter the Builder

- **Blank** — start from nothing.
- **Auto-populate** — instantly fills the whole record with realistic randomised NHS test data, which you can then edit freely.
- **Loading a shared draft** — pick up a record a teammate saved to your organisation's shared library (from the Shared Patients screen), continuing to edit it as a new version.

## Clear all

Wipes the entire current draft. This can't be undone, so use it deliberately.

## Unsaved changes

If you have unsaved changes, leaving the Builder tab or closing the browser tab will prompt you to confirm first, so work in progress isn't lost accidentally.

## Medication coding

The dm+d picker searches medication codes as you type, and lets you toggle between generic (VMP) and branded (AMP) products. If nothing matches, you can still type free text.

## SNOMED coding

The SNOMED CT picker works the same way for problems, consultation items, and other coded fields — a coloured badge on each result shows the kind of concept found (disorder, finding, procedure, substance, product, or observable).

## Consultation structure

Each consultation is built from **Topics**, which contain **Categories** (a fixed set like History, Examination, Assessment, Plan, plus many more real-world GP Connect categories), which in turn contain individual **Items** — either free text or a coded observation.

## Lists

The read-only "Lists" section is generated automatically from everything else you've built (Primary Lists per domain, Secondary Lists grouped by linkage) — it can't be edited directly, since it simply reflects the rest of the record.

## Deleting entries

Deleting an entry in the Builder is a test-data-only action — it isn't how deletion works in a real GP clinical system, and there's no undo, so confirmation dialogs appear at every deletable level.

## Saving to your organisation

"Save to shared" stores the draft to a shared library for your whole organisation. The first save asks for a name and optional description; every later save on the same record updates it in place and increases its version number, so your team can tell which copy is newest. See the Shared Patients guide for the loading side of this workflow.
