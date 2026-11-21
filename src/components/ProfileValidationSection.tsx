import { useEffect, useMemo, useState } from 'react'
import { api, errorMessage, isAuthEnabled } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

// GP Connect STU3 profile validation, run on the server by the HL7 FHIR
// validator against the GP Connect and CareConnect packages (see
// server/src/routes/profileValidation.ts). It complements the quick in-browser
// checks above it: those are structural; this checks every resource against
// its declared CareConnect-GPC profile (cardinality, fixed values, slicing,
// extensions). Terminology is not checked here.

type Severity = 'error' | 'warning' | 'information'

interface ProfileIssue {
  severity: Severity
  code?: string
  text: string
  expression?: string
  line?: number
  resource?: string
  /** The validator could not check this code (no terminology server, or an
   *  unknown code system), so it says nothing about the record itself. */
  unchecked?: true
}

interface ProfileResult {
  packages: string[]
  durationMs: number
  /** Findings by severity, not counting unchecked issues. */
  counts: Record<Severity, number>
  /** Absent from servers older than this field. */
  unchecked?: number
  /** 'nhs' when codes were checked against the NHS England Terminology Server. */
  terminology?: 'nhs' | 'off'
  /** Served from the server's per-user cache (kept for an hour). */
  cached?: boolean
  validatedAt?: string
  issues: ProfileIssue[]
  truncated: boolean
}

interface Props {
  source: string
  format: 'json' | 'xml'
  onJumpToSource?: (id: string) => void
}

const SEVERITIES: { key: Severity; label: string; dot: string; row: string }[] = [
  { key: 'error', label: 'Errors', dot: 'bg-nhs-red text-white', row: 'border-red-300 bg-red-50 text-red-800 dark:border-bad-line dark:bg-bad-bg dark:text-bad' },
  { key: 'warning', label: 'Warnings', dot: 'bg-nhs-yellow text-nhs-grey-1', row: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-warn-line dark:bg-warn-bg dark:text-warn' },
  { key: 'information', label: 'Information', dot: 'bg-nhs-blue-light text-white', row: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-accent-line dark:bg-accent-soft dark:text-accent' },
]

// Same idea as the structural panel's grouping: collapse the quoted values,
// indexes and numbers so one kind of problem across 300 resources is one row.
function patternOf(text: string): string {
  return text
    .replace(/'[^']*'/g, "'…'")
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\[[^\]]*\]/g, '[…]')
    .replace(/\b\d+\b/g, '#')
}

function group(issues: ProfileIssue[]) {
  const map = new Map<string, ProfileIssue[]>()
  for (const i of issues) {
    const k = patternOf(i.text)
    ;(map.get(k) ?? map.set(k, []).get(k)!).push(i)
  }
  return [...map.entries()].map(([key, list]) => ({ key, list })).sort((a, b) => b.list.length - a.list.length)
}

const MAX_LOCATIONS = 200

/** SHA-256 of the record text, matching the server's cache key. */
async function sha256Hex(text: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null // non-secure context
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const timeOf = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''

type Status = { enabled: boolean; packages: string[]; terminology?: 'nhs' | 'off' }

function IssueGroup({ list, row, onJumpToSource }: { list: ProfileIssue[]; row: string; onJumpToSource?: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const sample = list[0]
  return (
    <div className={`rounded border ${row} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between gap-2 px-2.5 py-1.5 text-xs text-left hover:opacity-80">
        <span className="font-medium break-words min-w-0">{sample.text}</span>
        <span className="flex items-center gap-2 shrink-0">
          {list.length > 1 && <span className="px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-surface text-[11px] font-semibold">{list.length}</span>}
          <span className="text-[10px]">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="p-1.5 space-y-0.5 bg-white dark:bg-surface">
          {list.slice(0, MAX_LOCATIONS).map((i, n) => {
            const id = i.resource?.split('/')[1]
            return (
              <div key={n} className="pl-2 text-xs text-nhs-grey-1 dark:text-ink flex flex-wrap gap-x-2">
                {i.resource && (id && onJumpToSource
                  ? <button onClick={() => onJumpToSource(id)} className="text-nhs-blue dark:text-accent hover:underline font-mono">{i.resource}</button>
                  : <span className="font-mono">{i.resource}</span>)}
                <span className="font-mono text-nhs-grey-3 dark:text-muted break-all">{i.expression?.replace(/\/\*.*?\*\//g, '') ?? 'No location'}</span>
                {list.length > 1 && i.text !== sample.text && <span className="text-nhs-grey-2 dark:text-ink-2 break-words">{i.text}</span>}
              </div>
            )
          })}
          {list.length > MAX_LOCATIONS && (
            <div className="pl-2 text-xs italic text-nhs-grey-3 dark:text-muted">…and {list.length - MAX_LOCATIONS} more</div>
          )}
        </div>
      )}
    </div>
  )
}

export function ProfileValidationSection({ source, format, onJumpToSource }: Props) {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ProfileResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openSeverity, setOpenSeverity] = useState<Severity | 'unchecked' | null>('error')

  const signedIn = isAuthEnabled && !!user

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    api.get<Status>('/profile-validation')
      .then(s => { if (!cancelled) setStatus(s) })
      .catch(() => { if (!cancelled) setStatus({ enabled: false, packages: [] }) })
    return () => { cancelled = true }
  }, [signedIn])

  // A different record invalidates the last result.
  const [resultFor, setResultFor] = useState<string | null>(null)
  const current = resultFor === source ? result : null

  // Coming back to this tab (or reloading the same record) shows this user's
  // result from the last hour, if the server still has it.
  const enabled = signedIn && !!status?.enabled
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    sha256Hex(source)
      .then(hash => hash ? api.get<ProfileResult>(`/profile-validation/result/${hash}`) : null)
      .then(r => {
        if (cancelled || !r) return
        setResult(r)
        setResultFor(source)
        setOpenSeverity(r.counts.error ? 'error' : r.counts.warning ? 'warning' : null)
      })
      .catch(() => { /* 404: nothing cached */ })
    return () => { cancelled = true }
  }, [enabled, source])

  const grouped = useMemo(() => {
    const out: Partial<Record<Severity, ReturnType<typeof group>>> = {}
    const findings = (current?.issues ?? []).filter(i => !i.unchecked)
    for (const s of SEVERITIES) out[s.key] = group(findings.filter(i => i.severity === s.key))
    return out
  }, [current])
  const uncheckedGroups = useMemo(() => group((current?.issues ?? []).filter(i => i.unchecked)), [current])
  const uncheckedCount = current?.unchecked ?? 0

  if (!signedIn || !status?.enabled) return null

  // With a result on screen the button re-validates; otherwise the server may
  // still answer from its cache.
  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const r = await api.postRaw<ProfileResult>(`/profile-validation${current ? '?refresh=1' : ''}`, source, format === 'xml' ? 'application/fhir+xml' : 'application/fhir+json')
      setResult(r)
      setResultFor(source)
      setOpenSeverity(r.counts.error ? 'error' : r.counts.warning ? 'warning' : null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-lg border border-nhs-grey-4 dark:border-line overflow-hidden shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-nhs-grey-5 dark:bg-raised">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-nhs-grey-1 dark:text-ink">GP Connect profile validation</div>
          <div className="text-[11px] text-nhs-grey-3 dark:text-muted">
            HL7 FHIR validator · {status.packages.join(', ')} · {(current?.terminology ?? status.terminology) === 'nhs' ? 'codes checked with the NHS England Terminology Server' : 'terminology not checked'}
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="px-3 py-1 rounded text-xs font-semibold bg-nhs-blue text-white hover:bg-nhs-blue/80 disabled:opacity-60 transition-colors"
        >
          {running ? 'Validating…' : current ? 'Validate again' : 'Validate against profiles'}
        </button>
      </div>

      {running && (
        <p className="px-3 py-2 text-xs text-nhs-grey-2 dark:text-ink-2">A full record usually takes 30–60 seconds.</p>
      )}
      {error && (
        <p className="px-3 py-2 text-xs text-nhs-red dark:text-bad">{error}</p>
      )}

      {current && !running && (
        <div className="p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs px-1">
            {SEVERITIES.map(s => (
              <span key={s.key} className={`px-2 py-0.5 rounded-full font-semibold ${s.dot}`}>
                {current.counts[s.key]} {s.label.toLowerCase()}
              </span>
            ))}
            <span className="text-nhs-grey-3 dark:text-muted">
              {current.cached
                ? `validated at ${timeOf(current.validatedAt)} · saved result, kept for an hour`
                : `validated at ${timeOf(current.validatedAt)} in ${(current.durationMs / 1000).toFixed(0)}s`}
            </span>
            {current.truncated && (
              <span className="text-nhs-grey-3 dark:text-muted">· showing the first {current.issues.length.toLocaleString()} issues</span>
            )}
          </div>
          {SEVERITIES.filter(s => (grouped[s.key]?.length ?? 0) > 0).map(s => (
            <div key={s.key} className="rounded border border-nhs-grey-4 dark:border-line overflow-hidden">
              <button
                onClick={() => setOpenSeverity(o => o === s.key ? null : s.key)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-nhs-grey-5 dark:bg-raised text-xs font-semibold text-nhs-grey-1 dark:text-ink"
              >
                <span>{s.label} · {grouped[s.key]!.length} kind{grouped[s.key]!.length !== 1 ? 's' : ''}</span>
                <span className="text-[10px]">{openSeverity === s.key ? '▲' : '▼'}</span>
              </button>
              {openSeverity === s.key && (
                <div className="p-1.5 space-y-1">
                  {grouped[s.key]!.map(g => <IssueGroup key={g.key} list={g.list} row={s.row} onJumpToSource={onJumpToSource} />)}
                </div>
              )}
            </div>
          ))}
          {current.counts.error === 0 && current.counts.warning === 0 && (
            <p className="px-1 text-xs text-nhs-green dark:text-ok font-semibold">✓ No profile errors or warnings</p>
          )}
          {uncheckedCount > 0 && (
            <div className="rounded border border-nhs-grey-4 dark:border-line overflow-hidden">
              <button
                onClick={() => setOpenSeverity(o => o === 'unchecked' ? null : 'unchecked')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-nhs-grey-5 dark:bg-raised text-xs font-semibold text-nhs-grey-2 dark:text-ink-2"
              >
                <span>Codes not checked · {uncheckedCount.toLocaleString()}</span>
                <span className="text-[10px]">{openSeverity === 'unchecked' ? '▲' : '▼'}</span>
              </button>
              {openSeverity === 'unchecked' && (
                <div className="p-1.5 space-y-1">
                  <p className="px-1 pb-1 text-[11px] text-nhs-grey-3 dark:text-muted">
                    The validator could not check these codes against their value sets or code systems, so they are not counted above. They are not problems found in the record.
                  </p>
                  {uncheckedGroups.map(g => (
                    <IssueGroup key={g.key} list={g.list} row="border-nhs-grey-4 bg-nhs-grey-5 text-nhs-grey-2 dark:border-line dark:bg-raised dark:text-ink-2" onJumpToSource={onJumpToSource} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
