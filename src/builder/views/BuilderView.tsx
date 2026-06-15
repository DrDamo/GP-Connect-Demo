import { useState, useCallback, useEffect, useRef } from 'react'
import { useDraftRecord } from '../hooks/useDraftRecord'
import { createSampleDraft } from '../sampleData'
import { buildBundle } from '../generate/index'
import { validateBundle } from '../../fhir/validator'
import { BuilderDomainNav, type BuilderDomain } from './BuilderDomainNav'
import { BuilderPreviewPanel } from './BuilderPreviewPanel'
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
import type { ValidationIssue } from '../../fhir/types'
import type { DraftRecord } from '../types'

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
  onLoad: (json: string, filename: string) => void
  onDirtyChange?: (isDirty: boolean) => void
}

export function BuilderView({ onLoad, onDirtyChange }: BuilderViewProps) {
  const { draft, dispatch } = useDraftRecord()
  const [activeDomain, setActiveDomain] = useState<BuilderDomain>('admin')
  const [showPreview, setShowPreview] = useState(false)
  const [previewJson, setPreviewJson] = useState('')
  const [previewIssues, setPreviewIssues] = useState<ValidationIssue[]>([])
  const [buildError, setBuildError] = useState<string | null>(null)

  // Dirty tracking: saveMarker holds JSON string at last save/load/clear
  const [saveMarker, setSaveMarker] = useState<string>(() => JSON.stringify(draft))
  const isDirty = saveMarker !== JSON.stringify(draft)

  // Hidden file input ref for Load Draft
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handlePreview = useCallback(() => {
    setBuildError(null)
    try {
      const { json, issues } = generateBundle()
      setPreviewJson(json)
      setPreviewIssues(issues)
      setShowPreview(true)
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err))
    }
  }, [generateBundle])

  const handleLoadIntoViewer = useCallback(() => {
    setBuildError(null)
    try {
      const { json } = generateBundle()
      onLoad(json, 'built-record.json')
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err))
    }
  }, [generateBundle, onLoad])

  const handleSaveJson = useCallback(() => {
    setBuildError(null)
    try {
      const { json, issues } = generateBundle()
      const hasErrors = issues.some(i => i.severity === 'error')
      setPreviewJson(json)
      setPreviewIssues(issues)
      if (hasErrors) {
        setShowPreview(true)
      } else {
        downloadJson(json, 'gp-connect-bundle.json')
      }
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err))
    }
  }, [generateBundle])

  // Save Draft — downloads current draft as JSON
  const handleSaveDraft = useCallback(() => {
    const json = JSON.stringify(draft, null, 2)
    downloadJson(json, 'draft-record.json')
    setSaveMarker(JSON.stringify(draft))
  }, [draft])

  // Load Draft — triggers hidden file input
  const handleLoadDraftClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleLoadDraftFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const loaded = JSON.parse(text) as DraftRecord
        // Ensure organisations array exists (backwards compat)
        if (!Array.isArray(loaded.organisations)) {
          loaded.organisations = []
        }
        dispatch({ type: 'LOAD_DRAFT', payload: loaded })
        setSaveMarker(JSON.stringify(loaded))
      } catch {
        setBuildError('Failed to parse draft file — ensure it is a valid draft-record.json')
      }
    }
    reader.readAsText(file)
    // Reset input so the same file can be loaded again
    e.target.value = ''
  }, [dispatch])

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
      {/* Hidden file input for Load Draft */}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        className="hidden"
        onChange={handleLoadDraftFile}
      />

      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-nhs-grey-4 dark:border-nhs-grey-2 bg-white dark:bg-gray-900">
        {/* Left: auto-populate | clear | load-draft | save-draft */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoPopulate}
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Auto-populate
          </button>
          <button
            type="button"
            onClick={handleClearAllFinal}
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-red hover:text-nhs-red transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={handleLoadDraftClick}
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors flex items-center gap-1"
            title="Load a previously saved draft-record.json"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Load Draft
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors flex items-center gap-1"
              title="Save current draft as draft-record.json"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Save Draft
            </button>
            {isDirty && (
              <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-medium">
                Unsaved
              </span>
            )}
          </div>
        </div>

        {/* Right: preview-fhir | save-json (FHIR) | load-into-viewer */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
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
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            Load into viewer
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

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
        {/* Domain nav */}
        <BuilderDomainNav
          active={activeDomain}
          draft={draft}
          onChange={setActiveDomain}
        />

        {/* Form panel */}
        <div className={`flex-1 overflow-auto p-4 bg-nhs-grey-5 dark:bg-gray-950 ${showPreview ? 'hidden sm:block' : ''}`}>
          {renderForm()}
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="w-full sm:w-96 lg:w-[480px] shrink-0 overflow-hidden flex flex-col">
            <BuilderPreviewPanel
              bundleJson={previewJson}
              validationIssues={previewIssues}
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
