import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DELIMITER_LABELS,
  EXCEL_ROUNDED_ERROR,
  detectDelimiter,
  guessCodeColumn,
  localFormatError,
  looksLikeHeaderRow,
  parseDelimited,
  type CodeInput,
  type Delimiter,
  type SheetData,
  type TableData,
} from './codeCheckerUtils'

export type ImportSource =
  | { kind: 'text'; text: string }
  | { kind: 'workbook'; sheets: SheetData[] }

interface Props {
  filename: string
  source: ImportSource
  onImport: (inputs: CodeInput[], hasSuppliedTerms: boolean) => void
  onCancel: () => void
}

const PREVIEW_ROWS = 8
const NO_COLUMN = -1

/**
 * Lets the user confirm how an imported file maps onto the checker — which
 * delimiter (text files) or sheet (workbooks), whether row 1 is headings,
 * which column holds the codes
 * and (optionally) which holds a term to compare against — with a live
 * preview so a wrong mapping is obvious before anything is checked.
 */
export function CodeImportDialog({ filename, source, onImport, onCancel }: Props) {
  const text = source.kind === 'text' ? source.text : ''
  const sheets = source.kind === 'workbook' ? source.sheets : []
  const [delimiter, setDelimiter] = useState<Delimiter>(() => detectDelimiter(text))
  // Default to the first sheet that actually has data.
  const [sheetIndex, setSheetIndex] = useState(() => Math.max(0, sheets.findIndex(sh => sh.rows.length > 0)))
  const table: TableData = useMemo(
    () => source.kind === 'text'
      ? parseDelimited(source.text, delimiter)
      : source.sheets[sheetIndex] ?? { rows: [], rowNumbers: [], roundedCells: new Set() },
    [source, delimiter, sheetIndex],
  )
  const rows = table.rows
  const [hasHeader, setHasHeader] = useState(() => looksLikeHeaderRow(rows[0] ?? []))
  const headerOffset = hasHeader ? 1 : 0
  const dataRows = rows.slice(headerOffset)
  const [codeColumn, setCodeColumn] = useState(() => guessCodeColumn(dataRows))
  const [termColumn, setTermColumn] = useState(NO_COLUMN)

  // Column layout changes with the delimiter/sheet, so re-guess the mapping.
  const remap = (next: TableData) => {
    const header = looksLikeHeaderRow(next.rows[0] ?? [])
    setHasHeader(header)
    setCodeColumn(guessCodeColumn(header ? next.rows.slice(1) : next.rows))
    setTermColumn(NO_COLUMN)
  }

  const columnCount = Math.max(0, ...rows.slice(0, 50).map(r => r.length))
  const columnNames = Array.from({ length: columnCount }, (_, i) =>
    hasHeader && rows[0]?.[i]?.trim() ? rows[0][i].trim() : `Column ${i + 1}`,
  )
  const safeCodeColumn = Math.min(codeColumn, Math.max(0, columnCount - 1))

  const inputs: CodeInput[] = dataRows
    .map((row, idx): CodeInput => ({
      code: (row[safeCodeColumn] ?? '').trim(),
      suppliedTerm: termColumn !== NO_COLUMN ? (row[termColumn] ?? '').trim() || undefined : undefined,
      sourceRow: table.rowNumbers[idx + headerOffset],
      formatError: table.roundedCells.has(`${idx + headerOffset},${safeCodeColumn}`) ? EXCEL_ROUNDED_ERROR : undefined,
    }))
    .filter(input => input.code !== '')
  const plausibleCount = inputs.filter(i => !i.formatError && !localFormatError(i.code)).length
  const roundedCount = inputs.filter(i => i.formatError).length

  const selectClass = 'w-full rounded-md border border-nhs-grey-4 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-nhs-grey-1 dark:text-gray-100 focus:border-nhs-blue focus:outline-none'
  const labelClass = 'block text-xs font-medium text-nhs-grey-2 dark:text-gray-400 mb-1'

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-nhs-grey-4 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-import-title"
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="code-import-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">Import codes</h2>
          <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mt-0.5 truncate">{filename}</p>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {source.kind === 'text' ? (
              <div>
                <label className={labelClass} htmlFor="import-delimiter">Delimiter</label>
                <select
                  id="import-delimiter"
                  className={selectClass}
                  value={delimiter}
                  onChange={e => {
                    const next = e.target.value as Delimiter
                    setDelimiter(next)
                    remap(parseDelimited(text, next))
                  }}
                >
                  {(Object.keys(DELIMITER_LABELS) as Delimiter[]).map(d => (
                    <option key={d} value={d}>{DELIMITER_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor="import-sheet">Sheet</label>
                <select
                  id="import-sheet"
                  className={selectClass}
                  value={sheetIndex}
                  onChange={e => {
                    const next = Number(e.target.value)
                    setSheetIndex(next)
                    remap(sheets[next])
                  }}
                >
                  {sheets.map((sh, i) => (
                    <option key={i} value={i}>{sh.name}{sh.rows.length === 0 ? ' (empty)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="import-code-col">Code column</label>
              <select id="import-code-col" className={selectClass} value={safeCodeColumn} onChange={e => setCodeColumn(Number(e.target.value))}>
                {columnNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="import-term-col">Term column <span className="font-normal text-nhs-grey-3">(optional)</span></label>
              <select id="import-term-col" className={selectClass} value={termColumn} onChange={e => setTermColumn(Number(e.target.value))}>
                <option value={NO_COLUMN}>None</option>
                {columnNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-nhs-grey-2 dark:text-gray-300">
            <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} className="rounded border-nhs-grey-4" />
            First row contains column headings
          </label>

          <div>
            <p className={labelClass}>Preview</p>
            <div className="rounded-md border border-nhs-grey-4 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-2.5 py-1.5 text-right font-medium text-nhs-grey-3 dark:text-gray-500 w-10">Row</th>
                    {columnNames.map((name, i) => (
                      <th
                        key={i}
                        className={`px-2.5 py-1.5 text-left font-medium whitespace-nowrap ${
                          i === safeCodeColumn ? 'text-nhs-blue' : i === termColumn ? 'text-emerald-700 dark:text-emerald-400' : 'text-nhs-grey-3 dark:text-gray-500'
                        }`}
                      >
                        {name}
                        {i === safeCodeColumn && <span className="ml-1 font-normal">(code)</span>}
                        {i === termColumn && <span className="ml-1 font-normal">(term)</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-nhs-grey-4 dark:divide-gray-700">
                  {dataRows.slice(0, PREVIEW_ROWS).map((row, r) => (
                    <tr key={r}>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-nhs-grey-3 dark:text-gray-500">{table.rowNumbers[r + headerOffset]}</td>
                      {columnNames.map((_, i) => (
                        <td
                          key={i}
                          title={table.roundedCells.has(`${r + headerOffset},${i}`) ? 'Rounded by Excel — digits lost' : undefined}
                          className={`px-2.5 py-1.5 whitespace-nowrap max-w-[16rem] truncate ${
                            table.roundedCells.has(`${r + headerOffset},${i}`) ? 'font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200'
                              : i === safeCodeColumn ? 'font-mono bg-blue-50 dark:bg-blue-950/40 text-nhs-grey-1 dark:text-gray-100'
                              : i === termColumn ? 'bg-emerald-50 dark:bg-emerald-950/30 text-nhs-grey-1 dark:text-gray-100'
                              : 'text-nhs-grey-3 dark:text-gray-500'
                          }`}
                        >
                          {row[i] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataRows.length > PREVIEW_ROWS && (
              <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mt-1">…and {dataRows.length - PREVIEW_ROWS} more rows</p>
            )}
          </div>

          {roundedCount > 0 && (
            <div className="p-3 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
              <strong>{roundedCount} code{roundedCount === 1 ? ' was' : 's were'} rounded by Excel.</strong>{' '}
              Excel only keeps 15 digits for numbers, so longer SNOMED CT ids (UK extension and dm+d codes) lose
              their last digits when the column isn’t formatted as Text. They’ll be listed as failed — fix the
              column format in the spreadsheet and re-import to check them.
            </div>
          )}

          <p className="text-sm text-nhs-grey-2 dark:text-gray-300">
            <strong>{inputs.length}</strong> code{inputs.length === 1 ? '' : 's'} will be imported
            {inputs.length > 0 && (
              <span className={plausibleCount === 0 ? 'text-nhs-red dark:text-red-400' : 'text-nhs-grey-3 dark:text-gray-500'}>
                {' '}· {plausibleCount} look{plausibleCount === 1 ? 's' : ''} like valid SNOMED CT concept ids
                {plausibleCount === 0 && ' — check the code column is right'}
              </span>
            )}
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 border border-nhs-grey-4 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onImport(inputs, termColumn !== NO_COLUMN)}
            disabled={inputs.length === 0}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-nhs-blue hover:bg-nhs-dark-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Import {inputs.length} code{inputs.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
