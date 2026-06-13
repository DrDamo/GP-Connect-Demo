import { useState, useEffect, useRef, useCallback } from 'react'
import { FormField } from './FormField'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnomedResult {
  code: string
  display_term: string
  fully_specified_name: string
  semantic_tag: string
}

interface SnomedConfig {
  serverUrl: string
  token: string
}

export interface SnomedPickerProps {
  /** Current SNOMED code value */
  code?: string
  /** Current display term (shown as hint in search box) */
  display?: string
  /** Called when user selects a concept */
  onSelect: (result: { code: string; display: string }) => void
  label?: string
  /** Comma-separated SNOMED semantic tags to filter results, e.g. "disorder,finding" */
  semanticTag?: string
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const CONFIG_KEY = 'gpc-snomed-config'

function loadConfig(): Partial<SnomedConfig> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveConfig(cfg: Partial<SnomedConfig>): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...loadConfig(), ...cfg }))
  } catch {}
}

// ---------------------------------------------------------------------------
// Config modal
// ---------------------------------------------------------------------------

interface ConfigModalProps {
  onClose: () => void
  onSaved: (cfg: SnomedConfig) => void
}

function ConfigModal({ onClose, onSaved }: ConfigModalProps) {
  const saved = loadConfig()
  // Default to the local proxy; legacy users who pointed to a custom server keep their URL
  const [serverUrl, setServerUrl] = useState(saved.serverUrl ?? 'http://localhost:3001')
  // 'proxy' = NHS Terminology Proxy (no user token needed)
  // 'token' = direct server with a bearer JWT
  const [mode, setMode] = useState<'proxy' | 'token'>(saved.token ? 'token' : 'proxy')
  const [pastedToken, setPastedToken] = useState(saved.token ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const url = serverUrl.replace(/\/$/, '')

  // Proxy mode: verify by hitting /api/health
  const handleProxyConnect = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`${url}/api/health`)
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`)
      const cfg: SnomedConfig = { serverUrl: url, token: '' }
      saveConfig(cfg)
      onSaved(cfg)
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Token mode: verify by attempting a test search with the supplied JWT
  const handleTokenConnect = async () => {
    if (!pastedToken.trim()) { setStatus('Enter a token first'); return }
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`${url}/api/snomed/search?q=test&limit=1`, {
        headers: { Authorization: `Bearer ${pastedToken}` },
      })
      if (!res.ok) throw new Error(`Token rejected (HTTP ${res.status})`)
      const cfg: SnomedConfig = { serverUrl: url, token: pastedToken }
      saveConfig(cfg)
      onSaved(cfg)
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
    'text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-nhs-grey-4 dark:border-nhs-grey-2 w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-nhs-grey-1">
            Connect to Terminology Server
          </h2>
          <button onClick={onClose} className="text-nhs-grey-3 hover:text-nhs-grey-1 dark:hover:text-nhs-grey-5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-nhs-grey-3 dark:text-nhs-grey-4 uppercase tracking-wide mb-0.5">
            Server URL
          </label>
          <input
            className={inputCls}
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="http://localhost:3001"
          />
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode('proxy')}
            className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'proxy' ? 'bg-nhs-blue text-white' : 'border border-nhs-grey-4 text-nhs-grey-2 hover:border-nhs-blue hover:text-nhs-blue'}`}
          >
            NHS Proxy
          </button>
          <button
            onClick={() => setMode('token')}
            className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'token' ? 'bg-nhs-blue text-white' : 'border border-nhs-grey-4 text-nhs-grey-2 hover:border-nhs-blue hover:text-nhs-blue'}`}
          >
            Bearer token
          </button>
        </div>

        {mode === 'proxy' ? (
          <div className="space-y-2">
            <p className="text-xs text-nhs-grey-3 dark:text-nhs-grey-4">
              Use this mode when connecting to the NHS Terminology Proxy (<code>server/</code>). Credentials are managed server-side — no token needed here.
            </p>
            <button
              onClick={handleProxyConnect}
              disabled={busy || !url}
              className="w-full py-1.5 bg-nhs-blue text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Testing…' : 'Test & Connect'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-nhs-grey-3 dark:text-nhs-grey-4 uppercase tracking-wide mb-0.5">Bearer Token</label>
              <textarea
                className={`${inputCls} font-mono text-xs resize-none`}
                rows={3}
                value={pastedToken}
                onChange={e => setPastedToken(e.target.value.trim())}
                placeholder="Paste your Bearer token here…"
              />
            </div>
            <button
              onClick={handleTokenConnect}
              disabled={busy || !pastedToken}
              className="w-full py-1.5 bg-nhs-blue text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Verifying…' : 'Verify & Save'}
            </button>
          </div>
        )}

        {status && (
          <p className="mt-2 text-xs text-nhs-red">{status}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SnomedPicker
// ---------------------------------------------------------------------------

export function SnomedPicker({ code, display, onSelect, label = 'SNOMED CT', semanticTag }: SnomedPickerProps) {
  const [config, setConfig] = useState<Partial<SnomedConfig>>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SnomedResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Proxy mode stores an empty token; direct-server mode stores a JWT.
  // Both are considered connected as long as a serverUrl is present.
  const isConnected = Boolean(config.serverUrl)

  // Search function
  const search = useCallback(async (q: string, cfg: Partial<SnomedConfig>) => {
    if (!cfg.serverUrl || q.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q, limit: '10', sort: 'relevance' })
      if (semanticTag) params.set('semantic_tag', semanticTag)
      const url = `${cfg.serverUrl}/api/snomed/search?${params}`
      const headers: HeadersInit = {}
      if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`
      const res = await fetch(url, { headers })
      if (res.status === 401) {
        setError('Token expired — reconnect via the settings icon')
        setResults([])
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResults((data.codes ?? []).map((c: Record<string, unknown>) => ({
        code: c.code as string,
        display_term: c.display_term as string,
        fully_specified_name: c.fully_specified_name as string,
        semantic_tag: c.semantic_tag as string,
      })))
      setIsOpen(true)
      setActiveIdx(0)
    } catch (e) {
      setError((e as Error).message)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [semanticTag])

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => search(query, config), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, config, search])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (r: SnomedResult) => {
    onSelect({ code: r.code, display: r.display_term })
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); if (results[activeIdx]) handleSelect(results[activeIdx]) }
    if (e.key === 'Escape') { setIsOpen(false) }
  }

  const tagColour: Record<string, string> = {
    disorder: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    finding: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    procedure: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    substance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    product: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    observable: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  }
  const tagCls = (tag: string) =>
    tagColour[Object.keys(tagColour).find(k => tag.includes(k)) ?? ''] ??
    'bg-nhs-grey-5 text-nhs-grey-2 dark:bg-gray-700 dark:text-nhs-grey-4'

  return (
    <>
      <FormField label={label}>
        <div className="space-y-1">
          {/* Current value display */}
          {(code || display) && (
            <div className="flex items-center gap-2 px-2 py-1 bg-nhs-grey-5 dark:bg-gray-800 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 text-xs">
              <span className="font-mono text-nhs-blue dark:text-blue-400 shrink-0">{code}</span>
              {display && <span className="text-nhs-grey-1 truncate">{display}</span>}
              <button
                type="button"
                onClick={() => onSelect({ code: '', display: '' })}
                className="ml-auto text-nhs-grey-3 hover:text-nhs-red transition-colors shrink-0"
                title="Clear"
              >
                ×
              </button>
            </div>
          )}

          {/* Search row + dropdown (relative wrapper so dropdown is anchored here) */}
          <div className="relative">
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => results.length > 0 && setIsOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={isConnected ? 'Search SNOMED CT…' : 'Configure server to enable search'}
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

              {/* Settings button */}
              <button
                type="button"
                onClick={() => setShowConfig(true)}
                title={isConnected ? 'SNOMED search connected — click to reconfigure' : 'Configure SNOMED search'}
                className={
                  'shrink-0 p-1.5 rounded border transition-colors ' +
                  (isConnected
                    ? 'border-green-400 text-green-600 dark:border-green-600 dark:text-green-400 hover:border-nhs-blue hover:text-nhs-blue'
                    : 'border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-3 hover:border-nhs-blue hover:text-nhs-blue')
                }
              >
                {isConnected ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Error message */}
            {error && <p className="mt-1 text-xs text-nhs-red">{error}</p>}

            {/* Dropdown — anchored to the top of this relative wrapper */}
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
                    <span className="font-mono text-xs text-nhs-blue dark:text-blue-400 shrink-0 mt-0.5 w-24 truncate">{r.code}</span>
                    <span className="flex-1 min-w-0">
                      <span className="text-nhs-grey-1 block truncate">{r.display_term}</span>
                      {r.fully_specified_name !== r.display_term && (
                        <span className="text-xs text-nhs-grey-3 dark:text-nhs-grey-4 block truncate">{r.fully_specified_name}</span>
                      )}
                    </span>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${tagCls(r.semantic_tag)}`}>
                      {r.semantic_tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </FormField>

      {showConfig && (
        <ConfigModal
          onClose={() => setShowConfig(false)}
          onSaved={cfg => { setConfig(cfg); setShowConfig(false) }}
        />
      )}
    </>
  )
}
