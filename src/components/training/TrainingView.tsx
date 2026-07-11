import { useState, useEffect } from 'react'
import { DOMAINS, type DomainId, type DomainDef } from '../clinical/domains'
import { MarkdownContent } from './MarkdownContent'
import { slugify } from './utils'
import { useAuth } from '../../auth/AuthContext'
import { PencilIcon } from '../../builder/components/Icons'
import { useTrainingContentOverrides } from './hooks/useTrainingContentOverrides'
import { useTrainingNotes, type TrainingNote } from './hooks/useTrainingNotes'
import { TrainingContentEditor } from './TrainingContentEditor'
import { TrainingNotesPanel } from './TrainingNotesPanel'

// ─── Table of contents helpers ───────────────────────────────────────────────

interface Heading { level: 1 | 2 | 3; text: string; id: string }

function stripMarkdownInline(raw: string): string {
  return raw.replace(/`([^`]+)`/g, '$1').replace(/[*_[\]()]/g, '').trim()
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  for (const line of markdown.split('\n')) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (match) {
      const level = match[1].length as 1 | 2 | 3
      const text = stripMarkdownInline(match[2])
      headings.push({ level, text, id: slugify(text) })
    }
  }
  return headings
}

function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length === 0) return null
  const handleClick = (id: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <nav className="sticky top-4">
      <div className="text-[10px] font-semibold text-nhs-grey-3 dark:text-slate-500 uppercase tracking-wide mb-2">
        On this page
      </div>
      <ul className="space-y-1">
        {headings.map((h, i) => (
          <li key={i}>
            <a
              href={`#${h.id}`}
              onClick={e => handleClick(h.id, e)}
              className={`block text-xs leading-snug text-nhs-grey-3 dark:text-slate-400 hover:text-nhs-grey-1 dark:hover:text-slate-100 hover:underline ${
                h.level === 3 ? 'pl-3' : h.level === 1 ? 'font-medium' : ''
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// --- Markdown content: clinical domains ---
import medicationsContent from '../../training-content/09_medications.md?raw'
import allergiesContent from '../../training-content/04_allergies.md?raw'
import consultationsContent from '../../training-content/05_consultations.md?raw'
import problemsContent from '../../training-content/11_problems.md?raw'
import immunisationsContent from '../../training-content/08_immunisations.md?raw'
import investigationsContent from '../../training-content/10_investigations.md?raw'
import referralsContent from '../../training-content/12_referrals.md?raw'
import diaryEntriesContent from '../../training-content/07_diary_entries.md?raw'
import codedDataContent from '../../training-content/13_coded_data_uncategorised.md?raw'
import documentsContent from '../../training-content/06_documents.md?raw'
import supportingResourcesContent from '../../training-content/15_data_model_guide.md?raw'
import listsContent from '../../training-content/14_lists_and_references.md?raw'

// --- Markdown content: API integration pages ---
import indexContent from '../../training-content/00_INDEX.md?raw'
import basicsContent from '../../training-content/01_basics_of_the_service.md?raw'
import apiCallsContent from '../../training-content/02_api_calls_and_responses.md?raw'
import assuranceContent from '../../training-content/03_assurance_process.md?raw'
import codeableConceptContent from '../../training-content/16_codeable_concept.md?raw'
import linkagesContent from '../../training-content/17_linkages_search_configuration.md?raw'
import githubContent from '../../training-content/18_github_repositories.md?raw'

// ─── Types ──────────────────────────────────────────────────────────────────

type ApiPageId = 'basics' | 'api-calls' | 'assurance' | 'github'
type PageId = DomainId | ApiPageId
const API_PAGE_IDS: ApiPageId[] = ['basics', 'api-calls', 'assurance', 'github']
function isApiPageId(id: string): id is ApiPageId { return (API_PAGE_IDS as string[]).includes(id) }

// ─── Content maps ────────────────────────────────────────────────────────────

const DOMAIN_CONTENT: Record<DomainId, string> = {
  medications:            medicationsContent,
  allergies:              allergiesContent,
  consultations:          consultationsContent,
  problems:               problemsContent,
  immunisations:          immunisationsContent,
  investigations:         investigationsContent,
  referrals:              referralsContent,
  'diary-entries':        diaryEntriesContent,
  'coded-data':           codedDataContent,
  documents:              documentsContent,
  'supporting-resources': supportingResourcesContent,
  lists:                  listsContent,
}

const API_CONTENT: Record<ApiPageId, string> = {
  basics:     [basicsContent, '---', indexContent].join('\n\n'),
  'api-calls': [apiCallsContent, '---', codeableConceptContent, '---', linkagesContent].join('\n\n'),
  assurance:  assuranceContent,
  github:     githubContent,
}

// ─── Tile colours & accents ──────────────────────────────────────────────────

const TILE_COLOURS: Partial<Record<DomainId, string>> = {
  medications:            'border-blue-200   bg-blue-50   dark:bg-blue-950   dark:border-blue-800',
  allergies:              'border-red-200    bg-red-50    dark:bg-red-950    dark:border-red-800',
  problems:               'border-amber-200  bg-amber-50  dark:bg-amber-950  dark:border-amber-800',
  consultations:          'border-green-200  bg-green-50  dark:bg-green-950  dark:border-green-800',
  immunisations:          'border-teal-200   bg-teal-50   dark:bg-teal-950   dark:border-teal-800',
  investigations:         'border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800',
  referrals:              'border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800',
  'diary-entries':        'border-cyan-200   bg-cyan-50   dark:bg-cyan-950   dark:border-cyan-800',
  'coded-data':           'border-indigo-200 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-800',
  documents:              'border-rose-200   bg-rose-50   dark:bg-rose-950   dark:border-rose-800',
  'supporting-resources': 'border-nhs-grey-4 bg-nhs-grey-5 dark:bg-slate-800 dark:border-slate-600',
  lists:                  'border-slate-200  bg-slate-50  dark:bg-slate-900  dark:border-slate-700',
}

const TILE_ACCENT: Partial<Record<DomainId, string>> = {
  medications:            'text-blue-700   dark:text-blue-300',
  allergies:              'text-red-700    dark:text-red-300',
  problems:               'text-amber-700  dark:text-amber-300',
  consultations:          'text-green-700  dark:text-green-300',
  immunisations:          'text-teal-700   dark:text-teal-300',
  investigations:         'text-purple-700 dark:text-purple-300',
  referrals:              'text-orange-700 dark:text-orange-300',
  'diary-entries':        'text-cyan-700   dark:text-cyan-300',
  'coded-data':           'text-indigo-700 dark:text-indigo-300',
  documents:              'text-rose-700   dark:text-rose-300',
  'supporting-resources': 'text-nhs-grey-2 dark:text-slate-300',
  lists:                  'text-slate-600  dark:text-slate-300',
}

interface ApiTileDef {
  id: ApiPageId
  label: string
  description: string
}

const API_TILES: ApiTileDef[] = [
  { id: 'basics',    label: 'Basics of the Service',   description: 'What GP Connect is, how it works over the Spine network, and the key system identifiers and FHIR profiles involved.' },
  { id: 'api-calls', label: 'API Calls and Responses', description: 'Request structure, required headers, include parameters, CodeableConcept terminology, linkages, and the FHIR bundle response format.' },
  { id: 'assurance', label: 'Assurance Process',       description: 'The NHS assurance journey, TKW technical conformance testing, clinical safety standards, and information governance requirements.' },
  { id: 'github',    label: 'GitHub & Developer Tools', description: 'Key GitHub repositories, the OpenAPI specification, HAPI FHIR validation server, test scripts, and the Simplifier.net demonstrator.' },
]

const API_TILE_COLOURS: Record<ApiPageId, string> = {
  basics:      'border-sky-200     bg-sky-50     dark:bg-sky-950     dark:border-sky-800',
  'api-calls': 'border-violet-200  bg-violet-50  dark:bg-violet-950  dark:border-violet-800',
  assurance:   'border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800',
  github:      'border-fuchsia-200 bg-fuchsia-50 dark:bg-fuchsia-950 dark:border-fuchsia-800',
}

const API_TILE_ACCENT: Record<ApiPageId, string> = {
  basics:      'text-sky-700     dark:text-sky-300',
  'api-calls': 'text-violet-700  dark:text-violet-300',
  assurance:   'text-emerald-700 dark:text-emerald-300',
  github:      'text-fuchsia-700 dark:text-fuchsia-300',
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  initialPage?: DomainId | null
  onNavigate?: (page: DomainId | null) => void
}

// ─── Components ──────────────────────────────────────────────────────────────

function DomainTile({ domain, onClick }: { domain: DomainDef; onClick: () => void }) {
  const colour = TILE_COLOURS[domain.id] ?? 'border-nhs-grey-4 bg-nhs-grey-5'
  const accent = TILE_ACCENT[domain.id] ?? 'text-nhs-grey-1'
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-4 hover:shadow-md transition-shadow space-y-2 ${colour}`}
    >
      <h3 className={`text-sm font-semibold ${accent}`}>{domain.label}</h3>
      <p className="text-xs text-nhs-grey-2 dark:text-slate-300 leading-relaxed">{domain.description}</p>
      <div className="flex flex-wrap gap-1 pt-1">
        {domain.fhirResources.map(r => (
          <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-white/10 border border-white dark:border-white/20 text-nhs-grey-2 dark:text-slate-300 font-mono">
            {r}
          </span>
        ))}
      </div>
      <div className={`text-[11px] font-medium ${accent} pt-1`}>Open guide →</div>
    </button>
  )
}

function ApiTile({ tile, onClick }: { tile: ApiTileDef; onClick: () => void }) {
  const colour = API_TILE_COLOURS[tile.id]
  const accent = API_TILE_ACCENT[tile.id]
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-4 hover:shadow-md transition-shadow space-y-2 ${colour}`}
    >
      <h3 className={`text-sm font-semibold ${accent}`}>{tile.label}</h3>
      <p className="text-xs text-nhs-grey-2 dark:text-slate-300 leading-relaxed">{tile.description}</p>
      <div className={`text-[11px] font-medium ${accent} pt-1`}>Open guide →</div>
    </button>
  )
}

function IntroPage({ onSelect }: { onSelect: (id: PageId) => void }) {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-nhs-grey-1 dark:text-slate-100">GP Connect Training Resources</h2>
        <p className="text-sm text-nhs-grey-2 dark:text-slate-300 leading-relaxed max-w-2xl">
          These guides explain how each clinical domain in GP Connect Access Record Structured is modelled using FHIR STU3. They cover the key resources, CareConnect extensions, field meanings, and gotchas to be aware of when building or testing GP Connect integrations.
        </p>
        <p className="text-xs text-nhs-grey-3 dark:text-slate-400 leading-relaxed max-w-2xl">
          Select a domain below to open its training guide. When viewing clinical records, use the <strong>Training guide</strong> link at the top of each section to jump directly to the relevant page.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1 dark:text-slate-100 uppercase tracking-wide">API Integration</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {API_TILES.map(tile => (
            <ApiTile key={tile.id} tile={tile} onClick={() => onSelect(tile.id)} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1 dark:text-slate-100 uppercase tracking-wide">Clinical domains</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {DOMAINS.filter(d => !['supporting-resources', 'lists'].includes(d.id)).map(domain => (
            <DomainTile key={domain.id} domain={domain} onClick={() => onSelect(domain.id)} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1 dark:text-slate-100 uppercase tracking-wide">Infrastructure</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {DOMAINS.filter(d => ['supporting-resources', 'lists'].includes(d.id)).map(domain => (
            <DomainTile key={domain.id} domain={domain} onClick={() => onSelect(domain.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}

interface TrainingPageExtras {
  overrideContent?: string
  notes: TrainingNote[]
  isAdmin: boolean
  onEdit: () => void
  onAddNote: (pageId: string, body: string) => Promise<void>
  onUpdateNote: (id: string, body: string) => Promise<void>
  onDeleteNote: (id: string) => Promise<void>
}

function PageEditBar({ isAdmin, onEdit }: { isAdmin: boolean; onEdit: () => void }) {
  if (!isAdmin) return null
  return (
    <button
      onClick={onEdit}
      className="ml-auto text-xs text-nhs-blue hover:underline flex items-center gap-1"
    >
      <PencilIcon className="w-3 h-3" />
      Edit page
    </button>
  )
}

function DomainPage({ domainId, onBack, overrideContent, notes, isAdmin, onEdit, onAddNote, onUpdateNote, onDeleteNote }: { domainId: DomainId; onBack: () => void } & TrainingPageExtras) {
  const domain = DOMAINS.find(d => d.id === domainId)!
  const accent = TILE_ACCENT[domainId] ?? 'text-nhs-grey-1'
  const colour = TILE_COLOURS[domainId] ?? 'border-nhs-grey-4 bg-white'
  const effectiveContent = overrideContent ?? DOMAIN_CONTENT[domainId]
  const headings = extractHeadings(effectiveContent)

  return (
    <div className="max-w-[76.8rem] mx-auto py-6 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-xs text-nhs-grey-3 dark:text-slate-400 hover:text-nhs-grey-1 dark:hover:text-slate-100 hover:underline flex items-center gap-1"
        >
          ← Back to overview
        </button>
        <PageEditBar isAdmin={isAdmin} onEdit={onEdit} />
      </div>

      <div className="flex gap-6 items-start">
        <aside className="hidden md:block w-44 lg:w-52 shrink-0">
          <TableOfContents headings={headings} />
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          <div className={`rounded-lg border-2 p-5 space-y-3 ${colour}`}>
            <div className="flex items-start justify-between gap-4">
              <h2 className={`text-lg font-bold ${accent}`}>{domain.label}</h2>
              <div className="flex flex-wrap gap-1 justify-end shrink-0">
                {domain.fhirResources.map(r => (
                  <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 dark:bg-white/10 border border-white dark:border-white/20 text-nhs-grey-2 dark:text-slate-300 font-mono">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-nhs-grey-2 dark:text-slate-300 leading-relaxed">{domain.description}</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-nhs-grey-4 dark:border-slate-600 p-6">
            <MarkdownContent content={effectiveContent} />
          </div>

          <TrainingNotesPanel pageId={domainId} notes={notes} onAdd={onAddNote} onUpdate={onUpdateNote} onDelete={onDeleteNote} />
        </div>
      </div>
    </div>
  )
}

function ApiPage({ pageId, onBack, overrideContent, notes, isAdmin, onEdit, onAddNote, onUpdateNote, onDeleteNote }: { pageId: ApiPageId; onBack: () => void } & TrainingPageExtras) {
  const tile = API_TILES.find(t => t.id === pageId)!
  const accent = API_TILE_ACCENT[pageId]
  const colour = API_TILE_COLOURS[pageId]
  const effectiveContent = overrideContent ?? API_CONTENT[pageId]
  const headings = extractHeadings(effectiveContent)

  return (
    <div className="max-w-[76.8rem] mx-auto py-6 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-xs text-nhs-grey-3 dark:text-slate-400 hover:text-nhs-grey-1 dark:hover:text-slate-100 hover:underline flex items-center gap-1"
        >
          ← Back to overview
        </button>
        <PageEditBar isAdmin={isAdmin} onEdit={onEdit} />
      </div>

      <div className="flex gap-6 items-start">
        <aside className="hidden md:block w-44 lg:w-52 shrink-0">
          <TableOfContents headings={headings} />
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          <div className={`rounded-lg border-2 p-5 ${colour}`}>
            <h2 className={`text-lg font-bold ${accent}`}>{tile.label}</h2>
            <p className="text-sm text-nhs-grey-2 dark:text-slate-300 leading-relaxed mt-2">{tile.description}</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-nhs-grey-4 dark:border-slate-600 p-6">
            <MarkdownContent content={effectiveContent} />
          </div>

          <TrainingNotesPanel pageId={pageId} notes={notes} onAdd={onAddNote} onUpdate={onUpdateNote} onDelete={onDeleteNote} />
        </div>
      </div>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function TrainingView({ initialPage, onNavigate }: Props) {
  const [page, setPage] = useState<PageId | null>(initialPage ?? null)
  const [editingPage, setEditingPage] = useState<PageId | null>(null)

  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { overrides, refetch: refetchOverrides } = useTrainingContentOverrides()
  const { notesByPage, addNote, updateNote, deleteNote } = useTrainingNotes()

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage ?? null)
  }, [initialPage])

  const navigate = (p: PageId | null) => {
    setPage(p)
    if (!p || !isApiPageId(p)) onNavigate?.(p as DomainId | null)
  }

  const staticContentFor = (id: PageId) => isApiPageId(id) ? API_CONTENT[id] : DOMAIN_CONTENT[id]

  return (
    <div className="h-full overflow-auto p-4 bg-nhs-grey-5 dark:bg-slate-900">
      {page === null
        ? <IntroPage onSelect={id => navigate(id)} />
        : isApiPageId(page)
          ? (
            <ApiPage
              pageId={page}
              onBack={() => navigate(null)}
              overrideContent={overrides[page]?.content}
              notes={notesByPage[page] ?? []}
              isAdmin={isAdmin}
              onEdit={() => setEditingPage(page)}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
            />
          )
          : (
            <DomainPage
              domainId={page}
              onBack={() => navigate(null)}
              overrideContent={overrides[page]?.content}
              notes={notesByPage[page] ?? []}
              isAdmin={isAdmin}
              onEdit={() => setEditingPage(page)}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
            />
          )
      }

      {editingPage !== null && (
        <TrainingContentEditor
          pageId={editingPage}
          title={isApiPageId(editingPage) ? API_TILES.find(t => t.id === editingPage)!.label : DOMAINS.find(d => d.id === editingPage)!.label}
          initialContent={overrides[editingPage]?.content ?? staticContentFor(editingPage)}
          hasOverride={editingPage in overrides}
          onSaved={() => { refetchOverrides(); setEditingPage(null) }}
          onReverted={() => { refetchOverrides(); setEditingPage(null) }}
          onClose={() => setEditingPage(null)}
        />
      )}
    </div>
  )
}
