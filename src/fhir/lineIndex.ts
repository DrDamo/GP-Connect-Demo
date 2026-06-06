export interface LineRange {
  start: number // 1-based, inclusive
  end: number   // 1-based, inclusive
}

// Scan backwards from `fromLine` to find the line containing the
// opening brace that encloses the character at that line.
function findEnclosingBraceStart(lines: string[], fromLine: number): number {
  let depth = 0
  for (let i = fromLine; i >= 0; i--) {
    const line = lines[i]
    for (let j = line.length - 1; j >= 0; j--) {
      const ch = line[j]
      if (ch === '}' || ch === ']') depth++
      else if (ch === '{' || ch === '[') {
        if (depth === 0) return i
        depth--
      }
    }
  }
  return -1
}

// Scan forward from `fromLine` to find the matching closing brace.
function findMatchingBraceEnd(lines: string[], fromLine: number): number {
  let depth = 0
  let opened = false
  for (let i = fromLine; i < lines.length; i++) {
    const line = lines[i]
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '{' || ch === '[') { depth++; opened = true }
      else if (ch === '}' || ch === ']') {
        depth--
        if (opened && depth === 0) return i
      }
    }
  }
  return -1
}

// Prefix used for title-based index keys, so they cannot collide with real FHIR IDs.
// FHIR IDs are restricted to [A-Za-z0-9\-\.\_\~] so a null byte is safe as a sentinel.
export const TITLE_KEY_PREFIX = '\x00'

export function titleIndexKey(title: string): string {
  return TITLE_KEY_PREFIX + title
}

// Builds a map of FHIR resource ID → line range (1-based) by scanning
// the raw source for every "id": "value" occurrence.
// Also indexes resources by "title": "value" (using titleIndexKey) so that
// resources lacking an id field (common in some GP Connect bundles) can still
// be highlighted.
export function buildResourceLineIndex(source: string): Map<string, LineRange> {
  const index = new Map<string, LineRange>()
  const lines = source.split('\n')

  // Pre-compute the character offset of each line's start so we can
  // convert a regex match index to a line number in O(log n) instead of
  // rebuilding a substring + split for every match (which is O(n²)).
  const lineStarts = new Uint32Array(lines.length)
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    lineStarts[i] = pos
    pos += lines[i].length + 1
  }
  function lineOf(charOffset: number): number {
    let lo = 0, hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= charOffset) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  function indexField(pattern: RegExp, makeKey: (value: string) => string) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      const key = makeKey(match[1])
      if (index.has(key)) continue // first match wins
      const lineIdx = lineOf(match.index)
      const startLine = findEnclosingBraceStart(lines, lineIdx)
      if (startLine === -1) continue
      const endLine = findMatchingBraceEnd(lines, startLine)
      if (endLine === -1) continue
      index.set(key, { start: startLine + 1, end: endLine + 1 })
    }
  }

  // Pass 1: index by "id" field (covers most FHIR resources)
  indexField(/"id"\s*:\s*"([^"]+)"/g, v => v)

  // Pass 2: index by "title" field for resources that lack an id.
  // Uses titleIndexKey() to avoid collision with real FHIR IDs.
  indexField(/"title"\s*:\s*"([^"]+)"/g, titleIndexKey)

  return index
}

// Returns the full set of line numbers (1-based) covered by the given resource IDs.
export function getHighlightedLines(index: Map<string, LineRange>, resourceIds: string[]): Set<number> {
  const lines = new Set<number>()
  for (const id of resourceIds) {
    const range = index.get(id)
    if (!range) continue
    for (let n = range.start; n <= range.end; n++) lines.add(n)
  }
  return lines
}
