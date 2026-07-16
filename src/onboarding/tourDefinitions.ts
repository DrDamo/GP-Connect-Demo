export type TourId = 'home' | 'clinical-view' | 'inspector' | 'builder'

export type OnboardingTab = 'clinical' | 'raw' | 'validation' | 'inspector' | 'training' | 'builder' | 'patients' | 'account' | 'app-guide'

export interface TourStep {
  target: string
  title: string
  body: string
  tab?: OnboardingTab
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export interface TourDefinition {
  id: TourId
  label: string
  steps: TourStep[]
}

export const TOURS: Record<TourId, TourDefinition> = {
  home: {
    id: 'home',
    label: 'Getting started',
    steps: [
      {
        target: 'home-file-upload',
        title: 'Load a patient record',
        body: 'Drag a GP Connect FHIR file here, or click to browse. Accepts JSON or XML bundles.',
        placement: 'right',
      },
      {
        target: 'home-paste-json',
        title: 'Or paste JSON directly',
        body: "Got FHIR JSON on your clipboard instead of a file? Toggle this to paste it straight in.",
        placement: 'right',
      },
      {
        target: 'home-sample-data',
        title: 'Try it with sample data',
        body: 'No file handy? Load the full GP Connect sample, or a smaller medications-only sample, to explore the app immediately.',
        placement: 'right',
      },
      {
        target: 'home-shared-patients',
        title: 'Shared patients',
        body: 'Your organisation can save synthetic patients here for the whole team to reuse — this opens that shared library.',
        placement: 'left',
      },
      {
        target: 'home-builder',
        title: 'Building a test patient?',
        body: 'Prefer to construct a record yourself rather than upload one? The Record Builder lets you create a fully synthetic GP Connect patient from scratch.',
        placement: 'left',
      },
    ],
  },
  'clinical-view': {
    id: 'clinical-view',
    label: 'Clinical View basics',
    steps: [
      {
        target: 'clinical-patient-banner',
        title: 'Your patient',
        body: 'This bar always shows who you’re looking at. Click anywhere on it to expand full contact and registration details.',
        tab: 'clinical',
        placement: 'bottom',
      },
      {
        target: 'clinical-domain-nav',
        title: 'Clinical areas',
        body: 'Each item here is a different clinical domain — Medications, Problems, Consultations, and so on. The number badge shows how many records are in that area.',
        tab: 'clinical',
        placement: 'right',
      },
      {
        target: 'clinical-domain-content',
        title: 'Click a row to expand it',
        body: 'Rows expand in place to show full detail — clinician, organisation, dates, and any linked records.',
        tab: 'clinical',
        placement: 'top',
      },
      {
        target: 'clinical-training-link',
        title: 'Need clinical/FHIR background instead?',
        body: 'This separate link opens GP Connect domain training for the currently active area — different from the App Guide, which only covers how to use this app.',
        tab: 'clinical',
        placement: 'left',
      },
    ],
  },
  inspector: {
    id: 'inspector',
    label: 'Inspector basics',
    steps: [
      {
        target: 'inspector-domain-nav',
        title: 'Same domains, source view',
        body: 'This mirrors Clinical View’s areas, but selecting a row here highlights its exact FHIR source on the right instead of showing a formatted view.',
        tab: 'inspector',
        placement: 'right',
      },
      {
        target: 'inspector-source-pane',
        title: 'Raw FHIR source',
        body: 'The matching resource is highlighted here. Some clinical items span several FHIR resources — use the section navigator to step between them.',
        tab: 'inspector',
        placement: 'left',
      },
      {
        target: 'inspector-search',
        title: 'Search the source',
        body: 'Find text anywhere in the currently displayed resources; Enter/Shift+Enter move between matches.',
        tab: 'inspector',
        placement: 'bottom',
      },
    ],
  },
  builder: {
    id: 'builder',
    label: 'Record Builder basics',
    steps: [
      {
        target: 'builder-domain-nav',
        title: 'Record sections',
        body: 'Build a synthetic patient section by section — Admin, Medications, Problems, Consultations, and more. Badges show how many entries you’ve added so far.',
        tab: 'builder',
        placement: 'right',
      },
      {
        target: 'builder-auto-populate',
        title: 'Auto-populate',
        body: 'Instantly fills the whole record with realistic randomised NHS test data — a fast way to get a complete example, which you can then edit freely.',
        tab: 'builder',
        placement: 'bottom',
      },
      {
        target: 'builder-preview',
        title: 'Preview before you commit',
        body: 'Builds the FHIR bundle from your current draft and shows you the JSON plus any validation errors, without leaving the Builder.',
        tab: 'builder',
        placement: 'bottom',
      },
      {
        target: 'builder-load-into-viewer',
        title: 'Load into viewer',
        body: 'Builds the bundle and switches straight into Clinical View / Inspector with it loaded, so you can see exactly how your synthetic patient renders.',
        tab: 'builder',
        placement: 'bottom',
      },
      {
        target: 'builder-save-shared',
        title: 'Save to your organisation',
        body: 'Saves this draft to a shared library everyone in your organisation can load and continue editing. Saving again later updates the same record and bumps its version number.',
        tab: 'builder',
        placement: 'bottom',
      },
    ],
  },
}
