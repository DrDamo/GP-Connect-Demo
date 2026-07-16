# App Guide: Clinical View

Clinical View is the main formatted view of a patient's record: a patient banner, a sidebar of clinical areas ("domains"), and a table of records for whichever domain is selected.

## The patient banner

The blue bar at the top always shows the patient you're looking at. If there's more to show (address, contacts, registered GP, and so on), the whole banner becomes clickable — click anywhere on it to expand, and again to collapse.

## NHS number verification

A green tick or amber warning icon next to the NHS number shows whether it's been traced/verified against the national spine — it does **not** simply mean the number is present. Hover the icon for the exact verification status text.

## Searching a section

Every clinical area has its own search box above the table. It filters to records that match your text anywhere — not just the columns visible in the table, but everything in that record, including fields only shown once a row is expanded (dosage notes, a prescriber's name, an issue's supply duration, a consultation's nested topics/items, and so on). A matching record stays in the filtered list even if the actual match is folded away inside its detail — expand it to see why it matched.

## Clinical areas (the sidebar)

Each item in the left sidebar is a different clinical domain — Medications, Allergies, Problems, Consultations, Immunisations, Investigations, Referrals, Diary Entries, Coded Data, Documents, Supporting Resources, and Lists. The number badge shows how many records exist in that area for the loaded patient.

## Two kinds of jump link

Throughout Clinical View you'll see two different-looking but easily confused links:
- **"View FHIR ↗"** opens the raw underlying FHIR resource for that exact item, in the Inspector tab.
- **"View in [domain] →"** (or clicking a coloured type badge) instead *navigates within the app* to that record's own home tab, without showing any FHIR source.

Learning to tell these apart is the single most useful thing to know about this screen.

## Data completeness warnings

If a clinical area's underlying FHIR `List` carries a warning code, an amber banner appears above the records for that domain. This currently covers two situations: **"Data in transit"** (still being transferred between systems) and **"Data awaiting filing"** (received but not yet filed) — either means the list for that area may be incomplete.

## Consultation items count

The "Items" column on the Consultations table is a computed total of every coded item recorded under a consultation's topics — it isn't a single FHIR field, so it can look larger than you'd expect from a quick skim of the record.

## Consultation topics

Consultations can record more than one topic in a single encounter. When they do, each topic gets a small circled number (①②③...) purely to distinguish them from each other — these are not clinical codes.

## Two click zones, one card

Inside an expanded consultation, each recorded item has two independent click zones: clicking its coloured type badge (e.g. "Medication", "Problem") jumps to that record's own domain tab, while clicking the rest of the card opens its raw FHIR source instead.

## Medication sub-tabs

The Medications domain has its own second-level tab bar, splitting prescriptions by type: **Acute, Repeat, Repeat Dispensing, Prescribed Elsewhere, Past,** and **Other**. "Past" is special — it collects anything no longer active from every other tab, but still sub-groups them by their original type so you can tell an old repeat from an old acute.

## Medication status colours

Status badges are colour-coded: green = active, grey = completed, red = stopped or entered in error, yellow = on hold, blue = intended.

## Medication issues

A repeat prescription's expanded row shows a quick summary strip (including "Issues to date", e.g. "3 of 6"), a "Show detail" toggle for the prescription itself, and — one level deeper still — an individual "Detail" button on each dispensing/issue event in the issues table.

## Procedure vs vaccine

On the Immunisations table, "Procedure" is the vaccination procedure that was performed, while "Vaccine" is the product that was given. These are recorded separately in FHIR, so one can be blank while the other isn't.

## Immunisation Observation badge

An "Observation" badge next to a Procedure value means that row actually came from a generic Observation resource pulled in via the Immunisations list, rather than a dedicated Immunization resource — that's why it may look sparser than other rows.

## Investigation flag colours

Investigation results are colour-coded: red for high/critically high, **blue for low/critically low**, green for normal, and amber for other abnormal or out-of-range results. The blue-for-low convention catches people who expect red to mean "any abnormal result".

## Degraded data badge

An amber "Degrade" badge on a result or group means that result's data was degraded while being transferred between systems — a GP Connect transfer caveat, not a clinical flag about the patient.

## Test groups

Investigation reports can contain one or more named "test groups" (panels of results). When a report has only one group and its name is empty or simply repeats the report title, the app hides that redundant group header and shows the results directly — so don't be surprised if a report's results appear without a group heading.

## Coded Data scope

The Coded Data domain is a catch-all for SNOMED-coded observations that don't fit any other named domain. **Laboratory investigation results are deliberately excluded** here — look in Investigations instead.

## Blood pressure pairing

When a Coded Data or Investigation result has separate "systolic" and "diastolic" named components, the app combines them into one reading, e.g. "120/80 mmHg", rather than showing two separate rows.

## Reference chips

Wherever a clinician or organisation is named inline (e.g. "Prescriber: Dr Smith"), it's rendered as a small clickable chip. Clicking it reveals a quick mini-profile inline, without navigating away from the page.

## Referenced resources

Most expanded detail panels end with a "Referenced resources" list — every person, place, or record referenced by that item, each independently expandable. If one shows "Not included in this bundle", it means that referenced resource simply wasn't part of the file you loaded, not that anything is broken.
