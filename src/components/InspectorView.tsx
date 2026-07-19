import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { GpConnectBundle } from '../fhir/types'
import { CodeMirrorView } from './CodeMirrorView'
import type { CodeMirrorViewHandle } from './CodeMirrorView'
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
import { DocumentsView } from './clinical/DocumentsView'
import { SupportingResourcesView } from './clinical/SupportingResourcesView'
import { ListsView } from './clinical/ListsView'
import { DomainNav } from './clinical/DomainNav'
import { PatientBanner } from './clinical/PatientBanner'
import { type DomainId, DOMAIN_MAP } from './clinical/domains'
import { useDomainWarnings, DomainWarningBanner } from './clinical/DomainWarningBanner'
import { InfoHint } from '../onboarding/InfoHint'

interface Props {
  record: GpConnectBundle
  source: string
  format: 'json' | 'xml'
  jumpToId?: string | null
  onJumpHandled?: () => void
  onOpenTraining?: (domain: DomainId) => void
  /** Whether this bundle has a pre-degradation source to compare against. */
  hasOriginalSource?: boolean
  showOriginalSource?: boolean
  onToggleOriginalSource?: () => void
}

interface Section {
  label: string
  start: number
  end: number
}

function extractId(ref: string): string {
  return ref.split('/').pop() ?? ref
}

export function InspectorView({ record, source, format, jumpToId, onJumpHandled, onOpenTraining, hasOriginalSource, showOriginalSource, onToggleOriginalSource }: Props) {
  const [activeDomain, setActiveDomain] = useState<DomainId>('problems')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [jumpedId, setJumpedId] = useState<string | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIdx, setSearchMatchIdx] = useState(0)
  const [showIndentGuides, setShowIndentGuides] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const codeViewRef = useRef<CodeMirrorViewHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const jumpTargetIdRef = useRef<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null)

  // Show action popup when text is selected inside the FHIR pane.
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

  // Dismiss popup on click outside.
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

  const lineIndex = useMemo(() => buildResourceLineIndex(source), [source])
  const domainWarnings = useDomainWarnings(record)
  const selectedMed = record.medications.find(m => m.id === selectedId) ?? null

  // Reset selection when switching domains (or apply jump target when navigating via a record link).
  useEffect(() => {
    const jumpId = jumpTargetIdRef.current
    jumpTargetIdRef.current = null
    setSelectedId(jumpId)
    setSelectedIssueId(null)
    setCurrentSectionIdx(0)
    setJumpedId(null)
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
    let lines: Set<number>
    if (activeDomain === 'medications') {
      if (selectedIssueId) lines = getHighlightedLines(lineIndex, [selectedIssueId])
      else if (!selectedMed) lines = new Set<number>()
      else lines = getHighlightedLines(lineIndex, [
        selectedMed.medicationStatementId,
        ...selectedMed.medicationRequestIds.map(extractId),
      ])
    } else {
      lines = selectedId ? getHighlightedLines(lineIndex, [selectedId]) : new Set<number>()
    }
    if (jumpedId) {
      getHighlightedLines(lineIndex, [jumpedId]).forEach(l => lines.add(l))
    }
    return lines
  }, [activeDomain, selectedMed, selectedIssueId, selectedId, lineIndex, jumpedId])

  // --- Search ---

  const searchMatchLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return source.split('\n').reduce<number[]>((acc, line, i) => {
      if (line.toLowerCase().includes(q)) acc.push(i + 1)
      return acc
    }, [])
  }, [source, searchQuery])

  // --- Scroll helper ---

  const scrollToLine = useCallback((lineNumber: number) => {
    codeViewRef.current?.scrollToLine(lineNumber)
  }, [])

  const handlePopupCopy = useCallback(() => {
    if (selectionPopup) {
      navigator.clipboard.writeText(selectionPopup.text)
      setSelectionPopup(null)
    }
  }, [selectionPopup])

  const handlePopupSearch = useCallback(() => {
    if (selectionPopup) {
      setSearchQuery(selectionPopup.text.slice(0, 100))
      setSelectionPopup(null)
    }
  }, [selectionPopup])

  const handleJumpToSource = useCallback((resourceId: string) => {
    const range = lineIndex.get(resourceId)
    if (range) {
      setJumpedId(resourceId)
      scrollToLine(range.start)
    }
  }, [lineIndex, scrollToLine])

  const handleJumpToRecord = useCallback((domain: DomainId, id: string) => {
    jumpTargetIdRef.current = id
    setActiveDomain(domain)
  }, [])

  useEffect(() => {
    if (jumpToId) {
      handleJumpToSource(jumpToId)
      onJumpHandled?.()
    }
  }, [jumpToId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCurrentSectionIdx(0)
    if (sections.length > 0) scrollToLine(sections[0].start)
  }, [selectedMed, selectedIssueId, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyed on searchQuery only (not searchMatchLines/source) — jumping to the
  // first match should happen when the user types a new search, not merely
  // because the underlying source text changed (e.g. toggling original vs
  // degraded source), which should leave the viewport exactly where it was.
  useEffect(() => {
    setSearchMatchIdx(0)
    if (searchMatchLines.length > 0) scrollToLine(searchMatchLines[0])
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

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
    documents:       record.documents.length,
    'supporting-resources': record.practitioners.length + record.organisations.length + record.healthcareServices.length + record.locations.length + record.fhirMedications.length,
    'lists': record.lists.length,
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
    <div className="flex h-full gap-3 min-h-0">
      {/* Left panel: domain nav + clinical content */}
      <div className="flex-1 flex border border-nhs-grey-4 rounded-lg overflow-hidden min-h-0" data-tour="inspector-domain-nav">
        <DomainNav active={activeDomain} onSelect={setActiveDomain} counts={counts} />
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="px-3 py-2 bg-nhs-grey-5 border-b border-nhs-grey-4 shrink-0">
            <p className="text-xs text-nhs-grey-3">Click a row to highlight its FHIR source</p>
          </div>
          <div className="flex-shrink-0 border-b border-nhs-grey-4 p-3 pb-2">
            <PatientBanner
              patient={record.patient}
              practiceOrganisation={record.practiceOrganisation}
              patientId={record.patient?.id}
              onJumpToSource={handleJumpToSource}
            />
          </div>
          <div className="flex-1 overflow-auto p-4">
            {onOpenTraining && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => onOpenTraining(activeDomain)}
                  className="text-xs text-nhs-blue hover:underline flex items-center gap-1"
                  title={`Training guide: ${DOMAIN_MAP[activeDomain].label}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Training guide
                </button>
              </div>
            )}
            {domainWarnings[activeDomain] && (
              <DomainWarningBanner warning={domainWarnings[activeDomain]!} />
            )}
            {activeDomain === 'medications' && (
              <MedicationsView
                record={record}
                selectedId={selectedId ?? undefined}
                selectedIssueId={selectedIssueId ?? undefined}
                onSelect={handleSelect}
                onSelectIssue={handleSelectIssue}
                onJumpToSource={handleJumpToSource}
                onJumpToRecord={handleJumpToRecord}
              />
            )}
            {activeDomain === 'allergies' && (
              <AllergiesView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'problems' && (
              <ProblemsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'consultations' && (
              <ConsultationsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'immunisations' && (
              <ImmunisationsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'investigations' && (
              <InvestigationsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'referrals' && (
              <ReferralsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'diary-entries' && (
              <DiaryEntriesView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'coded-data' && (
              <CodedDataView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'documents' && (
              <DocumentsView bundle={record} selectedId={selectedId ?? undefined} onSelect={handleSelect} onJumpToSource={handleJumpToSource} onJumpToRecord={handleJumpToRecord} />
            )}
            {activeDomain === 'supporting-resources' && (
              <SupportingResourcesView
                bundle={record}
                selectedId={selectedId ?? undefined}
                onSelect={handleSelect}
                onJumpToSource={handleJumpToSource}
              />
            )}
            {activeDomain === 'lists' && (
              <ListsView
                bundle={record}
                selectedId={selectedId ?? undefined}
                onSelect={handleSelect}
                onJumpToSource={handleJumpToSource}
                onJumpToRecord={handleJumpToRecord}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right panel: FHIR source */}
      <div className="flex-1 flex flex-col border border-nhs-grey-4 rounded-lg overflow-hidden min-h-0" data-tour="inspector-source-pane">

        {/* Row 1: title + section navigation */}
        <div className="px-3 py-2 bg-nhs-grey-5 border-b border-nhs-grey-4 shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide flex items-center gap-1">
              FHIR Source
              <InfoHint topic="inspector.text-selection-popup" />
              <InfoHint topic="inspector.jump-from-elsewhere" />
            </h3>
            <p className="text-xs text-nhs-grey-3 mt-0.5 truncate">{sourceSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasOriginalSource && (
              <div className="flex items-center rounded border border-nhs-grey-4 overflow-hidden" title="Some SNOMED CT codes were degraded on import — compare the file as uploaded against the converted version">
                <button
                  onClick={() => showOriginalSource && onToggleOriginalSource?.()}
                  className={`px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    !showOriginalSource ? 'bg-nhs-blue text-white' : 'bg-white text-nhs-grey-2 hover:bg-nhs-grey-5'
                  }`}
                >
                  Degraded
                </button>
                <button
                  onClick={() => !showOriginalSource && onToggleOriginalSource?.()}
                  className={`px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap border-l border-nhs-grey-4 ${
                    showOriginalSource ? 'bg-nhs-blue text-white' : 'bg-white text-nhs-grey-2 hover:bg-nhs-grey-5'
                  }`}
                >
                  Original
                </button>
              </div>
            )}
            <button
              onClick={() => setShowIndentGuides(v => !v)}
              title="Toggle indent guides"
              className={`px-2 py-1 text-xs border rounded transition-colors whitespace-nowrap ${
                showIndentGuides
                  ? 'border-nhs-blue bg-nhs-blue text-white'
                  : 'border-nhs-grey-4 bg-white text-nhs-grey-2 hover:bg-nhs-grey-5'
              }`}
            >
              Indent
            </button>
            {sections.length > 0 && (
              <div className="flex items-center gap-1">
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
        </div>

        {/* Row 2: search bar */}
        <div className="px-3 py-1.5 bg-nhs-grey-5 border-b border-nhs-grey-4 shrink-0 flex items-center gap-2" data-tour="inspector-search">
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

        {/* FHIR source viewer — virtualised, renders only visible lines */}
        <div ref={containerRef} className="flex-1 overflow-hidden">
          <CodeMirrorView
            ref={codeViewRef}
            source={source}
            language={format}
            highlightedLines={highlightedLines}
            searchMatchLines={searchMatchLines}
            currentSearchMatch={searchMatchLines[searchMatchIdx] ?? -1}
            indentGuides={showIndentGuides}
          />
        </div>
      </div>
    </div>
    </>
  )
}
