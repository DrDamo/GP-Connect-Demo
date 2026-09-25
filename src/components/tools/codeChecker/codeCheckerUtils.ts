// Helpers for the SNOMED CT Code Checker tool: input parsing, local format
// checks, delimited-file parsing for the import dialog, the terminology
// server call, and CSV export of the results.

export interface CodeInput {
  code: string
  /** Term supplied alongside the code in an imported file, if one was mapped. */
  suppliedTerm?: string
  /** 1-based line/row number in the pasted text or imported file. */
  sourceRow: number
  /** Set when the import itself already makes the code unusable (e.g. Excel rounded it). */
  formatError?: string
}

export interface FailedResult extends CodeInput {
  reason: string
}

export interface MatchedResult extends CodeInput {
  inactive: boolean
  display: string
  fsn?: string
}

export interface DuplicateResult extends CodeInput {
  /** Row where the code first appeared — that occurrence is the one checked. */
  firstRow: number
}

export interface CheckResults {
  matched: MatchedResult[]
  failed: FailedResult[]
  duplicates: DuplicateResult[]
}

// ---------------------------------------------------------------------------
// Local format checks
// ---------------------------------------------------------------------------

// Verhoeff dihedral-group tables — SNOMED CT identifiers end in a Verhoeff
// check digit, so a mistyped digit can be caught without a server round trip.
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

export function hasValidVerhoeffCheckDigit(digits: string): boolean {
  let c = 0
  const reversed = digits.split('').reverse()
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]]
  }
  return c === 0
}

/**
 * Returns why a code can't be a SNOMED CT concept id without asking the
 * server, or undefined if it's worth looking up. The partition digit (second
 * from last) distinguishes concept (0), description (1) and relationship (2)
 * ids — a description id is a common mistake when codes are copied out of a
 * GP system's term picker.
 */
export function localFormatError(code: string): string | undefined {
  if (!/^\d+$/.test(code)) return 'Not a numeric code'
  if (code.length < 6 || code.length > 18) return 'Wrong length for a SNOMED CT id (must be 6–18 digits)'
  if (code.startsWith('0')) return 'SNOMED CT ids cannot start with 0'
  if (!hasValidVerhoeffCheckDigit(code)) return 'Invalid check digit — likely a typo'
  const partition = code[code.length - 2]
  if (partition === '1') return 'Description id, not a concept id'
  if (partition === '2') return 'Relationship id, not a concept id'
  if (partition !== '0') return 'Not a concept id (unrecognised partition)'
  return undefined
}

// ---------------------------------------------------------------------------
// Pasted text
// ---------------------------------------------------------------------------

/** Splits pasted text into codes on whitespace, commas, semicolons or pipes. */
export function parsePastedCodes(text: string): CodeInput[] {
  const inputs: CodeInput[] = []
  text.split(/\r?\n/).forEach((line, idx) => {
    for (const token of line.split(/[\s,;|]+/)) {
      const code = token.trim().replace(/^["']|["']$/g, '')
      if (code) inputs.push({ code, sourceRow: idx + 1 })
    }
  })
  return inputs
}

// ---------------------------------------------------------------------------
// Delimited files (import dialog)
// ---------------------------------------------------------------------------

export type Delimiter = ',' | '\t' | ';' | '|'

export const DELIMITER_LABELS: Record<Delimiter, string> = {
  ',': 'Comma',
  '\t': 'Tab',
  ';': 'Semicolon',
  '|': 'Pipe',
}

/** Picks whichever candidate delimiter appears most consistently in the first lines. */
export function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 20)
  let best: Delimiter = ','
  let bestScore = 0
  for (const d of Object.keys(DELIMITER_LABELS) as Delimiter[]) {
    const counts = lines.map(l => l.split(d).length - 1)
    const min = Math.min(...counts)
    if (min > bestScore) { best = d; bestScore = min }
  }
  return best
}

/** Parsed rows (blank rows dropped) plus each row's 1-based line/row number in the source. */
export interface TableData {
  rows: string[][]
  rowNumbers: number[]
  /** `${rowIndex},${colIndex}` of cells whose value was already corrupted in the source (Excel only). */
  roundedCells: Set<string>
}

/** Minimal RFC 4180-style parser — handles quoted fields, escaped quotes and embedded delimiters/newlines. */
export function parseDelimited(text: string, delimiter: Delimiter): TableData {
  const rows: string[][] = []
  const rowNumbers: number[] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let line = 1
  let rowStartLine = 1
  const src = text.replace(/^\uFEFF/, '')

  const endRow = () => {
    row.push(field); field = ''
    if (row.some(cell => cell.trim() !== '')) { rows.push(row); rowNumbers.push(rowStartLine) }
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else {
        if (ch === '\n') line++
        field += ch
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      endRow()
      line++
      rowStartLine = line
    } else field += ch
  }
  if (field !== '' || row.length > 0) endRow()

  return { rows, rowNumbers, roundedCells: new Set() }
}

/** True when the first row looks like column headings rather than data (no cell is a plausible code). */
export function looksLikeHeaderRow(row: string[]): boolean {
  return row.length > 0 && !row.some(cell => /^\s*\d{6,18}\s*$/.test(cell))
}

/** Index of the column whose values are most often numeric codes. */
export function guessCodeColumn(rows: string[][]): number {
  const sample = rows.slice(0, 50)
  const width = Math.max(0, ...sample.map(r => r.length))
  let best = 0
  let bestHits = -1
  for (let col = 0; col < width; col++) {
    const hits = sample.filter(r => /^\s*\d{6,18}\s*$/.test(r[col] ?? '')).length
    if (hits > bestHits) { best = col; bestHits = hits }
  }
  return best
}

// ---------------------------------------------------------------------------
// Spreadsheets (Excel / ODS)
// ---------------------------------------------------------------------------

export const SPREADSHEET_EXTENSION = /\.(xlsx|xlsm|xls|ods)$/i

export const EXCEL_ROUNDED_ERROR = 'Excel stored this code as a number and rounded it (15-digit limit) — format the column as Text and re-enter it'

export interface SheetData extends TableData {
  name: string
}

// Excel keeps numbers to 15 significant digits, so a 16–18 digit SNOMED CT
// id (UK extension and dm+d codes) typed into a General/Number cell has
// already lost its last digits before we ever see the file. A long numeric
// cell is flagged as rounded when it's beyond exact double precision or its
// check digit no longer holds — a file written by other software can store
// a 16-digit id exactly, and that shouldn't be reported as damaged.
const EXCEL_MAX_EXACT_DIGITS = 1e15

function looksRoundedByExcel(value: number, text: string): boolean {
  if (Math.abs(value) < EXCEL_MAX_EXACT_DIGITS) return false
  return !Number.isSafeInteger(value) || localFormatError(text) !== undefined
}

/** Reads every sheet of a workbook as rows of display strings. SheetJS is loaded on demand. */
export async function readSpreadsheet(file: File): Promise<SheetData[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })

  return workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name]
    const rows: string[][] = []
    const rowNumbers: number[] = []
    const roundedCells = new Set<string>()
    if (!sheet['!ref']) return { name, rows, rowNumbers, roundedCells }

    const range = XLSX.utils.decode_range(sheet['!ref'])
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: string[] = []
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as { t?: string; v?: unknown; w?: string } | undefined
        if (!cell || cell.v === undefined || cell.v === null) { row.push(''); continue }
        if (cell.t === 'n' && typeof cell.v === 'number' && Number.isInteger(cell.v)) {
          // Plain integer text — avoids "7.3211E+07"-style display formats.
          const text = BigInt(cell.v).toString()
          row.push(text)
          if (looksRoundedByExcel(cell.v, text)) roundedCells.add(`${rows.length},${c - range.s.c}`)
        } else {
          row.push(cell.w ?? String(cell.v))
        }
      }
      if (!row.some(cell => cell.trim() !== '')) {
        // Blank row — drop it, discarding any flags recorded against its index.
        for (let c = 0; c < row.length; c++) roundedCells.delete(`${rows.length},${c}`)
        continue
      }
      rows.push(row)
      rowNumbers.push(r + 1) // Excel's own 1-based row number
    }
    return { name, rows, rowNumbers, roundedCells }
  })
}

// ---------------------------------------------------------------------------
// Terminology server
// ---------------------------------------------------------------------------

const REQUEST_CHUNK_SIZE = 500

interface ServerCheckResult {
  found: boolean
  inactive?: boolean
  display?: string
  fsn?: string
}

/**
 * De-duplicates the inputs, fails anything that can't be a concept id
 * locally, then looks the rest up on the terminology server in chunks
 * (reporting progress as each chunk completes).
 */
export async function checkCodes(
  inputs: CodeInput[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<CheckResults> {
  const firstRowByCode = new Map<string, number>()
  const unique: CodeInput[] = []
  const duplicates: DuplicateResult[] = []
  for (const input of inputs) {
    const firstRow = firstRowByCode.get(input.code)
    if (firstRow !== undefined) { duplicates.push({ ...input, firstRow }); continue }
    firstRowByCode.set(input.code, input.sourceRow)
    unique.push(input)
  }

  const failed: FailedResult[] = []
  const toLookup: CodeInput[] = []
  for (const input of unique) {
    const error = input.formatError ?? localFormatError(input.code)
    if (error) failed.push({ ...input, reason: error })
    else toLookup.push(input)
  }

  const serverUrl = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin
  const serverResults: Record<string, ServerCheckResult> = {}
  onProgress(0, toLookup.length)
  for (let i = 0; i < toLookup.length; i += REQUEST_CHUNK_SIZE) {
    const chunk = toLookup.slice(i, i + REQUEST_CHUNK_SIZE)
    const res = await fetch(`${serverUrl}/api/snomed/check-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: chunk.map(c => c.code) }),
      signal,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null
      throw new Error(body?.error || `Terminology check failed (HTTP ${res.status})`)
    }
    const json = (await res.json()) as { results: Record<string, ServerCheckResult> }
    Object.assign(serverResults, json.results)
    onProgress(Math.min(i + chunk.length, toLookup.length), toLookup.length)
  }

  const matched: MatchedResult[] = []
  for (const input of toLookup) {
    const result = serverResults[input.code]
    if (!result?.found) {
      failed.push({ ...input, reason: 'Not found on the terminology server' })
    } else {
      matched.push({ ...input, inactive: !!result.inactive, display: result.display ?? '', fsn: result.fsn })
    }
  }

  failed.sort((a, b) => a.sourceRow - b.sourceRow)
  return { matched, failed, duplicates }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function csvCell(value: string | number | undefined): string {
  const s = value === undefined ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One CSV covering both tables, with a Result column to tell them apart. */
export function resultsToCsv(results: CheckResults, includeSuppliedTerm: boolean): string {
  const header = ['Row', 'Code', ...(includeSuppliedTerm ? ['Supplied term'] : []), 'Result', 'Status', 'Preferred term', 'Fully specified name', 'Reason']
  const lines = [header.map(csvCell).join(',')]
  const rows = [
    ...results.matched.map(m => ({ row: m.sourceRow, cells: [m.sourceRow, m.code, ...(includeSuppliedTerm ? [m.suppliedTerm] : []), 'Matched', m.inactive ? 'Inactive' : 'Active', m.display, m.fsn, ''] })),
    ...results.failed.map(f => ({ row: f.sourceRow, cells: [f.sourceRow, f.code, ...(includeSuppliedTerm ? [f.suppliedTerm] : []), 'Failed', '', '', '', f.reason] })),
    ...results.duplicates.map(d => ({ row: d.sourceRow, cells: [d.sourceRow, d.code, ...(includeSuppliedTerm ? [d.suppliedTerm] : []), 'Duplicate', '', '', '', `Duplicate of row ${d.firstRow}`] })),
  ].sort((a, b) => a.row - b.row)
  for (const r of rows) lines.push(r.cells.map(csvCell).join(','))
  return lines.join('\r\n')
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  // BOM so Excel opens UTF-8 terms (e.g. "Sjögren's") correctly.
  const blob = new Blob(['\uFEFF' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
