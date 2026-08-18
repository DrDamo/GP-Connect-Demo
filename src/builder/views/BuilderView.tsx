import { useState, useCallback, useEffect, useRef } from 'react'
import { useDraftRecord } from '../hooks/useDraftRecord'
import { createSampleDraft } from '../sampleData'
import { buildBundle } from '../generate/index'
import { validateBundle } from '../../fhir/validator'
import { checkAndDegradeSnomedCodes } from '../../fhir/snomedDegrade'
import { BuilderPatientBanner } from '../components/BuilderPatientBanner'
import { BuilderDomainNav, type BuilderDomain } from './BuilderDomainNav'
import { BuilderPreviewPanel } from './BuilderPreviewPanel'
import { SaveToSharedDialog } from '../components/SaveToSharedDialog'
import { ListsSection } from '../components/ListsSection'
import { AdminForm } from '../forms/AdminForm'
import { MedicationForm } from '../forms/MedicationForm'
import { AllergyForm } from '../forms/AllergyForm'
import { ProblemForm } from '../forms/ProblemForm'
import { ConsultationForm } from '../forms/ConsultationForm'
import { ImmunisationForm } from '../forms/ImmunisationForm'
import { InvestigationForm } from '../forms/InvestigationForm'
import { ReferralForm } from '../forms/ReferralForm'
import { DiaryEntryForm } from '../forms/DiaryEntryForm'
import { CodedDataForm } from '../forms/CodedDataForm'
import { DocumentForm } from '../forms/DocumentForm'
import { useAuth } from '../../auth/AuthContext'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { ValidationIssue } from '../../fhir/types'
import type { DraftRecord } from '../types'
import { InfoHint } from '../../onboarding/InfoHint'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// BuilderView — top-level Record Builder shell
// ---------------------------------------------------------------------------

export interface BuilderViewProps {
  onLoad: (json: string, filename: string, initialTab?: 'inspector' | 'raw') => void
  onDirtyChange?: (isDirty: boolean) => void
  pendingDraft?: DraftRecord | null
  onPendingDraftConsumed?: () => void
  pendingDraftId?: string | null
  pendingDraftVersion?: number | null
}

export function BuilderView({
  onLoad,
  onDirtyChange,
  pendingDraft,
  onPendingDraftConsumed,
  pendingDraftId,
  pendingDraftVersion,
}: BuilderViewProps) {
  const { user, profile } = useAuth()
  const { draft, dispatch } = useDraftRecord()
  const [activeDomain, setActiveDomain] = useState<BuilderDomain>('admin')
  const [showPreview, setShowPreview] = useState(false)
  const [previewJson, setPreviewJson] = useState('')
  const [previewIssues, setPreviewIssues] = useState<ValidationIssue[]>([])
  const [checkingSnomedPreview, setCheckingSnomedPreview] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)

  // Shared save state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState(0)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Dirty tracking: saveMarker holds JSON at last shared save / load / clear
  const [saveMarker, setSaveMarker] = useState<string>(() => JSON.stringify(draft))
  const isDirty = saveMarker !== JSON.stringify(draft)

  // In production: auto-seed the SNOMED proxy config and show copyright notice once per session
  const [showCopyright, setShowCopyright] = useState(() =>
    !import.meta.env.DEV && !sessionStorage.getItem('snomed-copyright-seen')
  )

  useEffect(() => {
    if (import.meta.env.DEV) return
    const key = 'gpc-snomed-config'
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({ serverUrl: window.location.origin, token: '' }))
    }
  }, [])

  const dismissCopyright = () => {
    sessionStorage.setItem('snomed-copyright-seen', '1')
    setShowCopyright(false)
  }

  // Load a draft pushed in from the Shared Patients view
  useEffect(() => {
    if (!pendingDraft) return
    dispatch({ type: 'LOAD_DRAFT', payload: pendingDraft })
    setSaveMarker(JSON.stringify(pendingDraft))
    if (pendingDraftId) setCurrentDraftId(pendingDraftId)
    if (pendingDraftVersion) setCurrentVersion(pendingDraftVersion)
    onPendingDraftConsumed?.()
  }, [pendingDraft, pendingDraftId, pendingDraftVersion, dispatch, onPendingDraftConsumed])

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Browser unload warning when dirty
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ---------------------------------------------------------------------------
  // Bundle generation (shared, throws on error)
  // ---------------------------------------------------------------------------

  const generateBundle = useCallback(() => {
    const bundle = buildBundle(draft)
    const json = JSON.stringify(bundle, null, 2)
    const result = validateBundle(bundle)
    return { bundle, json, issues: result.issues }
  }, [draft])

  // ---------------------------------------------------------------------------
  // Toolbar handlers
  // ---------------------------------------------------------------------------

  const handleAutoPopulate = useCallback(() => {
    dispatch({ type: 'AUTO_POPULATE', payload: createSampleDraft() })
  }, [dispatch])

  // clearedRef lets us sync saveMarker after CLEAR_ALL without needing to
  // call setSaveMarker inside the callback (draft hasn't updated yet then).
  const clearedRef = useRef(false)
  const handleClearAllFinal = useCallback(() => {
    if (window.confirm('Clear all draft data? This cannot be undone.')) {
      clearedRef.current = true
      setCurrentDraftId(null)
      setCurrentVersion(0)
      dispatch({ type: 'CLEAR_ALL' })
    }
  }, [dispatch])

  // Sync saveMarker after clear
  useEffect(() => {
    if (clearedRef.current) {
      clearedRef.current = false
      setSaveMarker(JSON.stringify(draft))
    }
  }, [draft])

  // "Preview FHIR" used to open a split-pane truncated to the first 200
  // lines of the bundle — since Patient/Practitioner/Organisation resources
  // are emitted first, that pane was almost always showing nothing but the
  // admin-level resources. Now it just loads the full bundle straight into
  // the Raw Source tab, same mechanism as "Load into viewer" (which already
  // runs the SNOMED degrade-and-mutate pass on load) but landing on Raw
  // Source instead of Inspector.
  const handlePreview = useCallback(() => {
    setBuildError(null)
    try {
      const { json } = generateBundle()
      onLoad(json, 'built-record.json', 'raw')
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err))
    }
  }, [generateBundle, onLoad])

  const handleLoadIntoViewer = useCallback(() => {
    setBuildError(null)
    try {
      const { json } = generateBundle()
      onLoad(json, 'built-record.json')
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err))
    }
  }, [generateBundle, onLoad])

  const handleSaveJson = useCallback(async () => {
    setBuildError(null)
    try {
      const { bundle, issues } = generateBundle()

      setCheckingSnomedPreview(true)
      const snomedResult = await checkAndDegradeSnomedCodes(bundle, { mutate: true })
      setCheckingSnomedPreview(false)

      const allIssues = [...issues, ...snomedResult.issues]
      const json = JSON.stringify(bundle, null, 2)
      const hasErrors = allIssues.some(i => i.severity === 'error')
      setPreviewJson(json)
      setPreviewIssues(allIssues)
      if (hasErrors) {
        setShowPreview(true)
      } else {
        downloadJson(json, 'gp-connect-bundle.json')
      }
    } catch (err) {
      setCheckingSnomedPreview(false)
      setBuildError(err instanceof Error ? err.message : String(err))
    }
  }, [generateBundle])

  // Save to shared — insert (first time) or update (subsequent)
  const doSaveToShared = useCallback(async (name?: string, description?: string) => {
    if (!supabase) return
    setSaveError(null)
    setSaveSuccess(false)

    const patientName = [draft.patient.prefix, draft.patient.givenName, draft.patient.familyName]
      .filter(Boolean).join(' ') || null

    if (!profile) {
      setSaveError('Your profile has not loaded — try refreshing the page.')
      return
    }

    if (!currentDraftId) {
      // First save — insert
      const { data, error } = await supabase
        .from('patient_drafts')
        .insert({
          org_id: profile.org_id,
          created_by: profile.id,
          patient_name: patientName,
          nhs_number: draft.patient.nhsNumber || null,
          name: name ?? null,
          description: description ?? null,
          version: 1,
          draft_data: draft,
        })
        .select('id')
        .single()

      if (error) {
        setSaveError(error.message)
      } else {
        setCurrentDraftId(data.id)
        setCurrentVersion(1)
        setSaveMarker(JSON.stringify(draft))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } else {
      // Subsequent save — update existing record, bump version
      const newVersion = currentVersion + 1
      const { error } = await supabase
        .from('patient_drafts')
        .update({
          patient_name: patientName,
          nhs_number: draft.patient.nhsNumber || null,
          draft_data: draft,
          version: newVersion,
        })
        .eq('id', currentDraftId)

      if (error) {
        setSaveError(error.message)
      } else {
        setCurrentVersion(newVersion)
        setSaveMarker(JSON.stringify(draft))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    }
  }, [draft, profile, currentDraftId, currentVersion])

  const handleSaveToSharedClick = useCallback(() => {
    if (!currentDraftId) {
      setShowSaveDialog(true)
    } else {
      doSaveToShared()
    }
  }, [currentDraftId, doSaveToShared])

  const handleSaveDialogConfirm = useCallback((name: string, description: string) => {
    setShowSaveDialog(false)
    doSaveToShared(name, description)
  }, [doSaveToShared])

  const handleDownloadFromPreview = useCallback(() => {
    downloadJson(previewJson, 'gp-connect-bundle.json')
  }, [previewJson])

  const handleLoadFromPreview = useCallback(() => {
    onLoad(previewJson, 'built-record.json')
  }, [previewJson, onLoad])

  // ---------------------------------------------------------------------------
  // Form panel render
  // ---------------------------------------------------------------------------

  const formProps = { draft, dispatch }

  function renderForm() {
    switch (activeDomain) {
      case 'admin':         return <AdminForm {...formProps} onAutoPopulate={handleAutoPopulate} />
      case 'medications':   return <MedicationForm {...formProps} />
      case 'allergies':     return <AllergyForm {...formProps} />
      case 'problems':      return <ProblemForm {...formProps} />
      case 'consultations': return <ConsultationForm {...formProps} />
      case 'immunisations': return <ImmunisationForm {...formProps} />
      case 'investigations':return <InvestigationForm {...formProps} />
      case 'referrals':     return <ReferralForm {...formProps} />
      case 'diaryEntries':  return <DiaryEntryForm {...formProps} />
      case 'codedData':     return <CodedDataForm {...formProps} />
      case 'documents':     return <DocumentForm {...formProps} />
      case 'lists':         return <ListsSection draft={draft} />
      default:              return null
    }
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* SNOMED CT copyright notice — shown once per session in production */}
      {showCopyright && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-nhs-grey-4 dark:border-nhs-grey-2 w-full max-w-lg mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-nhs-blue/10 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-nhs-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100 mb-0.5">
                  SNOMED CT — Terminology Search Active
                </h2>
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  Connected to NHS Terminology Server
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-nhs-grey-3 dark:text-gray-400 leading-relaxed mb-5">
              <p>
                This application uses <strong className="text-nhs-grey-2 dark:text-gray-300">SNOMED Clinical Terms®</strong> (SNOMED CT®)
                to support clinical coding in the record builder. SNOMED CT® terminology searches are
                handled through the NHS Terminology Server — no credentials are stored in your browser.
              </p>
              <p>
                SNOMED CT® is the intellectual property of SNOMED International. All rights reserved.
                SNOMED CT® was originally created by the College of American Pathologists.
                "SNOMED" and "SNOMED CT" are registered trademarks of SNOMED International.
              </p>
              <p>
                NHS Digital is the National Release Centre (NRC) for SNOMED CT® in the United Kingdom.
              </p>
            </div>

            <button
              type="button"
              onClick={dismissCopyright}
              className="w-full py-2 bg-nhs-blue text-white rounded text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Acknowledge &amp; Continue
            </button>
          </div>
        </div>
      )}

      {/* Save to Shared dialog — shown on first save */}
      {showSaveDialog && (
        <SaveToSharedDialog
          onSave={handleSaveDialogConfirm}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}

      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-nhs-grey-4 dark:border-nhs-grey-2 bg-white dark:bg-gray-900">
        {/* Left: auto-populate | clear | save-to-shared */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoPopulate}
            data-tour="builder-auto-populate"
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Auto-populate
          </button>
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearAllFinal}
              className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-red hover:text-nhs-red transition-colors"
            >
              Clear all
            </button>
            <InfoHint topic="builder.clear-all" />
          </span>
          {isSupabaseConfigured && user && (
            <div className="flex items-center gap-1.5" data-tour="builder-save-shared">
              <button
                type="button"
                onClick={handleSaveToSharedClick}
                className="border border-nhs-green dark:border-green-500 text-nhs-green dark:text-green-400 px-3 py-1.5 rounded text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-1.5"
                title={currentDraftId ? `Update shared record (currently v${currentVersion})` : 'Save to shared patients area'}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Save to shared
              </button>
              {currentDraftId && !isDirty && !saveSuccess && (
                <span className="text-xs px-1.5 py-0.5 bg-nhs-grey-5 dark:bg-gray-800 text-nhs-grey-3 dark:text-gray-500 rounded">
                  v{currentVersion}
                </span>
              )}
              {isDirty && currentDraftId && (
                <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-medium inline-flex items-center gap-1">
                  Unsaved changes
                  <InfoHint topic="builder.dirty-guard" />
                </span>
              )}
              {saveSuccess && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded font-medium">
                  Saved v{currentVersion} ✓
                </span>
              )}
              {saveError && (
                <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded font-medium" title={saveError}>
                  Save failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: preview-fhir | save-json (FHIR) | load-into-viewer */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            data-tour="builder-preview"
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
          >
            Preview FHIR
          </button>
          <button
            type="button"
            onClick={handleSaveJson}
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors flex items-center gap-1"
            title="Validate against GP Connect AR:S standard then download"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Save JSON
          </button>
          <button
            type="button"
            onClick={handleLoadIntoViewer}
            data-tour="builder-load-into-viewer"
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            Load into viewer
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Patient banner — shown once basic details are entered */}
      <BuilderPatientBanner patient={draft.patient} />

      {/* Build error banner */}
      {buildError && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-xs text-nhs-red">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span><strong>Build error:</strong> {buildError}</span>
          <button
            type="button"
            onClick={() => setBuildError(null)}
            className="ml-auto text-nhs-red hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Body: nav + form + optional preview */}
      <div className="flex-1 flex overflow-hidden">
        <div data-tour="builder-domain-nav">
          <BuilderDomainNav
            active={activeDomain}
            draft={draft}
            onChange={setActiveDomain}
          />
        </div>

        <div className={`flex-1 overflow-auto p-4 bg-nhs-grey-5 dark:bg-gray-950 ${showPreview ? 'hidden sm:block' : ''}`}>
          {renderForm()}
        </div>

        {showPreview && (
          <div className="w-full sm:w-96 lg:w-[480px] shrink-0 overflow-hidden flex flex-col">
            <BuilderPreviewPanel
              bundleJson={previewJson}
              validationIssues={previewIssues}
              checkingSnomed={checkingSnomedPreview}
              onLoadIntoViewer={handleLoadFromPreview}
              onDownload={handleDownloadFromPreview}
              onClose={() => setShowPreview(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
