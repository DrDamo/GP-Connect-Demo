import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FormField } from './FormField'
import { useAnchoredDropdown, widenDropdown } from '../../../hooks/useAnchoredDropdown'
import { InfoHint } from '../../../onboarding/InfoHint'

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

interface ConceptRef {
  code: string
  display: string
}

// Mirrors server/src/fhir/mappers.ts DmdDetail — strength/dose-form/route
// parsed server-side from CodeSystem/$lookup's `normalForm` expression.
interface DmdDetail {
  code: string
  display: string
  type: DmdType
  inactive?: boolean
  isCombinationProduct: boolean
  activeIngredient?: ConceptRef
  preciseActiveIngredient?: ConceptRef
  basisOfStrengthSubstance?: ConceptRef
  strength?: {
    numeratorValue?: number
    numeratorUnit?: ConceptRef
    denominatorValue?: number
    denominatorUnit?: ConceptRef
  }
  dispensedDoseForm?: ConceptRef
  basicDoseForm?: ConceptRef
  route?: ConceptRef
  ontologyFormAndRoute?: ConceptRef
  supplier?: ConceptRef
  controlledDrugCategory?: ConceptRef
  prescribingStatus?: ConceptRef
  nonAvailability?: ConceptRef
  parentCodes: string[]
  childCodes: string[]
  parentVmp?: ConceptRef
  fromParentVmp?: string[]
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
  /** Current free-text value — also the search query and the drug name shown if no code is linked */
  value: string
  /** Called on every text edit or when a search result is selected */
  onChange: (result: { value: string; code?: string; system?: string; dmdType: DmdType }) => void
  code?: string
  dmdType?: DmdType
  label?: string
  required?: boolean
}

// ---------------------------------------------------------------------------
// DmdPicker
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<DmdType, string> = {
  VMP: 'VMP — generic product',
  AMP: 'AMP — branded product',
}

export function DmdPicker({ value, onChange, code, dmdType = 'VMP', label = 'dm+d', required }: DmdPickerProps) {
  const [config, setConfig] = useState<Partial<TerminologyConfig>>(loadConfig)
  const [activeType, setActiveType] = useState<DmdType>(dmdType)

  const [results, setResults] = useState<DmdResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Dev-only: raw request/response for inspecting dm+d calls without Postman/DevTools
  const [debugInfo, setDebugInfo] = useState<{ url: string; status: number; raw: unknown } | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [lookupDetail, setLookupDetail] = useState<DmdDetail | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dropdownOpen = isOpen && results.length > 0
  const dropdownPos = useAnchoredDropdown(inputRef, dropdownOpen)

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
      const params = new URLSearchParams({ q, type: type.toLowerCase(), limit: '25' })
      const url = `${cfg.serverUrl}/api/dmd/search?${params}`
      const headers: HeadersInit = {}
      if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`
      const res = await fetch(url, { headers })
      if (import.meta.env.DEV) {
        const cloned = res.clone()
        cloned.json().then(raw => { setDebugInfo({ url, status: res.status, raw }); setLookupDetail(null) }).catch(() => {})
      }
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

  // Search is triggered imperatively from actual keystrokes (not reactively off
  // `value`) so that loading an existing coded value never auto-opens the dropdown.
  const triggerSearch = (text: string, type: DmdType) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 2) { setResults([]); setIsOpen(false); return }
    debounceRef.current = setTimeout(() => search(text, config, type), 300)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

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

  const handleTextChange = (v: string) => {
    onChange({ value: v, code: undefined, dmdType: activeType })
    triggerSearch(v, activeType)
  }

  const handleSelect = (r: DmdResult) => {
    onChange({ value: r.display, code: r.code, system: r.system, dmdType: r.type })
    setIsOpen(false)
  }

  const handleClearCode = () => {
    onChange({ value, code: undefined, dmdType: activeType })
  }

  // Dev-only: fetch full CodeSystem/$lookup detail for the linked code and
  // surface it in the debug panel below (dm+d codes are SNOMED CT concepts).
  const handleLookupDetails = async () => {
    if (!config.serverUrl || !code) return
    setDebugOpen(true)
    try {
      const params = new URLSearchParams({ code, type: dmdType.toLowerCase() })
      const url = `${config.serverUrl}/api/dmd/lookup?${params}`
      const headers: HeadersInit = {}
      if (config.token) headers['Authorization'] = `Bearer ${config.token}`
      const res = await fetch(url, { headers })
      const body = await res.json() as { raw: unknown; detail?: DmdDetail }
      setDebugInfo({ url, status: res.status, raw: body })
      setLookupDetail(body.detail ?? null)
    } catch (e) {
      setDebugInfo({ url: `${config.serverUrl}/api/dmd/lookup?code=${code}`, status: 0, raw: { error: (e as Error).message } })
      setLookupDetail(null)
    }
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
    <FormField label={label} required={required}>
      <div className="space-y-1">
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
          <InfoHint topic="builder.dmd-picker" className="self-center" />
        </div>

        {/* Search row */}
        <div className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => handleTextChange(e.target.value)}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? `Search dm+d ${activeType} or type free text…` : 'Type free text (configure server to enable dm+d search)'}
              required={required}
              title={value}
              className={
                'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm truncate ' +
                'text-nhs-grey-1 dark:bg-gray-800 ' +
                (code ? 'pr-16 ' : 'pr-8 ') +
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
                // dm+d codes can run to 15 digits — showing them inline
                // overflowed the reserved gutter and bled over the term text
                // in a narrow box. dmdType (VMP/AMP/…) is always short and
                // stays visible; the full code is still on the tooltip.
                <span
                  className={`flex items-center gap-1 shrink-0 text-xs font-mono px-1.5 py-0.5 rounded ${typeCls(dmdType)}`}
                  title={`${value} — dm+d ${dmdType} ${code} — click × to unlink and keep as free text`}
                >
                  {dmdType}
                  {import.meta.env.DEV && (
                    <button type="button" onClick={handleLookupDetails} className="hover:opacity-70" title="Fetch full $lookup detail (dev only)">🔍</button>
                  )}
                  <button type="button" onClick={handleClearCode} className="hover:opacity-70" title="Unlink code">×</button>
                </span>
              )}
            </div>
          </div>

          {error && <p className="mt-1 text-xs text-nhs-red">{error}</p>}

          {import.meta.env.DEV && debugInfo && (
            <div className="mt-1 border border-dashed border-nhs-grey-4 dark:border-nhs-grey-2 rounded text-xs">
              <button
                type="button"
                onClick={() => setDebugOpen(o => !o)}
                className="w-full flex items-center justify-between px-2 py-1 text-nhs-grey-3 hover:text-nhs-blue font-mono"
              >
                <span>dm+d debug (dev only) — HTTP {debugInfo.status}</span>
                <span>{debugOpen ? '▲' : '▼'}</span>
              </button>
              {debugOpen && (
                <div className="border-t border-dashed border-nhs-grey-4 dark:border-nhs-grey-2 p-2 space-y-2">
                  <p className="font-mono text-nhs-grey-3 break-all">{debugInfo.url}</p>
                  {lookupDetail && (
                    <table className="w-full text-[11px]">
                      <tbody>
                        {lookupDetail.parentVmp && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Note</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">
                              Fields marked <span className="italic">(from VMP)</span> below came from parent VMP-equivalent {lookupDetail.parentVmp.display} ({lookupDetail.parentVmp.code}), not this AMP directly
                            </td>
                          </tr>
                        )}
                        {lookupDetail.isCombinationProduct && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Note</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">Combination product — strength is per-ingredient in SNOMED CT, so it's omitted here</td>
                          </tr>
                        )}
                        {lookupDetail.strength?.numeratorValue !== undefined && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Strength</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">
                              {lookupDetail.strength.numeratorValue}
                              {lookupDetail.strength.numeratorUnit?.display && ` ${lookupDetail.strength.numeratorUnit.display}`}
                              {lookupDetail.strength.denominatorValue !== undefined && ` / ${lookupDetail.strength.denominatorValue}`}
                              {lookupDetail.strength.denominatorUnit?.display && ` ${lookupDetail.strength.denominatorUnit.display}`}
                              {lookupDetail.fromParentVmp?.includes('strength') && <span className="italic text-nhs-grey-3"> (from VMP)</span>}
                            </td>
                          </tr>
                        )}
                        {lookupDetail.basisOfStrengthSubstance && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Basis of strength</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">
                              {lookupDetail.basisOfStrengthSubstance.display}
                              {lookupDetail.fromParentVmp?.includes('basisOfStrengthSubstance') && <span className="italic text-nhs-grey-3"> (from VMP)</span>}
                            </td>
                          </tr>
                        )}
                        {lookupDetail.dispensedDoseForm && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Dose form</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">
                              {lookupDetail.basicDoseForm?.display ?? lookupDetail.dispensedDoseForm.display}
                            </td>
                          </tr>
                        )}
                        {lookupDetail.route && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Route</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">
                              {lookupDetail.route.display}
                              {lookupDetail.fromParentVmp?.includes('route') && <span className="italic text-nhs-grey-3"> (from VMP)</span>}
                            </td>
                          </tr>
                        )}
                        {lookupDetail.supplier && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Supplier</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">{lookupDetail.supplier.display}</td>
                          </tr>
                        )}
                        {lookupDetail.controlledDrugCategory && (
                          <tr>
                            <td className="pr-2 text-nhs-grey-3 align-top whitespace-nowrap">Controlled drug</td>
                            <td className="text-nhs-grey-1 dark:text-gray-200">{lookupDetail.controlledDrugCategory.display}</td>
                          </tr>
                        )}
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

          {dropdownOpen && dropdownPos && createPortal(
            <div
              ref={dropdownRef}
              style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: widenDropdown(dropdownPos) }}
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
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${typeCls(r.type)}`}>{r.type}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-nhs-grey-1 block truncate">{r.display}</span>
                    <span className="text-xs text-nhs-grey-3 font-mono">{r.code}</span>
                  </span>
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>
      </div>
    </FormField>
  )
}
