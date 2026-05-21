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

// Builds a map of FHIR resource ID → line range (1-based) by scanning
// the raw source for every "id": "value" occurrence.
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

  const idPattern = /"id"\s*:\s*"([^"]+)"/g
  let match: RegExpExecArray | null

  while ((match = idPattern.exec(source)) !== null) {
    const resourceId = match[1]
    const lineIdx = lineOf(match.index)

    const startLine = findEnclosingBraceStart(lines, lineIdx)
    if (startLine === -1) continue

    const endLine = findMatchingBraceEnd(lines, startLine)
    if (endLine === -1) continue

    // Only keep the outermost range for a given ID (first match wins)
    if (!index.has(resourceId)) {
      index.set(resourceId, { start: startLine + 1, end: endLine + 1 })
    }
  }

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
