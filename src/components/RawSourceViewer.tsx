import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { CodeMirrorView } from './CodeMirrorView'
import type { CodeMirrorViewHandle } from './CodeMirrorView'

interface Props {
  source: string
  format: 'json' | 'xml'
  filename: string
}

export function RawSourceViewer({ source, format, filename }: Props) {
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIdx, setSearchMatchIdx] = useState(0)
  const [showIndentGuides, setShowIndentGuides] = useState(false)
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null)

  const codeViewRef = useRef<CodeMirrorViewHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handler = (e: MouseEvent) => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) { setSelectionPopup(null); return }
      const range = selection.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return
      const text = selection.toString().trim()
      if (text.length >= 1) {
        setSelectionPopup({ text, x: e.clientX, y: e.clientY })
      } else {
        setSelectionPopup(null)
      }
    }
    container.addEventListener('mouseup', handler)
    return () => container.removeEventListener('mouseup', handler)
  }, [])

  useEffect(() => {
    if (!selectionPopup) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectionPopup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selectionPopup])

  const handlePopupCopy = useCallback(() => {
    if (selectionPopup) {
      navigator.clipboard.writeText(selectionPopup.text)
      setSelectionPopup(null)
    }
  }, [selectionPopup])

  const handlePopupSearch = useCallback(() => {
    if (selectionPopup) {
      setSearchQuery(selectionPopup.text.replace(/\n/g, ' ').slice(0, 100))
      setSelectionPopup(null)
    }
  }, [selectionPopup])

  const handleCopy = () => {
    navigator.clipboard.writeText(source)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lineCount = source.split('\n').length

  const searchMatchLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return source.split('\n').reduce<number[]>((acc, line, i) => {
      if (line.toLowerCase().includes(q)) acc.push(i + 1)
      return acc
    }, [])
  }, [source, searchQuery])

  useEffect(() => {
    setSearchMatchIdx(0)
    if (searchMatchLines.length > 0) codeViewRef.current?.scrollToLine(searchMatchLines[0])
  }, [searchMatchLines]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchPrev = useCallback(() => {
    if (searchMatchLines.length === 0) return
    const newIdx = searchMatchIdx > 0 ? searchMatchIdx - 1 : searchMatchLines.length - 1
    setSearchMatchIdx(newIdx)
    codeViewRef.current?.scrollToLine(searchMatchLines[newIdx])
  }, [searchMatchLines, searchMatchIdx])

  const handleSearchNext = useCallback(() => {
    if (searchMatchLines.length === 0) return
    const newIdx = searchMatchIdx < searchMatchLines.length - 1 ? searchMatchIdx + 1 : 0
    setSearchMatchIdx(newIdx)
    codeViewRef.current?.scrollToLine(searchMatchLines[newIdx])
  }, [searchMatchLines, searchMatchIdx])

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
    <>
    {selectionPopup && (
      <div
        ref={popupRef}
        style={{ position: 'fixed', left: selectionPopup.x, top: selectionPopup.y - 44, zIndex: 50 }}
        className="flex overflow-hidden rounded border border-nhs-grey-4 bg-white shadow-lg text-xs"
      >
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={handlePopupCopy}
          className="px-2.5 py-1.5 text-nhs-grey-1 hover:bg-nhs-grey-5 border-r border-nhs-grey-4 transition-colors whitespace-nowrap"
        >
          Copy
        </button>
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={handlePopupSearch}
          className="px-2.5 py-1.5 text-nhs-blue hover:bg-nhs-grey-5 transition-colors whitespace-nowrap"
        >
          Search this text
        </button>
      </div>
    )}
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 border-b border-nhs-grey-4 rounded-t-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-nhs-grey-2 truncate max-w-48">{filename}</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-nhs-grey-4 text-nhs-grey-1 uppercase">{format}</span>
          <span className="text-xs text-nhs-grey-3">{lineCount.toLocaleString()} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIndentGuides(v => !v)}
            title="Toggle indent guides"
            className={`text-xs border rounded px-2 py-1 transition-colors whitespace-nowrap ${
              showIndentGuides
                ? 'border-nhs-blue bg-nhs-blue text-white'
                : 'border-nhs-grey-4 bg-white text-nhs-grey-2 hover:bg-nhs-grey-5'
            }`}
          >
            Indent
          </button>
          <button
            onClick={handleCopy}
            className="text-xs text-nhs-grey-2 hover:text-nhs-blue transition-colors px-2 py-1 rounded hover:bg-white"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

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

      {/* Source viewer — virtualised, renders only visible lines regardless of file size */}
      <div ref={containerRef} className="flex-1 overflow-hidden rounded-b-lg">
        <CodeMirrorView
          ref={codeViewRef}
          source={source}
          language={format}
          highlightedLines={new Set()}
          searchMatchLines={searchMatchLines}
          currentSearchMatch={searchMatchLines[searchMatchIdx] ?? -1}
          indentGuides={showIndentGuides}
        />
      </div>
    </div>
    </>
  )
}
