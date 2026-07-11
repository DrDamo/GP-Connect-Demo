import { DOMAINS } from '../components/clinical/domains'

interface LandingPageProps {
  onSignIn: () => void
  onSignUp: () => void
}

const PLATFORM_FEATURES = [
  {
    title: 'Structured clinical record viewer',
    description: 'Browse a GP Connect Access Record Structured bundle the way a clinician would — by domain, not by raw FHIR resource.',
  },
  {
    title: 'Bundle builder',
    description: 'Construct custom FHIR test bundles from scratch, or edit an existing one, without hand-writing JSON.',
  },
  {
    title: 'Validation & inspection',
    description: 'Validate bundles against GP Connect STU3 expectations, then jump straight from a clinical view to the exact FHIR resource behind it.',
  },
  {
    title: 'Built-in training content',
    description: 'Domain-by-domain training notes to help new starters learn how GP Connect structures a patient record.',
  },
  {
    title: 'Shared patient scenarios',
    description: 'Save a bundle to your organisation\'s shared library so your whole team can reuse the same test patients.',
  },
  {
    title: 'Raw source & round-trip',
    description: 'Switch between the parsed clinical view and the raw JSON/XML source at any time — nothing is hidden.',
  },
]

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-nhs-grey-5 dark:bg-gray-950">
      <header className="bg-nhs-blue text-white shadow-md">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white text-nhs-blue font-extrabold text-sm px-2 py-1 rounded leading-tight">NHS</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">GP Connect Demonstrator</h1>
              <p className="text-xs opacity-75 leading-tight">Access Record Structured · FHIR STU3</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSignIn}
              className="text-sm font-medium px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={onSignUp}
              className="text-sm font-medium px-3 py-1.5 rounded bg-white text-nhs-blue hover:opacity-90 transition-opacity"
            >
              Create free account
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-screen-xl mx-auto px-4 py-16 md:py-24 text-center">
        <p className="text-nhs-blue dark:text-nhs-blue-light font-semibold text-sm uppercase tracking-wide mb-3">
          For GP Connect integrators, testers &amp; trainers
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-nhs-grey-1 dark:text-gray-100 max-w-3xl mx-auto leading-tight">
          Explore, build and validate GP Connect structured records
        </h2>
        <p className="text-base md:text-lg text-nhs-grey-2 dark:text-gray-400 max-w-2xl mx-auto mt-5">
          A single workspace for viewing GP Connect Access Record Structured bundles as clinicians see them,
          building your own test bundles, validating them against FHIR STU3, and training your team — without
          touching a real patient record.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <button
            onClick={onSignUp}
            className="bg-nhs-blue text-white px-6 py-3 rounded text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            Create your free account
          </button>
          <button
            onClick={onSignIn}
            className="bg-white dark:bg-gray-900 text-nhs-blue dark:text-nhs-blue-light border border-nhs-grey-4 dark:border-gray-700 px-6 py-3 rounded text-sm font-semibold hover:bg-nhs-grey-5 dark:hover:bg-gray-800 transition-colors"
          >
            Sign in
          </button>
        </div>
        <p className="text-xs text-nhs-grey-3 dark:text-gray-600 mt-4">No card required · Not a clinical system · For testing and demonstration only</p>
      </section>

      {/* Platform features */}
      <section className="max-w-screen-xl mx-auto px-4 pb-16">
        <h3 className="text-xl font-semibold text-nhs-grey-1 dark:text-gray-100 text-center mb-8">
          Everything you need to work with a GP Connect record
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLATFORM_FEATURES.map(feature => (
            <div key={feature.title} className="bg-white dark:bg-gray-900 rounded-xl border border-nhs-grey-4 dark:border-gray-700 p-5">
              <h4 className="font-semibold text-nhs-grey-1 dark:text-gray-100 mb-1.5">{feature.title}</h4>
              <p className="text-sm text-nhs-grey-2 dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Clinical domains covered */}
      <section className="bg-white dark:bg-gray-900 border-y border-nhs-grey-4 dark:border-gray-700">
        <div className="max-w-screen-xl mx-auto px-4 py-16">
          <h3 className="text-xl font-semibold text-nhs-grey-1 dark:text-gray-100 text-center mb-2">
            Every GP Connect clinical domain, in one place
          </h3>
          <p className="text-sm text-nhs-grey-2 dark:text-gray-400 text-center max-w-2xl mx-auto mb-8">
            {DOMAINS.length} structured domains, mapped to the FHIR resources that carry them.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {DOMAINS.map(domain => (
              <div key={domain.id} className="bg-nhs-grey-5 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium text-sm text-nhs-grey-1 dark:text-gray-100 mb-1">{domain.label}</h4>
                <p className="text-xs text-nhs-grey-3 dark:text-gray-500">{domain.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-screen-xl mx-auto px-4 py-16 text-center">
        <h3 className="text-2xl font-semibold text-nhs-grey-1 dark:text-gray-100 mb-3">
          Ready to try it with your own team?
        </h3>
        <p className="text-sm text-nhs-grey-2 dark:text-gray-400 max-w-xl mx-auto mb-6">
          Create a free account and get your own organisation workspace in seconds.
        </p>
        <button
          onClick={onSignUp}
          className="bg-nhs-blue text-white px-6 py-3 rounded text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          Create your free account
        </button>
      </section>

      <footer className="border-t border-nhs-grey-4 dark:border-gray-700">
        <div className="max-w-screen-xl mx-auto px-4 py-6 text-center text-xs text-nhs-grey-3 dark:text-gray-600">
          GP Connect Demonstrator · Not a clinical system · For testing and demonstration only
        </div>
      </footer>
    </div>
  )
}
