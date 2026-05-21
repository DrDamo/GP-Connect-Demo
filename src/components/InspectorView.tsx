import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import type { GpConnectBundle } from '../fhir/types'
import { buildResourceLineIndex, getHighlightedLines } from '../fhir/lineIndex'
import { MedicationsView } from './clinical/MedicationsView'
import { AllergiesView } from './clinical/AllergiesView'
import { ProblemsView } from './clinical/ProblemsView'
import { ConsultationsView } from './clinical/ConsultationsView'
import { ImmunisationsView } from './clinical/ImmunisationsView'
import { InvestigationsView } from './clinical/InvestigationsView'
import { ReferralsView } from './clinical/ReferralsView'
import { DiaryEntriesView } from './clinical/DiaryEntriesView'
import { CodedDataView } from './clinical/CodedDataView'
import { DomainNav } from './clinical/DomainNav'
import { type DomainId } from './clinical/domains'

SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('xml', xml)

interface Props {
  record: GpConnectBundle
  source: string
  format: 'json' | 'xml'
}

interface Section {
  label: string
  start: number
  end: number
}

function extractId(ref: string): string {
  return ref.split('/').pop() ?? ref
}

export function InspectorView({ record, source, format }: Props) {
  const [activeDomain, setActiveDomain] = useState<DomainId>('medications')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIdx, setSearchMatchIdx] = useState(0)

  const jsonPaneRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Populate search from text selection inside the FHIR pane.
  useEffect(() => {
    const container = jsonPaneRef.current
    if (!container) return
    const handler = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return
      const text = selection.toString().trim()
      if (text.length >= 1 && text.length <= 50 && !text.includes('\n')) {
        setSearchQuery(text)
      }
    }
    container.addEventListener('mouseup', handler)
    return () => container.removeEventListener('mouseup', handler)
  }, [])

  const lineIndex = useMemo(() => buildResourceLineIndex(source), [source])
  const selectedMed = record.medications.find(m => m.id === selectedId) ?? null

  // Reset selection when switching domains.
  useEffect(() => {
    setSelectedId(null)
    setSelectedIssueId(null)
    setCurrentSectionIdx(0)
  }, [activeDomain])

  // --- Section navigation ---

  const sections = useMemo<Section[]>(() => {
    if (activeDomain === 'medications') {
      if (selectedIssueId) {
        const issue = selectedMed?.issues.find(i => i.id === selectedIssueId)
        const range = lineIndex.get(selectedIssueId)
        if (!range) return []
        const label = issue?.issueDate ? `Issue · ${issue.issueDate}` : 'Issue'
        return [{ label, start: range.start, end: range.end }]
      }
      if (!selectedMed) return []
      const entries = [
        { id: selectedMed.medicationStatementId, label: 'Medication Statement' },
        ...selectedMed.medicationRequestIds.map((ref, i) => ({
          id: extractId(ref),
          label: selectedMed.medicationRequestIds.length > 1
            ? `Medication Request ${i + 1}`
            : 'Medication Request',
        })),
      ]
      return entries
        .flatMap(({ id, label }) => {
          const range = lineIndex.get(id)
          return range ? [{ label, start: range.start, end: range.end }] : []
        })
        .sort((a, b) => a.start - b.start)
    }

    // All other domains: single section for the selected resource
    if (!selectedId) return []
    const range = lineIndex.get(selectedId)
    if (!range) return []
    return [{ label: 'FHIR Resource', start: range.start, end: range.end }]
  }, [activeDomain, selectedMed, selectedIssueId, selectedId, lineIndex])

  const highlightedLines = useMemo(() => {
    if (activeDomain === 'medications') {
      if (selectedIssueId) return getHighlightedLines(lineIndex, [selectedIssueId])
      if (!selectedMed) return new Set<number>()
      return getHighlightedLines(lineIndex, [
        selectedMed.medicationStatementId,
        ...selectedMed.medicationRequestIds.map(extractId),
      ])
    }
    if (!selectedId) return new Set<number>()
    return getHighlightedLines(lineIndex, [selectedId])
  }, [activeDomain, selectedMed, selectedIssueId, selectedId, lineIndex])

  // --- Search ---

  const searchMatchLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return source.split('\n').reduce<number[]>((acc, line, i) => {
      if (line.toLowerCase().includes(q)) acc.push(i + 1)
      return acc
    }, [])
  }, [source, searchQuery])

  const searchMatchSet = useMemo(() => new Set(searchMatchLines), [searchMatchLines])

  // --- Scroll helper ---

  const scrollToLine = useCallback((lineNumber: number) => {
    const container = jsonPaneRef.current
    if (!container) return
    const lineEls = container.querySelectorAll('code > span')
    const target = lineEls[lineNumber - 1] as HTMLElement | undefined
    if (target) {
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const newScrollTop = container.scrollTop + (targetRect.top - containerRect.top) - 40
      container.scrollTo({ top: Math.max(0, newScrollTop), behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    setCurrentSectionIdx(0)
    if (sections.length > 0) scrollToLine(sections[0].start)
  }, [selectedMed, selectedIssueId, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSearchMatchIdx(0)
    if (searchMatchLines.length > 0) scrollToLine(searchMatchLines[0])
  }, [searchMatchLines]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Section nav handlers ---

  const handleSectionPrev = () => {
    const newIdx = Math.max(0, currentSectionIdx - 1)
    setCurrentSectionIdx(newIdx)
    scrollToLine(sections[newIdx].start)
  }

  const handleSectionNext = () => {
    const newIdx = Math.min(sections.length - 1, currentSectionIdx + 1)
    setCurrentSectionIdx(newIdx)
    scrollToLine(sections[newIdx].start)
  }

  // --- Search handlers ---

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

  const handleSelect = (id: string) => {
    setSelectedId(prev => (prev === id ? null : id))
    setSelectedIssueId(null)
  }

  const handleSelectIssue = (medId: string, issueId: string) => {
    setSelectedId(medId)
    setSelectedIssueId(prev => (prev === issueId ? null : issueId))
  }

  const currentSection = sections[currentSectionIdx]

  const counts: Partial<Record<DomainId, number>> = {
    medications:     record.medications.length,
    allergies:       record.allergies.length,
    problems:        record.problems.length,
    consultations:   record.consultations.length,
    immunisations:   record.immunisations.length,
    investigations:  record.investigations.length,
    referrals:       record.referrals.length,
    'diary-entries': record.diaryEntries.length,
    'coded-data':    record.codedData.length,
  }

  // Right-panel subtitle text
  const sourceSubtitle = (() => {
    if (activeDomain === 'medications') {
      if (selectedIssueId) {
        return currentSection
          ? `${currentSection.label} · lines ${currentSection.start}–${currentSection.end}`
          : 'Issue not found in source'
      }
      if (selectedMed) {
        return currentSection
          ? `${currentSection.label} · lines ${currentSection.start}–${currentSection.end}`
          : `${highlightedLines.size} lines highlighted`
      }
      return 'Select a medication to highlight its FHIR resources'
    }
    if (selectedId) {
      return currentSection
        ? `FHIR Resource · lines ${currentSection.start}–${currentSection.end}`
        : 'Resource not found in source'
    }
    return 'Select a record to highlight its FHIR source'
  })()

  return (
    <div className="flex h-full gap-3 min-h-0">
      {/* Left panel: domain nav + clinical content */}
      <div className="flex-1 flex border border-nhs-grey-4 rounded-lg overflow-hidden min-h-0">
        <DomainNav active={activeDomain} onSelect={setActiveDomain} counts={counts} />
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="px-3 py-2 bg-nhs-grey-5 border-b border-nhs-grey-4 shrink-0">
            <p className="text-xs text-nhs-grey-3">Click a row to highlight its FHIR source</p>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {activeDomain === 'medications' && (
              <MedicationsView
                record={record}
                selectedId={selectedId ?? undefined}
                selectedIssueId={selectedIssueId ?? undefined}
                onSelect={handleSelect}
                onSelectIssue={handleSelectIssue}
              />
            )}
            {activeDomain === 'allergies' && (
              <AllergiesView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
            {activeDomain === 'problems' && (
              <ProblemsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
            {activeDomain === 'consultations' && (
              <ConsultationsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
            {activeDomain === 'immunisations' && (
              <ImmunisationsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
            {activeDomain === 'investigations' && (
              <InvestigationsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
            {activeDomain === 'referrals' && (
              <ReferralsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
            {activeDomain === 'diary-entries' && (
              <DiaryEntriesView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
            {activeDomain === 'coded-data' && (
              <CodedDataView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} />
            )}
          </div>
        </div>
      </div>

      {/* Right panel: FHIR source */}
      <div className="flex-1 flex flex-col border border-nhs-grey-4 rounded-lg overflow-hidden min-h-0">

        {/* Row 1: title + section navigation */}
        <div className="px-3 py-2 bg-nhs-grey-5 border-b border-nhs-grey-4 shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">FHIR Source</h3>
            <p className="text-xs text-nhs-grey-3 mt-0.5 truncate">{sourceSubtitle}</p>
          </div>
          {sections.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleSectionPrev}
                disabled={currentSectionIdx === 0}
                title="Previous section"
                className="px-2 py-1 text-xs border border-nhs-grey-4 rounded bg-white hover:bg-nhs-grey-5 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >▲</button>
              <span className="text-xs text-nhs-grey-2 font-medium px-1.5 tabular-nums">
                {currentSectionIdx + 1} / {sections.length}
              </span>
              <button
                onClick={handleSectionNext}
                disabled={currentSectionIdx === sections.length - 1}
                title="Next section"
                className="px-2 py-1 text-xs border border-nhs-grey-4 rounded bg-white hover:bg-nhs-grey-5 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >▼</button>
            </div>
          )}
        </div>

        {/* Row 2: search bar */}
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

        {/* FHIR source viewer */}
        <div ref={jsonPaneRef} className="flex-1 overflow-auto">
          <SyntaxHighlighter
            language={format === 'xml' ? 'xml' : 'json'}
            style={githubGist}
            showLineNumbers
            wrapLines
            lineProps={(lineNumber: number) => {
              const isCurrentSearchMatch = searchMatchLines.length > 0 && searchMatchLines[searchMatchIdx] === lineNumber
              const isOtherSearchMatch = !isCurrentSearchMatch && searchMatchSet.has(lineNumber)
              const isHighlighted = highlightedLines.has(lineNumber)
              const bg = isCurrentSearchMatch ? '#86efac'
                : isOtherSearchMatch       ? '#dcfce7'
                : isHighlighted            ? '#fffbcc'
                : undefined
              return { style: bg ? { backgroundColor: bg, display: 'block' } : { display: 'block' } }
            }}
            lineNumberStyle={{ color: '#aeb7bd', fontSize: '0.75rem', minWidth: '2.5rem', userSelect: 'none' }}
            customStyle={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.5', background: '#fff', minHeight: '100%' }}
          >
            {source}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}
