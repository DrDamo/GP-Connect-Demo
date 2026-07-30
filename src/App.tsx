import { useState, useCallback, useEffect, useRef } from 'react'
import { FileUpload } from './components/FileUpload'
import { ValidationPanel } from './components/ValidationPanel'
import { TrainingView } from './components/training/TrainingView'
import { RawSourceViewer } from './components/RawSourceViewer'
import { ClinicalView } from './components/clinical/ClinicalView'
import { InspectorView } from './components/InspectorView'
import { BuilderView } from './builder/views/BuilderView'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AuthGate } from './auth/AuthGate'
import { SharedPatientsView } from './shared/SharedPatientsView'
import { AccountPage } from './account/AccountPage'
import { isSupabaseConfigured } from './lib/supabase'
import { OnboardingProvider, useOnboarding } from './onboarding/OnboardingContext'
import { GuideNavProvider } from './onboarding/GuideNavContext'
import { TourOverlay } from './onboarding/TourOverlay'
import { HelpMenu } from './onboarding/HelpMenu'
import { InfoHint } from './onboarding/InfoHint'
import { AppGuideView, type GuidePageId } from './onboarding/AppGuideView'
import type { DraftRecord } from './builder/types'
import { parseBundle, normalizePastedJson } from './fhir/parser'
import { validateMedicationsBundle, cleanDanglingRefs } from './fhir/validator'
import { checkAndDegradeSnomedCodes, checkSnomedStatuses } from './fhir/snomedDegrade'
import { SnomedCheckingBanner } from './components/SnomedCheckingBanner'
import { extractMedications } from './fhir/medications'
import { extractAllergies } from './fhir/allergies'
import { extractProblems } from './fhir/problems'
import { extractConsultations } from './fhir/consultations'
import { extractImmunisations } from './fhir/immunisations'
import { extractInvestigations } from './fhir/investigations'
import { extractReferrals } from './fhir/referrals'
import { extractDiaryEntries } from './fhir/diaryEntries'
import { extractCodedData } from './fhir/codedData'
import { extractDocuments } from './fhir/documents'
import { extractPatientInfo, getOrganisationName } from './fhir/utils'
import { extractPractitioners, extractPractitionerRoles, extractOrganisations, extractHealthcareServices, extractLocations, extractFhirMedications } from './fhir/supportingResources'
import { extractLists } from './fhir/lists'
import type { ValidationResult, GpConnectMedicationsRecord } from './fhir/types'
import type { DomainId } from './components/clinical/domains'
import sampleBundle from './sample-data/medications-bundle.json'

type ActiveTab = 'clinical' | 'raw' | 'validation' | 'inspector' | 'training' | 'builder' | 'patients' | 'account' | 'app-guide'

interface LoadedBundle {
  source: string
  /** Source text before the SNOMED CT check degraded any codes — only set when a degradation happened, so a toggle can compare against it. */
  originalSource?: string
  filename: string
  label: string
  format: 'json' | 'xml'
  validation: ValidationResult
  record: GpConnectMedicationsRecord
}

function AppContent() {
  const { user, profile, isLoading, logout } = useAuth()
  const [loaded, setLoaded] = useState<LoadedBundle | null>(null)
  const [checkingSnomed, setCheckingSnomed] = useState(false)
  const [showOriginalSource, setShowOriginalSource] = useState(false)
  const snomedCheckTokenRef = useRef(0)
  const [tab, setTab] = useState<ActiveTab>('inspector')
  const [trainingPage, setTrainingPage] = useState<DomainId | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [jumpToId, setJumpToId] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pendingSharedDraft, setPendingSharedDraft] = useState<DraftRecord | null>(null)
  const [pendingSharedDraftId, setPendingSharedDraftId] = useState<string | null>(null)
  const [pendingSharedDraftVersion, setPendingSharedDraftVersion] = useState<number | null>(null)
  const [guidePage, setGuidePage] = useState<GuidePageId | null>(null)
  const [guideAnchor, setGuideAnchor] = useState<string | null>(null)
  const prevTabRef = useRef<ActiveTab>('inspector')
  const builderDirtyRef = useRef(false)

  const { startTour, isTourCompleted } = useOnboarding()

  // `tab` keeps its last value (e.g. 'clinical') while the home/get-started
  // screen is shown, since that screen is gated on `!loaded` rather than a
  // tab value of its own — so the header help menu needs this derived value
  // instead of raw `tab` to know what's actually on screen.
  const STANDALONE_TABS: ActiveTab[] = ['builder', 'account', 'patients', 'app-guide', 'training']
  const visibleTab: ActiveTab | 'home' =
    !loaded && !STANDALONE_TABS.includes(tab) ? 'home' : tab

  const handleOpenGuide = useCallback((guideFile: string, anchor: string) => {
    prevTabRef.current = tab
    setGuidePage(guideFile as GuidePageId)
    setGuideAnchor(anchor)
    setTab('app-guide')
  }, [tab])

  // Auto-trigger short contextual tours the first time a user reaches each area.
  useEffect(() => {
    if (!loaded && !isTourCompleted('home')) startTour('home')
  }, [loaded, isTourCompleted, startTour])

  useEffect(() => {
    if (loaded && tab === 'clinical' && !isTourCompleted('clinical-view')) startTour('clinical-view')
  }, [loaded, tab, isTourCompleted, startTour])

  useEffect(() => {
    if (tab === 'inspector' && !isTourCompleted('inspector')) startTour('inspector')
  }, [tab, isTourCompleted, startTour])

  useEffect(() => {
    if (tab === 'builder' && !isTourCompleted('builder')) startTour('builder')
  }, [tab, isTourCompleted, startTour])

  const handleBuilderDirtyChange = useCallback((isDirty: boolean) => {
    builderDirtyRef.current = isDirty
  }, [])

  const handleLoadSharedDraft = useCallback((draft: DraftRecord, id: string, version: number) => {
    setPendingSharedDraft(draft)
    setPendingSharedDraftId(id)
    setPendingSharedDraftVersion(version)
    setTab('builder')
  }, [])

  const handleJumpToSource = useCallback((id: string) => {
    setJumpToId(id)
    setTab('inspector')
  }, [])

  const handleOpenTraining = useCallback((domain: DomainId) => {
    prevTabRef.current = tab
    setTrainingPage(domain)
    setTab('training')
  }, [tab])

  const handleOpenAccount = useCallback(() => {
    prevTabRef.current = tab
    setTab('account')
  }, [tab])
  type ThemeMode = 'light' | 'dark' | 'system'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    } catch {}
    return 'system'
  })

  useEffect(() => {
    const apply = (isDark: boolean) => document.documentElement.classList.toggle('dark', isDark)
    try { localStorage.setItem('theme', themeMode) } catch {}
    if (themeMode === 'dark') { apply(true); return }
    if (themeMode === 'light') { apply(false); return }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(mq.matches)
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  const cycleTheme = () => setThemeMode(m => m === 'light' ? 'dark' : m === 'dark' ? 'system' : 'light')

  const buildRecordFromBundle = useCallback((data: fhir3.Bundle): GpConnectMedicationsRecord => ({
    patient: extractPatientInfo(data),
    practiceOrganisation: getOrganisationName(data),
    medications: extractMedications(data),
    allergies: extractAllergies(data),
    problems: extractProblems(data),
    consultations: extractConsultations(data),
    immunisations: extractImmunisations(data),
    investigations: extractInvestigations(data),
    referrals: extractReferrals(data),
    diaryEntries: extractDiaryEntries(data),
    codedData: extractCodedData(data),
    documents: extractDocuments(data),
    fhirMedications: extractFhirMedications(data),
    practitioners: extractPractitioners(data),
    practitionerRoles: extractPractitionerRoles(data),
    organisations: extractOrganisations(data),
    healthcareServices: extractHealthcareServices(data),
    locations: extractLocations(data),
    lists: extractLists(data),
  }), [])

  const handleLoad = useCallback((text: string, filename: string, label?: string) => {
    setParseError(null)
    const parsed = parseBundle(text)
    if (!parsed.ok) {
      setParseError(parsed.error)
      return
    }
    const validation = validateMedicationsBundle(parsed.data)
    const record = buildRecordFromBundle(parsed.data)
    setLoaded({ source: text, filename, label: label ?? filename, format: parsed.format, validation, record })
    setShowOriginalSource(false)
    setTab('inspector')

    const loadToken = ++snomedCheckTokenRef.current
    setCheckingSnomed(true)
    checkAndDegradeSnomedCodes(parsed.data, { mutate: parsed.format === 'json' })
      .then(result => {
        if (snomedCheckTokenRef.current !== loadToken) return // a newer file was loaded meanwhile
        setCheckingSnomed(false)
        if (result.issues.length === 0 && result.passed.length === 0) return
        setLoaded(prev => {
          if (!prev) return prev
          const mergedValidation: ValidationResult = {
            ...prev.validation,
            issues: [...prev.validation.issues, ...result.issues],
            passed: [...prev.validation.passed, ...result.passed],
          }
          if (result.degradedCount === 0) {
            return { ...prev, validation: mergedValidation }
          }
          const updatedSource = JSON.stringify(parsed.data, null, 2)
          return {
            ...prev,
            source: updatedSource,
            originalSource: prev.source,
            record: { ...buildRecordFromBundle(parsed.data), snomedStatus: prev.record.snomedStatus },
            validation: mergedValidation,
          }
        })
      })
      .catch(() => {
        if (snomedCheckTokenRef.current !== loadToken) return
        setCheckingSnomed(false)
      })

    // Bulk active/inactive (+ dm+d "withdrawn") tagging — a separate, purely
    // additive check alongside the degrade pass above. Runs concurrently
    // against the same (not-yet-mutated) bundle; safe because the degrade
    // pass only mutates after its own network round trip resolves, well
    // after this has taken its own snapshot of the codings to check.
    checkSnomedStatuses(parsed.data)
      .then(snomedStatus => {
        if (snomedCheckTokenRef.current !== loadToken) return
        setLoaded(prev => (prev ? { ...prev, record: { ...prev.record, snomedStatus } } : prev))
      })
      .catch(() => {
        // Best-effort UI tagging only — leave snomedStatus unset on failure.
      })
  }, [buildRecordFromBundle])

  const handleLoadSample = useCallback(() => {
    const text = JSON.stringify(sampleBundle, null, 2)
    handleLoad(text, 'medications-bundle.json', 'Sample Data')
  }, [handleLoad])

  const handleLoadFullSample = useCallback(async () => {
    setParseError(null)
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'gpc-sample-bundle.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      handleLoad(text, 'gpc-sample-bundle.json', 'Sample Data')
    } catch (err) {
      setParseError('Failed to load full sample bundle: ' + (err instanceof Error ? err.message : String(err)))
    }
  }, [handleLoad])

  const handleLoadPasted = useCallback(() => {
    if (!pasteText.trim()) return
    setParseError(null)
    const normalized = normalizePastedJson(pasteText)
    if (!normalized.ok) {
      setParseError(normalized.error)
      return
    }
    handleLoad(JSON.stringify(normalized.data, null, 2), 'pasted-bundle.json', 'Pasted JSON')
    setPasteText('')
    setShowPaste(false)
  }, [pasteText, handleLoad])

  // Load a `fhir_examples/*.json` file referenced from a training guide the same
  // way pasted JSON is loaded — tolerating individual resources, arrays, and
  // partial bundles, not just fully spec-compliant Bundles.
  const handleLoadExample = useCallback((filename: string, data: unknown) => {
    setParseError(null)
    const normalized = normalizePastedJson(JSON.stringify(data))
    if (!normalized.ok) {
      setParseError(normalized.error)
      return
    }
    handleLoad(JSON.stringify(normalized.data, null, 2), filename, `Training example — ${filename}`)
  }, [handleLoad])

  const handleClear = useCallback(() => {
    setLoaded(null)
    setParseError(null)
  }, [])

  if (isSupabaseConfigured && isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-nhs-grey-5 dark:bg-gray-950">
        <div className="text-sm text-nhs-grey-3 dark:text-gray-500">Loading…</div>
      </div>
    )
  }

  if (isSupabaseConfigured && !user) {
    return <AuthGate />
  }

  return (
    <GuideNavProvider value={{ openGuide: handleOpenGuide }}>
    <div className="h-screen flex flex-col bg-nhs-grey-5 overflow-hidden">
      <TourOverlay currentTab={tab} setTab={setTab} />
      {/* NHS-style header */}
      <header className="bg-nhs-blue text-white shadow-md shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* NHS logo mark */}
            <div className="bg-white text-nhs-blue font-extrabold text-sm px-2 py-1 rounded leading-tight">NHS</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">GP Connect Demonstrator</h1>
              <p className="text-xs opacity-75 leading-tight">
                Access Record Structured · FHIR STU3
                {loaded && <span className="ml-1 opacity-100 font-medium">· {loaded.label}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HelpMenu currentTab={visibleTab} onOpenGuide={() => handleOpenGuide('overview', '')} />
            <button
              onClick={cycleTheme}
              className="text-white opacity-70 hover:opacity-100 border border-white/40 hover:border-white/80 p-1.5 rounded transition-all"
              title={themeMode === 'light' ? 'Light mode — click for dark' : themeMode === 'dark' ? 'Dark mode — click for system' : 'System mode — click for light'}
            >
              {themeMode === 'light' ? (
                /* Sun icon */
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : themeMode === 'dark' ? (
                /* Moon icon */
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                /* Monitor/system icon */
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2-1a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H5zm3 10a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            {loaded && (
              <button
                onClick={handleClear}
                className="text-xs text-white opacity-70 hover:opacity-100 border border-white/40 hover:border-white/80 px-3 py-1.5 rounded transition-all"
              >
                ← Load different file
              </button>
            )}
            {profile && (
              <>
                <button
                  onClick={handleOpenAccount}
                  className="text-xs text-white/70 hover:text-white border-l border-white/20 pl-2 hover:underline"
                >
                  {profile.display_name ?? profile.username}
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-white opacity-70 hover:opacity-100 border border-white/40 hover:border-white/80 px-2 py-1.5 rounded transition-all"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {tab === 'builder' ? (
        <main className="flex-1 flex flex-col min-h-0 max-w-screen-2xl mx-auto w-full px-4 pt-3 pb-4 gap-3">
          <div className="flex items-center gap-1 border-b border-nhs-grey-4">
            <button
              onClick={() => {
                if (
                  builderDirtyRef.current &&
                  !window.confirm('You have unsaved changes in the Record Builder. Leave without saving your draft?')
                ) return
                setTab('inspector')
              }}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← {loaded ? 'Inspector view' : 'Load a bundle'}
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-t bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px">
              Build a Record
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-lg border border-nhs-grey-4 overflow-hidden">
            <BuilderView
              onLoad={(json, filename) => { handleLoad(json, filename, 'Built Patient Record') }}
              onDirtyChange={handleBuilderDirtyChange}
              pendingDraft={pendingSharedDraft}
              pendingDraftId={pendingSharedDraftId}
              pendingDraftVersion={pendingSharedDraftVersion}
              onPendingDraftConsumed={() => {
                setPendingSharedDraft(null)
                setPendingSharedDraftId(null)
                setPendingSharedDraftVersion(null)
              }}
            />
          </div>
        </main>
      ) : tab === 'account' ? (
        <main className="flex-1 flex flex-col min-h-0 max-w-screen-2xl mx-auto w-full px-4 pt-3 pb-4 gap-3">
          <div className="flex items-center gap-1 border-b border-nhs-grey-4">
            <button
              onClick={() => setTab(prevTabRef.current === 'account' ? 'inspector' : prevTabRef.current)}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← Back
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-t bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px">
              My Account
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-lg border border-nhs-grey-4 overflow-hidden">
            <AccountPage />
          </div>
        </main>
      ) : tab === 'patients' ? (
        <main className="flex-1 flex flex-col min-h-0 max-w-screen-2xl mx-auto w-full px-4 pt-3 pb-4 gap-3">
          <div className="flex items-center gap-1 border-b border-nhs-grey-4">
            <button
              onClick={() => setTab('inspector')}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← {loaded ? 'Inspector view' : 'Load a bundle'}
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-t bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px">
              Shared Patients
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-lg border border-nhs-grey-4 overflow-hidden">
            <SharedPatientsView onLoadDraft={handleLoadSharedDraft} />
          </div>
        </main>
      ) : tab === 'app-guide' ? (
        <main className="flex-1 flex flex-col min-h-0 max-w-screen-2xl mx-auto w-full px-4 pt-3 pb-4 gap-3">
          <div className="flex items-center gap-1 border-b border-nhs-grey-4">
            <button
              onClick={() => setTab(prevTabRef.current === 'app-guide' ? 'inspector' : prevTabRef.current)}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← Back
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-t bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px">
              App Guide
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-lg border border-nhs-grey-4 overflow-hidden">
            <AppGuideView initialPage={guidePage} initialAnchor={guideAnchor} />
          </div>
        </main>
      ) : tab === 'training' ? (
        <main className="flex-1 flex flex-col min-h-0 max-w-screen-2xl mx-auto w-full px-4 pt-3 pb-4 gap-3">
          <div className="flex items-center gap-1 border-b border-nhs-grey-4">
            <button
              onClick={() => setTab(prevTabRef.current === 'training' ? 'inspector' : prevTabRef.current)}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← Back
            </button>
            {(['inspector', 'clinical', 'raw', 'validation'] as ActiveTab[]).filter(() => !!loaded).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-2 text-sm font-medium rounded-t transition-colors capitalize text-nhs-grey-2 hover:text-nhs-blue"
              >
                {t === 'clinical' ? 'Clinical View' : t === 'raw' ? 'Raw Source' : t === 'validation' ? 'Validation' : 'Inspector'}
              </button>
            ))}
            <button className="px-4 py-2 text-sm font-medium rounded-t bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px">
              Training
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-lg border border-nhs-grey-4 overflow-hidden">
            <TrainingView initialPage={trainingPage} onNavigate={setTrainingPage} onLoadExample={handleLoadExample} />
          </div>
        </main>
      ) : !loaded ? (
        /* Home screen */
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-nhs-grey-1 dark:text-gray-100">Get started</h2>
              <p className="text-sm text-nhs-grey-3 dark:text-gray-500 mt-1">
                Open a bundle, create a new record, or explore the training guides
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* Open a bundle */}
              <section className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-nhs-grey-4 dark:border-gray-700 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-nhs-blue flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-nhs-grey-1 dark:text-gray-100">Open a bundle</h3>
                    <p className="text-xs text-nhs-grey-3 dark:text-gray-500">FHIR STU3 · JSON or XML · Access Record Structured</p>
                  </div>
                </div>

                <div data-tour="home-file-upload">
                  <FileUpload onLoad={handleLoad} />
                </div>

                <div data-tour="home-paste-json">
                  {!showPaste ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPaste(true)}
                        className="flex-1 py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
                      >
                        Paste FHIR JSON
                      </button>
                      <InfoHint topic="home.paste-json" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                        placeholder="Paste a FHIR Bundle, partial bundle, or individual resource (JSON)…"
                        rows={6}
                        className="w-full rounded-lg border border-nhs-grey-4 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 font-mono text-xs text-nhs-grey-1 dark:text-gray-100 placeholder-nhs-grey-3 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue resize-y"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleLoadPasted}
                          disabled={!pasteText.trim()}
                          className="flex-1 py-2 px-4 bg-nhs-blue text-white rounded-lg text-sm font-medium hover:bg-nhs-dark-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Load pasted content
                        </button>
                        <button
                          onClick={() => { setShowPaste(false); setPasteText('') }}
                          className="py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-grey-2 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {parseError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-sm text-nhs-red dark:text-red-400">
                    <strong>Parse error:</strong> {parseError}
                  </div>
                )}

                <div className="border-t border-nhs-grey-4 dark:border-gray-700 pt-4 space-y-2" data-tour="home-sample-data">
                  <p className="text-xs font-medium text-nhs-grey-2 dark:text-gray-400 uppercase tracking-wide">Sample data</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLoadFullSample}
                      className="flex-1 py-2.5 px-4 bg-nhs-blue text-white rounded-lg text-sm font-medium hover:bg-nhs-dark-blue transition-colors"
                    >
                      Load full GP Connect sample
                      <span className="ml-2 opacity-75 text-xs font-normal">all domains · 2.4 MB</span>
                    </button>
                    <InfoHint topic="home.sample-full" className="text-nhs-grey-2 dark:text-gray-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLoadSample}
                      className="flex-1 py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
                    >
                      Load small GP Connect sample
                    </button>
                    <InfoHint topic="home.sample-meds" className="text-nhs-grey-2 dark:text-gray-400" />
                  </div>
                  <p className="text-xs text-nhs-grey-3 dark:text-gray-500">
                    Full sample covers all clinical domains: Medications, Allergies, Problems, Consultations, Immunisations, Investigations, Referrals, Diary Entries &amp; Coded Data
                  </p>
                </div>
              </section>

              {/* Create a record + Training */}
              <div className="flex flex-col gap-5">
                <section className="bg-white dark:bg-gray-900 rounded-xl border border-nhs-grey-4 dark:border-gray-700 p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-nhs-blue flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v6m3-3H9m4.5 8.25a8.25 8.25 0 100-16.5 8.25 8.25 0 000 16.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-nhs-grey-1 dark:text-gray-100">Create a record</h3>
                      <p className="text-xs text-nhs-grey-3 dark:text-gray-500">Compose a new patient, or reuse one your team has built</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTab('builder')}
                    data-tour="home-builder"
                    className="w-full py-2.5 px-4 bg-nhs-blue text-white rounded-lg text-sm font-medium hover:bg-nhs-dark-blue transition-colors"
                  >
                    Build a patient record →
                  </button>
                  {isSupabaseConfigured && (
                    <button
                      onClick={() => setTab('patients')}
                      data-tour="home-shared-patients"
                      className="w-full py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
                    >
                      Shared patients →
                    </button>
                  )}
                </section>

                <section className="bg-white dark:bg-gray-900 rounded-xl border border-nhs-grey-4 dark:border-gray-700 p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-nhs-blue flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-nhs-grey-1 dark:text-gray-100">Training</h3>
                      <p className="text-xs text-nhs-grey-3 dark:text-gray-500">GP Connect FHIR STU3 domain guides — no bundle needed</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { prevTabRef.current = 'inspector'; setTrainingPage(null); setTab('training') }}
                    className="w-full py-2.5 px-4 bg-nhs-blue text-white rounded-lg text-sm font-medium hover:bg-nhs-dark-blue transition-colors"
                  >
                    View training resources →
                  </button>
                </section>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* Main workspace */
        <main className={`flex-1 flex flex-col w-full p-4 gap-4 min-h-0 ${tab !== 'inspector' ? 'max-w-screen-2xl mx-auto' : ''}`}>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-nhs-grey-4">
            {(['inspector', 'clinical', 'raw', 'validation', 'training', 'app-guide'] as ActiveTab[]).map(t => (
              <button
                key={t}
                onClick={() => {
                  if (t === 'training') { prevTabRef.current = tab; setTrainingPage(null) }
                  if (t === 'app-guide') { prevTabRef.current = tab; setGuidePage(null); setGuideAnchor(null) }
                  setTab(t)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-t transition-colors capitalize ${
                  tab === t
                    ? 'bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px'
                    : 'text-nhs-grey-2 hover:text-nhs-blue'
                }`}
              >
                {t === 'clinical' ? 'Clinical View' : t === 'raw' ? 'Raw Source' : t === 'validation' ? 'Validation' : t === 'inspector' ? 'Inspector' : t === 'app-guide' ? 'App Guide' : 'Training'}
                {t === 'validation' && loaded.validation.issues.some(i => i.severity === 'error') && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-nhs-red text-white rounded-full">
                    {loaded.validation.issues.filter(i => i.severity === 'error').length}
                  </span>
                )}
                {t === 'validation' && !loaded.validation.issues.some(i => i.severity === 'error') && loaded.validation.issues.some(i => i.severity === 'warning') && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-nhs-yellow text-nhs-grey-1 rounded-full">
                    {loaded.validation.issues.filter(i => i.severity === 'warning').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {checkingSnomed && <SnomedCheckingBanner />}

          {/* Tab panels */}
          <div className={`flex-1 min-h-0 ${tab === 'inspector' ? 'overflow-hidden' : 'overflow-auto'}`}>
            {tab === 'clinical' && (
              <div className="rounded-lg border border-nhs-grey-4 h-full overflow-hidden">
                <ClinicalView record={loaded.record} onJumpToSource={handleJumpToSource} onOpenTraining={handleOpenTraining} />
              </div>
            )}

            {tab === 'inspector' && (
              <div className="h-full">
                <InspectorView
                  record={loaded.record}
                  source={showOriginalSource && loaded.originalSource ? loaded.originalSource : loaded.source}
                  format={loaded.format}
                  jumpToId={jumpToId}
                  onJumpHandled={() => setJumpToId(null)}
                  onOpenTraining={handleOpenTraining}
                  hasOriginalSource={!!loaded.originalSource}
                  showOriginalSource={showOriginalSource}
                  onToggleOriginalSource={() => setShowOriginalSource(v => !v)}
                />
              </div>
            )}

            {tab === 'raw' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 h-full flex flex-col overflow-hidden">
                <RawSourceViewer
                  source={showOriginalSource && loaded.originalSource ? loaded.originalSource : loaded.source}
                  format={loaded.format}
                  filename={loaded.filename}
                  hasOriginalSource={!!loaded.originalSource}
                  showOriginalSource={showOriginalSource}
                  onToggleOriginalSource={() => setShowOriginalSource(v => !v)}
                />
              </div>
            )}

            {tab === 'validation' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 h-full overflow-hidden p-4">
                <ValidationPanel
                  result={loaded.validation}
                  onCleanRefs={() => {
                    const parsed = parseBundle(loaded.source)
                    if (!parsed.ok) return
                    const { bundle: cleaned } = cleanDanglingRefs(parsed.data)
                    const cleanedJson = JSON.stringify(cleaned, null, 2)
                    // Download the cleaned file so it's permanently saved
                    const blob = new Blob([cleanedJson], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = loaded.filename.replace(/\.(json|xml)$/i, '') + '-cleaned.json'
                    a.click()
                    URL.revokeObjectURL(url)
                    // Also reload the cleaned version into the viewer
                    handleLoad(cleanedJson, loaded.filename)
                    setTab('validation')
                  }}
                />
              </div>
            )}
          </div>
        </main>
      )}

      <footer className="shrink-0 border-t border-nhs-grey-4 bg-white py-2 px-4">
        <p className="text-xs text-center text-nhs-grey-3">
          GP Connect Demonstrator · FHIR STU3 · Not a clinical system · For testing and demonstration purposes only
        </p>
      </footer>
    </div>
    </GuideNavProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <AppContent />
      </OnboardingProvider>
    </AuthProvider>
  )
}
