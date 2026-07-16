export interface HintContent {
  title: string
  body: string
  guideFile: string
  guideAnchor: string
}

export const HINTS: Record<string, HintContent> = {
  'home.paste-json': {
    title: 'Paste JSON',
    body: 'Paste a full Bundle, a partial bundle, or even a single FHIR resource — the app will parse whatever’s on the clipboard.',
    guideFile: 'overview', guideAnchor: 'pasting-json',
  },
  'home.sample-full': {
    title: 'Full GP Connect sample',
    body: 'Covers every clinical domain (medications, problems, consultations, and more) — good for exploring the whole app.',
    guideFile: 'overview', guideAnchor: 'sample-data',
  },
  'home.sample-meds': {
    title: 'Medications-only sample',
    body: 'A smaller bundle with medications only — loads instantly with no download.',
    guideFile: 'overview', guideAnchor: 'sample-data',
  },
  'clinical.patient-banner.nhs-verified': {
    title: 'NHS number verification',
    body: 'A tick or warning icon next to the NHS number shows whether it’s been traced/verified against the national spine — not just whether it’s present.',
    guideFile: 'clinical-view', guideAnchor: 'nhs-number-verification',
  },
  'clinical.consultations.items-count': {
    title: '“Items” column',
    body: 'This is a computed total of every coded item recorded under the consultation’s topics — not a single FHIR field.',
    guideFile: 'clinical-view', guideAnchor: 'consultation-items-count',
  },
  'clinical.consultations.topic-numbers': {
    title: 'Circled topic numbers',
    body: 'These numbers just distinguish multiple topics recorded in one consultation; they aren’t clinical codes.',
    guideFile: 'clinical-view', guideAnchor: 'consultation-topics',
  },
  'clinical.consultations.item-click-zones': {
    title: 'Two click zones, one card',
    body: 'Clicking an item’s coloured badge jumps to that record’s own domain tab. Clicking the rest of the card instead opens its raw FHIR source.',
    guideFile: 'clinical-view', guideAnchor: 'two-kinds-of-jump-link',
  },
  'clinical.medications.subtabs': {
    title: 'Medication sub-tabs',
    body: 'Medications are split by prescription type — Acute, Repeat, Repeat Dispensing, Prescribed Elsewhere, Past, Other. “Past” collects anything no longer active, still grouped by its original type underneath.',
    guideFile: 'clinical-view', guideAnchor: 'medication-sub-tabs',
  },
  'clinical.medications.status-colours': {
    title: 'Status colours',
    body: 'Green = active, grey = completed, red = stopped/error, yellow = on hold, blue = intended.',
    guideFile: 'clinical-view', guideAnchor: 'medication-status-colours',
  },
  'clinical.medications.issues-detail': {
    title: 'Issue detail',
    body: 'Each dispensing/issue event has its own “Detail” button, one level deeper than the prescription’s own “Show detail” toggle.',
    guideFile: 'clinical-view', guideAnchor: 'medication-issues',
  },
  'clinical.immunisations.procedure-vs-vaccine': {
    title: 'Procedure vs. Vaccine',
    body: '“Procedure” is the vaccination procedure performed; “Vaccine” is the product given. They’re recorded separately and one may be blank.',
    guideFile: 'clinical-view', guideAnchor: 'procedure-vs-vaccine',
  },
  'clinical.immunisations.observation-badge': {
    title: '“Observation” badge',
    body: 'This entry came from a generic Observation resource rather than a dedicated Immunization resource — that’s why it has fewer fields.',
    guideFile: 'clinical-view', guideAnchor: 'immunisation-observation-badge',
  },
  'clinical.investigations.flag-colours': {
    title: 'Result flag colours',
    body: 'Red = high/critical high, blue = low/critical low, green = normal, amber = other abnormal/outside-range. Blue for “low” catches people expecting red to mean all abnormal results.',
    guideFile: 'clinical-view', guideAnchor: 'investigation-flag-colours',
  },
  'clinical.investigations.degrade-badge': {
    title: '“Degrade” badge',
    body: '“Degrade” means this result’s data was degraded in transit between systems — a GP Connect transfer caveat, not a clinical flag.',
    guideFile: 'clinical-view', guideAnchor: 'degraded-data-badge',
  },
  'clinical.investigations.grouping': {
    title: 'Test group flattening',
    body: 'When a report only has one unnamed test group, the app hides the redundant group header and shows the results directly.',
    guideFile: 'clinical-view', guideAnchor: 'test-groups',
  },
  'clinical.coded-data.scope-note': {
    title: 'What’s excluded here',
    body: 'Laboratory results are deliberately excluded here — see Investigations instead.',
    guideFile: 'clinical-view', guideAnchor: 'coded-data-scope',
  },
  'clinical.coded-data.bp-pairing': {
    title: 'Blood pressure pairing',
    body: 'When a result has separate “systolic”/“diastolic” components, they’re combined into one “120/80 mmHg” display.',
    guideFile: 'clinical-view', guideAnchor: 'blood-pressure-pairing',
  },
  'clinical.search-filter': {
    title: 'Search this section',
    body: 'Filters the table below to records matching your text — including matches only found inside collapsed detail, like a prescriber name or a dosage note that’s hidden until you expand a row.',
    guideFile: 'clinical-view', guideAnchor: 'searching-a-section',
  },
  'clinical.reference-chip': {
    title: 'Reference chips',
    body: 'Click a clinician or organisation name like this to reveal a quick mini-profile inline, without leaving the page.',
    guideFile: 'clinical-view', guideAnchor: 'reference-chips',
  },
  'clinical.resource-card': {
    title: 'Referenced resources',
    body: 'This lists every person, place, or record referenced by the current item. “Not included in this bundle” means that referenced item wasn’t part of the file you loaded.',
    guideFile: 'clinical-view', guideAnchor: 'referenced-resources',
  },
  'inspector.text-selection-popup': {
    title: 'Select to copy or search',
    body: 'Selecting any text in the source pane pops up quick Copy / Search actions for that selection.',
    guideFile: 'inspector', guideAnchor: 'text-selection',
  },
  'inspector.jump-from-elsewhere': {
    title: 'Jumping in from elsewhere',
    body: 'Clicking “View FHIR” anywhere else in the app brings you here, already scrolled to and highlighting the right resource.',
    guideFile: 'inspector', guideAnchor: 'jumping-to-source',
  },
  'raw-source.copy-whole-file': {
    title: 'Copy the whole file',
    body: 'Copies the entire loaded file to your clipboard, not just a selection.',
    guideFile: 'raw-source', guideAnchor: 'copy',
  },
  'raw-source.vs-inspector': {
    title: 'Raw Source vs. Inspector',
    body: 'This shows the whole unmodified file with no highlighting. Use Inspector instead if you want to jump straight to one clinical item’s source.',
    guideFile: 'raw-source', guideAnchor: 'raw-source-vs-inspector',
  },
  'validation.clean-refs': {
    title: 'Remove dangling refs',
    body: 'Downloads a corrected copy of your file with dangling references removed, and immediately reloads that cleaned version here so you can confirm the fix.',
    guideFile: 'validation', guideAnchor: 'cleaning-dangling-references',
  },
  'validation.tab-badge': {
    title: 'Tab badge',
    body: 'The Validation tab shows a live error/warning count badge even before you open it.',
    guideFile: 'validation', guideAnchor: 'reading-the-results',
  },
  'builder.clear-all': {
    title: 'Clear all',
    body: 'Wipes the entire current draft. This can’t be undone.',
    guideFile: 'builder', guideAnchor: 'clear-all',
  },
  'builder.dirty-guard': {
    title: 'Unsaved changes guard',
    body: 'If you have unsaved changes, leaving the Builder tab or closing the browser will ask you to confirm first.',
    guideFile: 'builder', guideAnchor: 'unsaved-changes',
  },
  'builder.dmd-picker': {
    title: 'dm+d medication search',
    body: 'Search dm+d medication codes as you type. Toggle between generic (VMP) and branded (AMP) products; you can still type free text if nothing matches.',
    guideFile: 'builder', guideAnchor: 'medication-coding',
  },
  'builder.snomed-picker': {
    title: 'SNOMED CT search',
    body: 'Search SNOMED CT codes as you type. A coloured badge shows the kind of concept found (disorder, finding, procedure, etc.).',
    guideFile: 'builder', guideAnchor: 'snomed-coding',
  },
  'builder.topics-categories-items': {
    title: 'Topics, categories, items',
    body: 'Each consultation is built from Topics, which contain Categories (like History, Examination, Plan), which contain individual Items — either free text or a coded observation.',
    guideFile: 'builder', guideAnchor: 'consultation-structure',
  },
  'builder.lists-readonly': {
    title: 'Lists are generated',
    body: 'The Lists section is generated automatically from everything else you’ve built — it can’t be edited directly.',
    guideFile: 'builder', guideAnchor: 'lists',
  },
  'builder.delete-warning': {
    title: 'Deletion is permanent',
    body: 'Deleting here is a Builder-only action for test data — it isn’t how deletion works in a real GP clinical system, and there’s no undo.',
    guideFile: 'builder', guideAnchor: 'deleting-entries',
  },
  'account.org-name-locked': {
    title: 'Organisation name locked',
    body: 'Only an organisation admin can rename the organisation — everyone else sees this field disabled.',
    guideFile: 'account', guideAnchor: 'organisation',
  },
  'account.billing-placeholder': {
    title: 'Billing not active yet',
    body: 'Billing isn’t active yet — this section is a placeholder for a future paid plan.',
    guideFile: 'account', guideAnchor: 'billing',
  },
  'shared.load-into-builder': {
    title: 'Load into Builder',
    body: 'Loads this record into the Builder as an editable draft — it doesn’t jump straight into the clinical viewer. Use Builder’s “Load into viewer” afterward to see it there.',
    guideFile: 'shared-patients', guideAnchor: 'loading-a-shared-record',
  },
  'shared.version-badge': {
    title: 'Version badge',
    body: 'Each save to this record increases its version number, so your team can tell which copy is newest.',
    guideFile: 'shared-patients', guideAnchor: 'versioning',
  },
}
