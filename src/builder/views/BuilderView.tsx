import { useState, useCallback } from 'react'
import { useDraftRecord } from '../hooks/useDraftRecord'
import { createSampleDraft } from '../sampleData'
import { buildBundle } from '../generate/index'
import { validateBundle } from '../../fhir/validator'
import { BuilderDomainNav, type BuilderDomain } from './BuilderDomainNav'
import { BuilderPreviewPanel } from './BuilderPreviewPanel'
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
}

export function BuilderView({ onLoad }: BuilderViewProps) {
  const { draft, dispatch } = useDraftRecord()
  const [activeDomain, setActiveDomain] = useState<BuilderDomain>('admin')
  const [showPreview, setShowPreview] = useState(false)
  const [previewJson, setPreviewJson] = useState('')
  const [previewIssues, setPreviewIssues] = useState<ValidationIssue[]>([])
  const [buildError, setBuildError] = useState<string | null>(null)

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

  const handleClearAll = useCallback(() => {
    if (window.confirm('Clear all draft data? This cannot be undone.')) {
      dispatch({ type: 'CLEAR_ALL' })
    }
  }, [dispatch])

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

  // Save JSON: validate first. If errors → show preview with Validation tab so
  // the user can review issues before deciding to download. If clean → download.
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
      case 'admin':        return <AdminForm {...formProps} onAutoPopulate={handleAutoPopulate} />
      case 'medications':  return <MedicationForm {...formProps} />
      case 'allergies':    return <AllergyForm {...formProps} />
      case 'problems':     return <ProblemForm {...formProps} />
      case 'consultations':return <ConsultationForm {...formProps} />
      case 'immunisations':return <ImmunisationForm {...formProps} />
      case 'investigations':return <InvestigationForm {...formProps} />
      case 'referrals':    return <ReferralForm {...formProps} />
      case 'diaryEntries': return <DiaryEntryForm {...formProps} />
      case 'codedData':    return <CodedDataForm {...formProps} />
      case 'documents':    return <DocumentForm {...formProps} />
      default:             return null
    }
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-nhs-grey-4 dark:border-nhs-grey-2 bg-white dark:bg-gray-900">
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
            onClick={handleClearAll}
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-red hover:text-nhs-red transition-colors"
          >
            Clear all
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
          >
            Preview FHIR
          </button>
          <button
            type="button"
            onClick={handleSaveJson}
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors flex items-center gap-1"
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
