import { useState, useEffect, useRef, useCallback } from 'react'
import { FormField } from './FormField'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DmdType = 'VMP' | 'AMP'

interface DmdResult {
  code: string
  display: string
  type: DmdType
  system: string
}

interface TerminologyConfig {
  serverUrl: string
  token: string
}

// ---------------------------------------------------------------------------
// Shared localStorage config (same key as SnomedPicker — one server, both pickers)
// ---------------------------------------------------------------------------

const CONFIG_KEY = 'gpc-snomed-config'

function loadConfig(): Partial<TerminologyConfig> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const parsed: Partial<TerminologyConfig> = JSON.parse(raw)
      if (parsed.serverUrl === 'http://localhost:3000') {
        parsed.serverUrl = 'http://localhost:3001'
        localStorage.setItem(CONFIG_KEY, JSON.stringify(parsed))
      }
      return parsed
    }
  } catch {}
  return {}
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DmdPickerProps {
  code?: string
  display?: string
  dmdType?: DmdType
  onSelect: (result: { code: string; display: string; system: string; dmdType: DmdType }) => void
  label?: string
}

// ---------------------------------------------------------------------------
// DmdPicker
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<DmdType, string> = {
  VMP: 'VMP — generic product',
  AMP: 'AMP — branded product',
}

export function DmdPicker({ code, display, dmdType = 'VMP', onSelect, label = 'dm+d' }: DmdPickerProps) {
  const [config, setConfig] = useState<Partial<TerminologyConfig>>(loadConfig)
  const [activeType, setActiveType] = useState<DmdType>(dmdType)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DmdResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-read config if SnomedPicker updates it in the same session
  useEffect(() => {
    const onStorage = () => setConfig(loadConfig())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const isConnected = Boolean(config.serverUrl)

  const search = useCallback(async (q: string, cfg: Partial<TerminologyConfig>, type: DmdType) => {
    if (!cfg.serverUrl || q.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q, type: type.toLowerCase(), limit: '10' })
      const url = `${cfg.serverUrl}/api/dmd/search?${params}`
      const headers: HeadersInit = {}
      if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { codes: DmdResult[] }
      setResults(data.codes ?? [])
      setIsOpen(true)
      setActiveIdx(0)
    } catch (e) {
      setError((e as Error).message)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); setIsOpen(false); return }
    debounceRef.current = setTimeout(() => search(query, config, activeType), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, config, activeType, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (r: DmdResult) => {
    onSelect({ code: r.code, display: r.display, system: r.system, dmdType: r.type })
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); if (results[activeIdx]) handleSelect(results[activeIdx]) }
    if (e.key === 'Escape') setIsOpen(false)
  }

  const typeCls = (t: DmdType) =>
    t === 'VMP'
      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'

  return (
    <FormField label={label}>
      <div className="space-y-1">
        {/* Current value */}
        {(code || display) && (
          <div className="flex items-center gap-2 px-2 py-1 bg-nhs-grey-5 dark:bg-gray-800 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 text-xs">
            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${typeCls(dmdType)}`}>{dmdType}</span>
            <span className="font-mono text-nhs-blue dark:text-blue-400 shrink-0">{code}</span>
            {display && <span className="text-nhs-grey-1 truncate">{display}</span>}
            <button
              type="button"
              onClick={() => onSelect({ code: '', display: '', system: 'https://dmd.nhs.uk', dmdType: activeType })}
              className="ml-auto text-nhs-grey-3 hover:text-nhs-red transition-colors shrink-0"
              title="Clear"
            >
              ×
            </button>
          </div>
        )}

        {/* VMP / AMP toggle */}
        <div className="flex gap-1">
          {(['VMP', 'AMP'] as DmdType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setActiveType(t); setResults([]); setIsOpen(false) }}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                activeType === t
                  ? typeCls(t)
                  : 'border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-3 hover:border-nhs-blue hover:text-nhs-blue'
              }`}
              title={TYPE_LABELS[t]}
            >
              {t}
            </button>
          ))}
          <span className="text-xs text-nhs-grey-3 self-center ml-1">
            {TYPE_LABELS[activeType]}
          </span>
        </div>

        {/* Search row */}
        <div className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? `Search dm+d ${activeType}…` : 'Configure server to enable search'}
              disabled={!isConnected}
              className={
                'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
                'text-nhs-grey-1 dark:bg-gray-800 pr-8 ' +
                'focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue ' +
                'disabled:opacity-50 disabled:cursor-not-allowed'
              }
            />
            {isLoading && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg className="w-3.5 h-3.5 animate-spin text-nhs-blue" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            )}
          </div>

          {error && <p className="mt-1 text-xs text-nhs-red">{error}</p>}

          {isOpen && results.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 z-40 mt-0.5 bg-white dark:bg-gray-900 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg shadow-lg overflow-hidden"
            >
              {results.map((r, idx) => (
                <button
                  key={r.code}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={
                    'w-full text-left px-3 py-2 text-sm flex items-start gap-2 border-b border-nhs-grey-5 dark:border-gray-700 last:border-0 transition-colors ' +
                    (idx === activeIdx ? 'bg-nhs-grey-5 dark:bg-gray-800' : 'hover:bg-nhs-grey-5 dark:hover:bg-gray-800')
                  }
                >
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${typeCls(r.type)}`}>{r.type}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-nhs-grey-1 block truncate">{r.display}</span>
                    <span className="text-xs text-nhs-grey-3 font-mono">{r.code}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </FormField>
  )
}
