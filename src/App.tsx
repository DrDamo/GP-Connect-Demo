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
import type { DraftRecord } from './builder/types'
import { parseBundle, normalizePastedJson } from './fhir/parser'
import { validateMedicationsBundle, cleanDanglingRefs } from './fhir/validator'
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

type ActiveTab = 'clinical' | 'raw' | 'validation' | 'inspector' | 'training' | 'builder' | 'patients' | 'account'

interface LoadedBundle {
  source: string
  filename: string
  label: string
  format: 'json' | 'xml'
  validation: ValidationResult
  record: GpConnectMedicationsRecord
}

function AppContent() {
  const { user, profile, isLoading, logout } = useAuth()
  const [loaded, setLoaded] = useState<LoadedBundle | null>(null)
  const [tab, setTab] = useState<ActiveTab>('clinical')
  const [trainingPage, setTrainingPage] = useState<DomainId | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [jumpToId, setJumpToId] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pendingSharedDraft, setPendingSharedDraft] = useState<DraftRecord | null>(null)
  const [pendingSharedDraftId, setPendingSharedDraftId] = useState<string | null>(null)
  const [pendingSharedDraftVersion, setPendingSharedDraftVersion] = useState<number | null>(null)
  const prevTabRef = useRef<ActiveTab>('clinical')
  const builderDirtyRef = useRef(false)

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

  const handleLoad = useCallback((text: string, filename: string, label?: string) => {
    setParseError(null)
    const parsed = parseBundle(text)
    if (!parsed.ok) {
      setParseError(parsed.error)
      return
    }
    const validation = validateMedicationsBundle(parsed.data)
    const record: GpConnectMedicationsRecord = {
      patient: extractPatientInfo(parsed.data),
      practiceOrganisation: getOrganisationName(parsed.data),
      medications: extractMedications(parsed.data),
      allergies: extractAllergies(parsed.data),
      problems: extractProblems(parsed.data),
      consultations: extractConsultations(parsed.data),
      immunisations: extractImmunisations(parsed.data),
      investigations: extractInvestigations(parsed.data),
      referrals: extractReferrals(parsed.data),
      diaryEntries: extractDiaryEntries(parsed.data),
      codedData: extractCodedData(parsed.data),
      documents: extractDocuments(parsed.data),
      fhirMedications: extractFhirMedications(parsed.data),
      practitioners: extractPractitioners(parsed.data),
      practitionerRoles: extractPractitionerRoles(parsed.data),
      organisations: extractOrganisations(parsed.data),
      healthcareServices: extractHealthcareServices(parsed.data),
      locations: extractLocations(parsed.data),
      lists: extractLists(parsed.data),
    }
    setLoaded({ source: text, filename, label: label ?? filename, format: parsed.format, validation, record })
    setTab('clinical')
  }, [])

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
    <div className="h-screen flex flex-col bg-nhs-grey-5 overflow-hidden">
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
                setTab('clinical')
              }}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← {loaded ? 'Clinical view' : 'Load a bundle'}
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
              onClick={() => setTab(prevTabRef.current === 'account' ? 'clinical' : prevTabRef.current)}
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
              onClick={() => setTab('clinical')}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← {loaded ? 'Clinical view' : 'Load a bundle'}
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-t bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px">
              Shared Patients
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-lg border border-nhs-grey-4 overflow-hidden">
            <SharedPatientsView onLoadDraft={handleLoadSharedDraft} />
          </div>
        </main>
      ) : tab === 'training' ? (
        <main className="flex-1 flex flex-col min-h-0 max-w-screen-2xl mx-auto w-full px-4 pt-3 pb-4 gap-3">
          <div className="flex items-center gap-1 border-b border-nhs-grey-4">
            <button
              onClick={() => setTab(prevTabRef.current === 'training' ? 'clinical' : prevTabRef.current)}
              className="px-4 py-2 text-sm font-medium rounded-t transition-colors text-nhs-grey-2 hover:text-nhs-blue"
            >
              ← Back
            </button>
            {(['clinical', 'inspector', 'raw', 'validation'] as ActiveTab[]).filter(() => !!loaded).map(t => (
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
            <TrainingView initialPage={trainingPage} onNavigate={setTrainingPage} />
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

                <FileUpload onLoad={handleLoad} />

                <div>
                  {!showPaste ? (
                    <button
                      onClick={() => setShowPaste(true)}
                      className="w-full py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
                    >
                      Paste FHIR JSON
                    </button>
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

                <div className="border-t border-nhs-grey-4 dark:border-gray-700 pt-4 space-y-2">
                  <p className="text-xs font-medium text-nhs-grey-2 dark:text-gray-400 uppercase tracking-wide">Sample data</p>
                  <button
                    onClick={handleLoadFullSample}
                    className="w-full py-2.5 px-4 bg-nhs-blue text-white rounded-lg text-sm font-medium hover:bg-nhs-dark-blue transition-colors"
                  >
                    Load full GP Connect sample
                    <span className="ml-2 opacity-75 text-xs font-normal">all domains · 2.4 MB</span>
                  </button>
                  <button
                    onClick={handleLoadSample}
                    className="w-full py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
                  >
                    Load medications-only sample
                  </button>
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
                    className="w-full py-2.5 px-4 bg-nhs-blue text-white rounded-lg text-sm font-medium hover:bg-nhs-dark-blue transition-colors"
                  >
                    Build a patient record →
                  </button>
                  {isSupabaseConfigured && (
                    <button
                      onClick={() => setTab('patients')}
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
                    onClick={() => { prevTabRef.current = 'clinical'; setTrainingPage(null); setTab('training') }}
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
            {(['clinical', 'inspector', 'raw', 'validation', 'training'] as ActiveTab[]).map(t => (
              <button
                key={t}
                onClick={() => {
                  if (t === 'training') { prevTabRef.current = tab; setTrainingPage(null) }
                  setTab(t)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-t transition-colors capitalize ${
                  tab === t
                    ? 'bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px'
                    : 'text-nhs-grey-2 hover:text-nhs-blue'
                }`}
              >
                {t === 'clinical' ? 'Clinical View' : t === 'raw' ? 'Raw Source' : t === 'validation' ? 'Validation' : t === 'inspector' ? 'Inspector' : 'Training'}
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

          {/* Tab panels */}
          <div className={`flex-1 min-h-0 ${tab === 'inspector' ? 'overflow-hidden' : 'overflow-auto'}`}>
            {tab === 'clinical' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 h-full overflow-hidden">
                <ClinicalView record={loaded.record} onJumpToSource={handleJumpToSource} onOpenTraining={handleOpenTraining} />
              </div>
            )}

            {tab === 'inspector' && (
              <div className="h-full">
                <InspectorView record={loaded.record} source={loaded.source} format={loaded.format} jumpToId={jumpToId} onJumpHandled={() => setJumpToId(null)} onOpenTraining={handleOpenTraining} />
              </div>
            )}

            {tab === 'raw' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 h-full flex flex-col overflow-hidden">
                <RawSourceViewer source={loaded.source} format={loaded.format} filename={loaded.filename} />
              </div>
            )}

            {tab === 'validation' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 p-4">
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
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
