import { useRef, useState, type ReactNode } from 'react'
import { CodeImportDialog, type ImportSource } from './CodeImportDialog'
import {
  checkCodes,
  downloadTextFile,
  parsePastedCodes,
  readSpreadsheet,
  resultsToCsv,
  SPREADSHEET_EXTENSION,
  type CheckResults,
  type CodeInput,
} from './codeCheckerUtils'

interface ImportedSource {
  filename: string
  inputs: CodeInput[]
  hasSuppliedTerms: boolean
}

type StatusFilter = 'all' | 'active' | 'inactive'

const ACCEPTED_FILE_TYPES = '.csv,.tsv,.txt,.xlsx,.xlsm,.xls,.ods'

/**
 * Tools → SNOMED CT Code Checker. Takes a pasted or imported list of codes
 * and reports, via the terminology server, which are real concepts (with
 * their active/inactive status and preferred term) and which aren't.
 */
export function SnomedCodeChecker() {
  const [pasteText, setPasteText] = useState('')
  const [imported, setImported] = useState<ImportedSource | null>(null)
  const [pendingFile, setPendingFile] = useState<{ filename: string; source: ImportSource } | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CheckResults | null>(null)
  const [resultsHaveTerms, setResultsHaveTerms] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const inputs = imported ? imported.inputs : parsePastedCodes(pasteText)
  const hasSuppliedTerms = imported?.hasSuppliedTerms ?? false

  const handleFileChosen = async (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    setFileError(null)
    if (SPREADSHEET_EXTENSION.test(file.name)) {
      setReadingFile(true)
      try {
        const sheets = await readSpreadsheet(file)
        if (!sheets.some(sh => sh.rows.length > 0)) { setFileError(`${file.name} has no data.`); return }
        setPendingFile({ filename: file.name, source: { kind: 'workbook', sheets } })
      } catch {
        setFileError(`Couldn’t read ${file.name} — is it a valid Excel or OpenDocument spreadsheet?`)
      } finally {
        setReadingFile(false)
      }
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch {
      setFileError(`Couldn’t read ${file.name}.`)
      return
    }
    if (!text.trim()) { setFileError(`${file.name} is empty.`); return }
    setPendingFile({ filename: file.name, source: { kind: 'text', text } })
  }

  const handleCheck = async () => {
    if (inputs.length === 0) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setChecking(true)
    setError(null)
    setResults(null)
    setStatusFilter('all')
    try {
      const outcome = await checkCodes(inputs, (done, total) => setProgress({ done, total }), controller.signal)
      setResults(outcome)
      setResultsHaveTerms(hasSuppliedTerms)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (abortRef.current === controller) {
        setChecking(false)
        setProgress(null)
      }
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setChecking(false)
    setProgress(null)
  }

  const handleReset = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setChecking(false)
    setProgress(null)
    setPasteText('')
    setImported(null)
    setResults(null)
    setError(null)
    setFileError(null)
    setStatusFilter('all')
  }

  const canReset = !!(pasteText || imported || results || error || fileError || checking)

  const handleExport = () => {
    if (!results) return
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    downloadTextFile(resultsToCsv(results, resultsHaveTerms), `snomed-code-check-${stamp}.csv`, 'text/csv;charset=utf-8')
  }

  const activeCount = results?.matched.filter(m => !m.inactive).length ?? 0
  const inactiveCount = (results?.matched.length ?? 0) - activeCount
  const visibleMatched = results?.matched.filter(m =>
    statusFilter === 'all' ? true : statusFilter === 'inactive' ? m.inactive : !m.inactive,
  ) ?? []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-nhs-grey-1 dark:text-gray-100">SNOMED CT Code Checker</h2>
        <p className="text-sm text-nhs-grey-3 dark:text-gray-500 mt-1">
          Check a list of SNOMED CT concept ids against the NHS terminology server — whether each exists,
          whether it’s active or inactive, and which term it matches.
        </p>
      </div>

      {/* Input */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-nhs-grey-4 dark:border-gray-700 p-5 space-y-3">
        {imported ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-nhs-grey-4 dark:border-gray-600 bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">{imported.filename}</p>
              <p className="text-xs text-nhs-grey-3 dark:text-gray-400">
                {imported.inputs.length} code{imported.inputs.length === 1 ? '' : 's'} imported
                {imported.hasSuppliedTerms && ' · with supplied terms'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setImported(null)}
              disabled={checking}
              className="shrink-0 text-xs text-nhs-grey-2 dark:text-gray-300 hover:text-nhs-red disabled:opacity-40"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="code-checker-input" className="block text-xs font-medium text-nhs-grey-2 dark:text-gray-400 mb-1">
              Paste codes — one per line, or separated by commas, spaces or semicolons
            </label>
            <textarea
              id="code-checker-input"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={8}
              placeholder={'73211009\n22298006\n195967001'}
              className="w-full rounded-lg border border-nhs-grey-4 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 font-mono text-xs text-nhs-grey-1 dark:text-gray-100 placeholder-nhs-grey-3 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue resize-y"
            />
          </div>
        )}

        {fileError && <p className="text-xs text-nhs-red dark:text-red-400">{fileError}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking || inputs.length === 0}
            className="py-2 px-5 bg-nhs-blue text-white rounded-lg text-sm font-medium hover:bg-nhs-dark-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {checking ? 'Checking…' : `Check${inputs.length ? ` ${inputs.length} code${inputs.length === 1 ? '' : 's'}` : ''}`}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={checking || readingFile}
            className="py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors disabled:opacity-40"
          >
            {readingFile ? 'Reading file…' : 'Import file…'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={e => handleFileChosen(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={handleReset}
            disabled={!canReset}
            title="Clear the codes and results"
            className="py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-red hover:text-nhs-red transition-colors disabled:opacity-40 disabled:hover:border-nhs-grey-4 disabled:hover:text-nhs-grey-2"
          >
            Reset
          </button>
          <span className="text-xs text-nhs-grey-3 dark:text-gray-500">Excel, CSV, TSV or TXT</span>
        </div>

        {checking && progress && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-nhs-blue transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
              />
            </div>
            <span className="text-xs text-nhs-grey-3 dark:text-gray-400 tabular-nums">{progress.done}/{progress.total}</span>
            <button type="button" onClick={handleCancel} className="text-xs text-nhs-grey-2 dark:text-gray-300 hover:text-nhs-red">
              Cancel
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-sm text-nhs-red dark:text-red-400">
            <strong>Check failed:</strong> {error}
          </div>
        )}
      </section>

      {/* Results */}
      {results && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <SummaryChip label="Matched" value={results.matched.length} tone="green" />
              <SummaryChip label="Active" value={activeCount} tone="neutral" />
              <SummaryChip label="Inactive" value={inactiveCount} tone={inactiveCount ? 'amber' : 'neutral'} />
              <SummaryChip label="Failed" value={results.failed.length} tone={results.failed.length ? 'red' : 'neutral'} />
              <SummaryChip label="Duplicates" value={results.duplicates.length} tone="neutral" />
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="py-2 px-4 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
            >
              Export results (CSV)
            </button>
          </div>

          <ResultTable
            title="Failed matches"
            count={results.failed.length}
            tone="red"
            emptyText="Every code matched a SNOMED CT concept."
            columns={['Row', 'Code', ...(resultsHaveTerms ? ['Supplied term'] : []), 'Reason']}
            rows={results.failed.map(f => [
              <span className="text-nhs-grey-3 dark:text-gray-500 tabular-nums">{f.sourceRow}</span>,
              <span className="font-mono">{f.code}</span>,
              ...(resultsHaveTerms ? [f.suppliedTerm ?? ''] : []),
              <span className="text-nhs-red dark:text-red-400">{f.reason}</span>,
            ])}
          />

          <ResultTable
            title="Successful matches"
            count={results.matched.length}
            tone="green"
            emptyText={results.matched.length ? 'No codes match this filter.' : 'None of the codes matched a SNOMED CT concept.'}
            actions={results.matched.length > 0 && (
              <div className="flex rounded-md border border-nhs-grey-4 dark:border-gray-600 overflow-hidden text-xs">
                {(['all', 'active', 'inactive'] as StatusFilter[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-1 capitalize transition-colors ${
                      statusFilter === f ? 'bg-nhs-blue text-white' : 'text-nhs-grey-2 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            columns={['Row', 'Code', ...(resultsHaveTerms ? ['Supplied term'] : []), 'Preferred term', 'Fully specified name', 'Status']}
            rows={visibleMatched.map(m => [
              <span className="text-nhs-grey-3 dark:text-gray-500 tabular-nums">{m.sourceRow}</span>,
              <span className="font-mono">{m.code}</span>,
              ...(resultsHaveTerms ? [m.suppliedTerm ?? ''] : []),
              m.display,
              <span className="text-nhs-grey-3 dark:text-gray-400">{m.fsn ?? ''}</span>,
              m.inactive ? (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Inactive</span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Active</span>
              ),
            ])}
          />

          <ResultTable
            title="Duplicate codes"
            count={results.duplicates.length}
            tone="neutral"
            emptyText="No code appeared more than once."
            description="Repeat occurrences of a code already in the list — only the first occurrence is checked, so its result appears above."
            columns={['Row', 'Code', ...(resultsHaveTerms ? ['Supplied term'] : []), 'First seen at row']}
            rows={results.duplicates.map(d => [
              <span className="text-nhs-grey-3 dark:text-gray-500 tabular-nums">{d.sourceRow}</span>,
              <span className="font-mono">{d.code}</span>,
              ...(resultsHaveTerms ? [d.suppliedTerm ?? ''] : []),
              <span className="tabular-nums">{d.firstRow}</span>,
            ])}
          />
        </>
      )}

      {pendingFile && (
        <CodeImportDialog
          filename={pendingFile.filename}
          source={pendingFile.source}
          onCancel={() => setPendingFile(null)}
          onImport={(importedInputs, withTerms) => {
            setImported({ filename: pendingFile.filename, inputs: importedInputs, hasSuppliedTerms: withTerms })
            setPendingFile(null)
            setResults(null)
            setError(null)
          }}
        />
      )}
    </div>
  )
}

type Tone = 'green' | 'red' | 'amber' | 'neutral'

const CHIP_TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  red: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  neutral: 'bg-gray-50 text-nhs-grey-2 border-nhs-grey-4 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${CHIP_TONES[tone]}`}>
      <span className="font-semibold tabular-nums">{value}</span>
      {label}
    </span>
  )
}

interface ResultTableProps {
  title: string
  count: number
  tone: 'green' | 'red' | 'neutral'
  emptyText: string
  description?: string
  columns: string[]
  rows: ReactNode[][]
  actions?: ReactNode
}

const TABLE_ACCENTS: Record<ResultTableProps['tone'], string> = {
  green: 'border-l-emerald-600',
  red: 'border-l-nhs-red',
  neutral: 'border-l-nhs-grey-3',
}

function ResultTable({ title, count, tone, emptyText, description, columns, rows, actions }: ResultTableProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <section className={`bg-white dark:bg-gray-900 rounded-xl border border-nhs-grey-4 dark:border-gray-700 border-l-4 ${TABLE_ACCENTS[tone]} overflow-hidden`}>
      <div className={`flex items-center justify-between gap-3 px-4 py-3 ${collapsed ? '' : 'border-b border-nhs-grey-4 dark:border-gray-700'}`}>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-left group"
        >
          <svg
            className={`w-4 h-4 text-nhs-grey-3 group-hover:text-nhs-blue transition-transform ${collapsed ? '-rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <h3 className="font-semibold text-nhs-grey-1 dark:text-gray-100 group-hover:text-nhs-blue">
            {title} <span className="text-nhs-grey-3 dark:text-gray-500 font-normal">({count})</span>
          </h3>
        </button>
        {!collapsed && actions}
      </div>
      {!collapsed && (
        <>
          {description && rows.length > 0 && (
            <p className="px-4 pt-2 text-xs text-nhs-grey-3 dark:text-gray-500">{description}</p>
          )}
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-nhs-grey-3 dark:text-gray-500">{emptyText}</p>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-xs text-nhs-grey-2 dark:text-gray-400">
                  <tr>
                    {columns.map(c => <th key={c} className="px-3 py-2 text-left font-medium whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-nhs-grey-4 dark:divide-gray-700 text-nhs-grey-1 dark:text-gray-200">
                  {rows.map((cells, r) => (
                    <tr key={r} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {cells.map((cell, c) => <td key={c} className="px-3 py-1.5 align-top">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
