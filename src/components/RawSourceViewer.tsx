import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs'

SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('xml', xml)

const MAX_DISPLAY_LINES = 3000

interface Props {
  source: string
  format: 'json' | 'xml'
  filename: string
}

export function RawSourceViewer({ source, format, filename }: Props) {
  const [copied, setCopied] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIdx, setSearchMatchIdx] = useState(0)

  const codeRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleCopy = () => {
    navigator.clipboard.writeText(source)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allLines = source.split('\n')
  const lineCount = allLines.length

  // When search is active we always show the full file (with wrapLines for
  // per-line highlighting). Otherwise respect the showAll / truncation setting.
  const searchActive = !!searchQuery.trim()
  const isTruncated = !searchActive && !showAll && lineCount > MAX_DISPLAY_LINES
  const displaySource = isTruncated
    ? allLines.slice(0, MAX_DISPLAY_LINES).join('\n')
    : source

  // Search across the full source regardless of truncation.
  const searchMatchLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return source.split('\n').reduce<number[]>((acc, line, i) => {
      if (line.toLowerCase().includes(q)) acc.push(i + 1)
      return acc
    }, [])
  }, [source, searchQuery])

  const searchMatchSet = useMemo(() => new Set(searchMatchLines), [searchMatchLines])

  const scrollToLine = useCallback((lineNumber: number) => {
    const container = codeRef.current
    if (!container) return
    const lineEls = container.querySelectorAll('code > span')
    const target = lineEls[lineNumber - 1] as HTMLElement | undefined
    if (!target) return
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    container.scrollTo({
      top: Math.max(0, container.scrollTop + targetRect.top - containerRect.top - 40),
      behavior: 'smooth',
    })
  }, [])

  useEffect(() => {
    setSearchMatchIdx(0)
    if (searchMatchLines.length > 0) scrollToLine(searchMatchLines[0])
  }, [searchMatchLines]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchPrev = useCallback(() => {
    if (searchMatchLines.length === 0) return
    const newIdx = searchMatchIdx > 0 ? searchMatchIdx - 1 : searchMatchLines.length - 1
    setSearchMatchIdx(newIdx)
    scrollToLine(searchMatchLines[newIdx])
  }, [searchMatchLines, searchMatchIdx, scrollToLine])

  const handleSearchNext = useCallback(() => {
    if (searchMatchLines.length === 0) return
    const newIdx = searchMatchIdx < searchMatchLines.length - 1 ? searchMatchIdx + 1 : 0
    setSearchMatchIdx(newIdx)
    scrollToLine(searchMatchLines[newIdx])
  }, [searchMatchLines, searchMatchIdx, scrollToLine])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.shiftKey ? handleSearchPrev() : handleSearchNext()
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
      searchInputRef.current?.blur()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 border-b border-nhs-grey-4 rounded-t-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-nhs-grey-2 truncate max-w-48">{filename}</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-nhs-grey-4 text-nhs-grey-1 uppercase">{format}</span>
          <span className="text-xs text-nhs-grey-3">{lineCount.toLocaleString()} lines</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-nhs-grey-2 hover:text-nhs-blue transition-colors px-2 py-1 rounded hover:bg-white"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Truncation notice */}
      {isTruncated && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700">
            Showing first {MAX_DISPLAY_LINES.toLocaleString()} of {lineCount.toLocaleString()} lines.
          </p>
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-amber-800 font-medium underline whitespace-nowrap hover:no-underline"
          >
            Show all {lineCount.toLocaleString()} lines
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="px-3 py-1.5 bg-nhs-grey-5 border-b border-nhs-grey-4 shrink-0 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-white border border-nhs-grey-4 rounded px-2 py-1 focus-within:border-nhs-blue transition-colors">
          <svg className="w-3 h-3 text-nhs-grey-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search source… (Enter / Shift+Enter to navigate)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 text-xs outline-none text-nhs-grey-1 placeholder-nhs-grey-3 bg-transparent min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-nhs-grey-3 hover:text-nhs-grey-1 shrink-0 transition-colors"
              title="Clear search"
            >✕</button>
          )}
        </div>
        {searchQuery.trim() && (
          <div className="flex items-center gap-1 shrink-0">
            {searchMatchLines.length === 0 ? (
              <span className="text-xs text-red-500 whitespace-nowrap">No matches</span>
            ) : (
              <>
                <span className="text-xs text-nhs-grey-2 tabular-nums whitespace-nowrap">
                  {searchMatchIdx + 1} / {searchMatchLines.length}
                </span>
                <button onClick={handleSearchPrev} title="Previous match (Shift+Enter)" className="px-2 py-1 text-xs border border-nhs-grey-4 rounded bg-white hover:bg-nhs-grey-5 transition-colors">▲</button>
                <button onClick={handleSearchNext} title="Next match (Enter)" className="px-2 py-1 text-xs border border-nhs-grey-4 rounded bg-white hover:bg-nhs-grey-5 transition-colors">▼</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Source viewer */}
      <div ref={codeRef} className="flex-1 overflow-auto rounded-b-lg">
        {showAll && !searchActive ? (
          /* Plain <pre> avoids per-token span cost for very large files */
          <pre className="text-xs font-mono leading-relaxed p-3 m-0 whitespace-pre bg-white min-h-full text-nhs-grey-1">
            {source}
          </pre>
        ) : (
          <SyntaxHighlighter
            language={format}
            style={githubGist}
            showLineNumbers
            wrapLines={searchActive}
            {...(searchActive && {
              lineProps: (lineNumber: number) => {
                const isCurrent = searchMatchLines.length > 0 && searchMatchLines[searchMatchIdx] === lineNumber
                const isOther = !isCurrent && searchMatchSet.has(lineNumber)
                const bg = isCurrent ? '#86efac' : isOther ? '#dcfce7' : undefined
                return { style: bg ? { backgroundColor: bg, display: 'block' } : { display: 'block' } }
              },
            })}
            lineNumberStyle={{ color: '#aeb7bd', fontSize: '0.75rem', minWidth: '2.5rem' }}
            customStyle={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.5', background: '#fff', height: '100%' }}
          >
            {displaySource}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  )
}
