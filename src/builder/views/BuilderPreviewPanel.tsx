import { useState } from 'react'
import type { ValidationIssue } from '../../fhir/types'

// ---------------------------------------------------------------------------
// BuilderPreviewPanel — right-side FHIR JSON preview + validation panel
// ---------------------------------------------------------------------------

const PREVIEW_LINE_LIMIT = 200

const SEVERITY_CLS: Record<string, string> = {
  error: 'text-nhs-red',
  warning: 'text-yellow-700 dark:text-yellow-400',
  info: 'text-nhs-blue',
}

const SEVERITY_ICON: Record<string, string> = {
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

export interface BuilderPreviewPanelProps {
  bundleJson: string
  validationIssues: ValidationIssue[]
  onLoadIntoViewer: () => void
  onDownload: () => void
  onClose: () => void
}

export function BuilderPreviewPanel({
  bundleJson,
  validationIssues,
  onLoadIntoViewer,
  onDownload,
  onClose,
}: BuilderPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'json' | 'issues'>('json')

  const lines = bundleJson.split('\n')
  const preview = lines.slice(0, PREVIEW_LINE_LIMIT).join('\n')
  const truncated = lines.length > PREVIEW_LINE_LIMIT

  const errorCount = validationIssues.filter(i => i.severity === 'error').length
  const warningCount = validationIssues.filter(i => i.severity === 'warning').length
  const infoCount = validationIssues.filter(i => i.severity === 'info').length
  const hasIssues = validationIssues.length > 0

  return (
    <div className="flex flex-col h-full border-l border-nhs-grey-4 dark:border-nhs-grey-2 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-nhs-grey-4 dark:border-nhs-grey-2 bg-nhs-grey-5 dark:bg-gray-800 shrink-0">
        <h3 className="text-sm font-semibold text-nhs-grey-1">FHIR Preview</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors flex items-center gap-1"
            title="Download FHIR JSON"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Save JSON
          </button>
          <button
            type="button"
            onClick={onLoadIntoViewer}
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Load into viewer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-nhs-grey-3 hover:text-nhs-grey-1 transition-colors p-1"
            title="Close preview"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab bar (only shown when there are issues) */}
      {hasIssues && (
        <div className="shrink-0 flex border-b border-nhs-grey-4 dark:border-nhs-grey-2 bg-nhs-grey-5 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'json'
                ? 'bg-white dark:bg-gray-900 border-b-2 border-nhs-blue text-nhs-blue'
                : 'text-nhs-grey-2 hover:text-nhs-blue'
            }`}
          >
            JSON
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'issues'
                ? 'bg-white dark:bg-gray-900 border-b-2 border-nhs-blue text-nhs-blue'
                : 'text-nhs-grey-2 hover:text-nhs-blue'
            }`}
          >
            Validation
            {errorCount > 0 && (
              <span className="px-1.5 py-0.5 bg-nhs-red text-white rounded-full text-xs leading-none">
                {errorCount}
              </span>
            )}
            {errorCount === 0 && warningCount > 0 && (
              <span className="px-1.5 py-0.5 bg-nhs-yellow text-nhs-grey-1 rounded-full text-xs leading-none">
                {warningCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Validation summary strip (always visible when there are errors) */}
      {hasIssues && activeTab === 'json' && (
        <div className={`shrink-0 px-4 py-1.5 text-xs flex items-center gap-3 border-b ${
          errorCount > 0
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <svg className="w-3.5 h-3.5 shrink-0 text-nhs-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-nhs-grey-1">
            {[
              errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`,
              warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`,
              infoCount > 0 && `${infoCount} info`,
            ].filter(Boolean).join(', ')}
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className="text-nhs-blue hover:underline ml-auto"
          >
            View details →
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'json' ? (
          <pre className="font-mono text-xs text-nhs-grey-1 p-4 whitespace-pre">
            {preview}
          </pre>
        ) : (
          <div className="p-3 divide-y divide-nhs-grey-5 dark:divide-nhs-grey-2">
            {validationIssues.map((issue, i) => (
              <div key={i} className="flex gap-2 py-2">
                <span className={`shrink-0 text-xs font-bold mt-0.5 w-3 ${SEVERITY_CLS[issue.severity] ?? 'text-nhs-grey-2'}`}>
                  {SEVERITY_ICON[issue.severity] ?? '·'}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs ${SEVERITY_CLS[issue.severity] ?? 'text-nhs-grey-2'}`}>
                    {issue.message}
                  </p>
                  {issue.path && (
                    <p className="text-xs text-nhs-grey-3 font-mono mt-0.5 truncate">{issue.path}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Truncation notice */}
      {activeTab === 'json' && truncated && (
        <div className="shrink-0 px-4 py-2 border-t border-nhs-grey-4 dark:border-nhs-grey-2 bg-nhs-grey-5 dark:bg-gray-800 text-xs text-nhs-grey-3">
          Showing first {PREVIEW_LINE_LIMIT} of {lines.length} lines — load into viewer for full source
        </div>
      )}
    </div>
  )
}
