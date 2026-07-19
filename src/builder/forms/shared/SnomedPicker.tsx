import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FormField } from './FormField'
import { useAnchoredDropdown } from '../../../hooks/useAnchoredDropdown'
import { InfoHint } from '../../../onboarding/InfoHint'

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

// Mirrors server/src/fhir/mappers.ts SnomedDetail — generic CodeSystem/$lookup
// detail for any SNOMED concept (there's no fixed attribute set the way
// there is for dm+d, since a disorder's attributes differ from a procedure's).
interface SnomedDesignation {
  language?: string
  use?: string
  value: string
}

interface SnomedAttribute {
  attributeName: string
  valueDisplay?: string
  valueCode?: string
  valueNumber?: number
}

interface SnomedDetail {
  code: string
  display: string
  inactive?: boolean
  parentCodes: string[]
  childCodes: string[]
  designations: SnomedDesignation[]
  attributes: SnomedAttribute[]
}

export interface SnomedPickerProps {
  /** Current free-text value — also the search query and the description shown if no code is linked */
  value: string
  /** Called on every text edit or when a search result is selected. `semanticTag`
   * (e.g. "observable entity") is only present when a search result was picked. */
  onChange: (result: { value: string; code?: string; semanticTag?: string }) => void
  /** Current SNOMED code linked to `value`, if any */
  code?: string
  label?: string
  /** Comma-separated SNOMED semantic tags to filter results, e.g. "disorder,finding" */
  semanticTag?: string
  required?: boolean
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const CONFIG_KEY = 'gpc-snomed-config'

function loadConfig(): Partial<SnomedConfig> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const parsed: Partial<SnomedConfig> = JSON.parse(raw)
      // Migrate stale localhost:3000 references to :3001
      if (parsed.serverUrl === 'http://localhost:3000') {
        parsed.serverUrl = 'http://localhost:3001'
        localStorage.setItem(CONFIG_KEY, JSON.stringify(parsed))
      }
      return parsed
    }
  } catch {}
  // In production the Vercel API proxy is on the same origin — auto-connect with no token
  if (!import.meta.env.DEV) {
    const cfg: SnomedConfig = { serverUrl: DEFAULT_SERVER_URL, token: '' }
    saveConfig(cfg)
    return cfg
  }
  return {}
}

function saveConfig(cfg: Partial<SnomedConfig>): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...loadConfig(), ...cfg }))
  } catch {}
}

// In dev the Express proxy runs separately; in production the /api routes are
// Vercel serverless functions on the same origin.
const DEFAULT_SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin

// ---------------------------------------------------------------------------
// Info modal (production) — copyright notice + connection status
// ---------------------------------------------------------------------------

function SnomedInfoModal({ serverUrl, onClose }: { serverUrl: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-nhs-grey-4 dark:border-nhs-grey-2 w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100">
            SNOMED CT — Connection Status
          </h2>
          <button onClick={onClose} className="text-nhs-grey-3 hover:text-nhs-grey-1 dark:hover:text-gray-200">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4 text-xs font-medium text-green-700 dark:text-green-400">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Connected via NHS Terminology Server proxy
        </div>

        <p className="text-xs text-nhs-grey-3 dark:text-gray-400 leading-relaxed">
          This application uses SNOMED Clinical Terms® (SNOMED CT®). SNOMED CT® is the intellectual
          property of SNOMED International. All rights reserved. SNOMED CT® was originally created
          by the College of American Pathologists. "SNOMED" and "SNOMED CT" are registered
          trademarks of SNOMED International.
        </p>
        <p className="text-xs text-nhs-grey-3 dark:text-gray-400 mt-2 leading-relaxed">
          SNOMED CT content is licensed through the NHS Terminology Server. Terminology searches are
          proxied server-side; no credentials are stored in your browser.
        </p>

        <div className="mt-3 pt-3 border-t border-nhs-grey-4 dark:border-gray-700">
          <p className="text-xs text-nhs-grey-3 dark:text-gray-500 font-mono truncate">{serverUrl}/api/snomed</p>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-1.5 bg-nhs-blue text-white rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Config modal (dev only) — full server URL + token configuration
// ---------------------------------------------------------------------------

interface ConfigModalProps {
  onClose: () => void
  onSaved: (cfg: SnomedConfig) => void
}

function ConfigModal({ onClose, onSaved }: ConfigModalProps) {
  const saved = loadConfig()
  const [serverUrl, setServerUrl] = useState(saved.serverUrl ?? DEFAULT_SERVER_URL)
  // 'proxy' = NHS Terminology Proxy (no user token needed)
  // 'token' = direct server with a bearer JWT
  const [mode, setMode] = useState<'proxy' | 'token'>(saved.token ? 'token' : 'proxy')
  const [pastedToken, setPastedToken] = useState(saved.token ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const url = serverUrl.replace(/\/$/, '')

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
          <button onClick={onClose} className="text-nhs-grey-3 hover:text-nhs-grey-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">
            Server URL
          </label>
          <input
            className={inputCls}
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder={DEFAULT_SERVER_URL}
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
            <p className="text-xs text-nhs-grey-3">
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
              <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">Bearer Token</label>
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

export function SnomedPicker({ value, onChange, code, label = 'SNOMED CT', semanticTag, required }: SnomedPickerProps) {
  const [config, setConfig] = useState<Partial<SnomedConfig>>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)

  const [results, setResults] = useState<SnomedResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Dev-only: raw request/response for inspecting SNOMED calls without Postman/DevTools
  const [debugInfo, setDebugInfo] = useState<{ url: string; status: number; raw: unknown } | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [lookupDetail, setLookupDetail] = useState<SnomedDetail | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dropdownOpen = isOpen && results.length > 0
  const dropdownPos = useAnchoredDropdown(inputRef, dropdownOpen)

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
      if (import.meta.env.DEV) {
        const cloned = res.clone()
        cloned.json().then(raw => { setDebugInfo({ url, status: res.status, raw }); setLookupDetail(null) }).catch(() => {})
      }
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

  // Search is triggered imperatively from actual keystrokes (not reactively off
  // `value`) so that loading an existing coded value never auto-opens the dropdown.
  const triggerSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => search(text, config), 300)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

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

  const handleTextChange = (v: string) => {
    onChange({ value: v, code: undefined })
    triggerSearch(v)
  }

  const handleSelect = (r: SnomedResult) => {
    onChange({ value: r.display_term, code: r.code, semanticTag: r.semantic_tag })
    setIsOpen(false)
  }

  const handleClearCode = () => {
    onChange({ value, code: undefined })
  }

  // Dev-only: fetch full CodeSystem/$lookup detail for the linked code and
  // surface it in the debug panel below.
  const handleLookupDetails = async () => {
    if (!config.serverUrl || !code) return
    setDebugOpen(true)
    try {
      const params = new URLSearchParams({ code })
      const url = `${config.serverUrl}/api/snomed/lookup?${params}`
      const headers: HeadersInit = {}
      if (config.token) headers['Authorization'] = `Bearer ${config.token}`
      const res = await fetch(url, { headers })
      const body = await res.json() as { raw: unknown; detail?: SnomedDetail }
      setDebugInfo({ url, status: res.status, raw: body })
      setLookupDetail(body.detail ?? null)
    } catch (e) {
      setDebugInfo({ url: `${config.serverUrl}/api/snomed/lookup?code=${code}`, status: 0, raw: { error: (e as Error).message } })
      setLookupDetail(null)
    }
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
    'bg-nhs-grey-5 text-nhs-grey-2 dark:bg-gray-700'

  return (
    <>
      <FormField label={label} required={required}>
        <div className="space-y-1">
          {/* Search row + dropdown (relative wrapper so dropdown is anchored here) */}
          <div className="relative">
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={e => handleTextChange(e.target.value)}
                  onFocus={() => results.length > 0 && setIsOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={isConnected ? 'Search SNOMED CT or type free text…' : 'Type free text (configure server to enable SNOMED search)'}
                  required={required}
                  className={
                    'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
                    'text-nhs-grey-1 dark:bg-gray-800 ' +
                    (code ? 'pr-24 ' : 'pr-8 ') +
                    'focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'
                  }
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isLoading && (
                    <svg className="w-3.5 h-3.5 animate-spin text-nhs-blue" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {code && !isLoading && (
                    <span
                      className="flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded bg-nhs-blue/10 text-nhs-blue dark:bg-blue-900/40 dark:text-blue-300"
                      title={`SNOMED CT ${code} — click × to unlink and keep as free text`}
                    >
                      {code}
                      {import.meta.env.DEV && (
                        <button type="button" onClick={handleLookupDetails} className="hover:opacity-70" title="Fetch full $lookup detail (dev only)">🔍</button>
                      )}
                      <button type="button" onClick={handleClearCode} className="hover:opacity-70" title="Unlink code">×</button>
                    </span>
                  )}
                </div>
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
              <InfoHint topic="builder.snomed-picker" />
            </div>

            {/* Error message */}
            {error && <p className="mt-1 text-xs text-nhs-red">{error}</p>}

            {import.meta.env.DEV && debugInfo && (
              <div className="mt-1 border border-dashed border-nhs-grey-4 dark:border-nhs-grey-2 rounded text-xs">
                <button
                  type="button"
                  onClick={() => setDebugOpen(o => !o)}
                  className="w-full flex items-center justify-between px-2 py-1 text-nhs-grey-3 hover:text-nhs-blue font-mono"
                >
                  <span>SNOMED debug (dev only) — HTTP {debugInfo.status}</span>
                  <span>{debugOpen ? '▲' : '▼'}</span>
                </button>
                {debugOpen && (
                  <div className="border-t border-dashed border-nhs-grey-4 dark:border-nhs-grey-2 p-2 space-y-2">
                    <p className="font-mono text-nhs-grey-3 break-all">{debugInfo.url}</p>
                    {lookupDetail && (
                      <table className="w-full text-[11px]">
                        <tbody>
                          {lookupDetail.designations.length > 0 && (
                            <tr>
                              <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Synonyms</td>
                              <td className="text-nhs-grey-1 dark:text-gray-200">
                                {lookupDetail.designations.map((d, i) => (
                                  <div key={i}>{d.value}{d.use && <span className="text-nhs-grey-3"> ({d.use})</span>}</div>
                                ))}
                              </td>
                            </tr>
                          )}
                          {lookupDetail.attributes.length > 0 && (
                            <tr>
                              <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Attributes</td>
                              <td className="text-nhs-grey-1 dark:text-gray-200">
                                {lookupDetail.attributes.map((a, i) => (
                                  <div key={i}>
                                    {a.attributeName}: {a.valueDisplay ?? a.valueNumber ?? a.valueCode}
                                  </div>
                                ))}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Parents</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200 font-mono">{lookupDetail.parentCodes.join(', ') || '—'}</td>
                          </tr>
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Children</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200 font-mono">{lookupDetail.childCodes.join(', ') || '—'}</td>
                          </tr>
                          {lookupDetail.inactive !== undefined && (
                            <tr>
                              <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Inactive</td>
                              <td className="text-nhs-grey-1 dark:text-gray-200">{String(lookupDetail.inactive)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                    <pre className="max-h-64 overflow-auto bg-nhs-grey-5 dark:bg-gray-800 rounded p-2 font-mono text-[11px] text-nhs-grey-1 dark:text-gray-200">
                      {JSON.stringify(debugInfo.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Dropdown — rendered via portal so it isn't clipped by an
                ancestor with overflow:hidden (e.g. a collapsible card) */}
            {dropdownOpen && dropdownPos && createPortal(
              <div
                ref={dropdownRef}
                style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                className="z-50 max-h-80 overflow-y-auto bg-white dark:bg-gray-900 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg shadow-lg"
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
                        <span className="text-xs text-nhs-grey-3 block truncate">{r.fully_specified_name}</span>
                      )}
                    </span>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${tagCls(r.semantic_tag)}`}>
                      {r.semantic_tag}
                    </span>
                  </button>
                ))}
              </div>,
              document.body,
            )}
          </div>
        </div>
      </FormField>

      {showConfig && (
        import.meta.env.DEV ? (
          <ConfigModal
            onClose={() => setShowConfig(false)}
            onSaved={cfg => { setConfig(cfg); setShowConfig(false) }}
          />
        ) : (
          <SnomedInfoModal
            serverUrl={config.serverUrl ?? DEFAULT_SERVER_URL}
            onClose={() => setShowConfig(false)}
          />
        )
      )}
    </>
  )
}
