import { useState } from 'react'
import type { ValidationIssue, ValidationResult, ValidationSeverity } from '../fhir/types'
import { InfoHint } from '../onboarding/InfoHint'

interface Props {
  result: ValidationResult
  onCleanRefs?: () => void
}

const severityConfig: Record<ValidationSeverity, { bg: string; border: string; text: string; icon: string; badge: string; label: string }> = {
  error:   { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-800',    icon: '✕', badge: 'bg-nhs-red text-white',          label: 'Errors' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', icon: '⚠', badge: 'bg-nhs-yellow text-nhs-grey-1',   label: 'Warnings' },
  info:    { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-800',   icon: 'ℹ', badge: 'bg-nhs-blue-light text-white',    label: 'Info' },
}

const SEVERITY_ORDER: ValidationSeverity[] = ['error', 'warning', 'info']

// Collapses dynamic details (quoted values, bracketed lists, numbers) so that
// issues which are really "the same kind of problem" on different resources
// (e.g. 30 different dangling references) group together under one heading,
// instead of each being its own line in one long flat list.
function issueTypeKey(message: string): string {
  return message
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\[[^\]]*\]/g, '[…]')
    .replace(/\b\d+\b/g, '#')
}

interface IssueGroup {
  key: string
  sample: string
  issues: ValidationIssue[]
}

function groupBySeverity(issues: ValidationIssue[]): Partial<Record<ValidationSeverity, ValidationIssue[]>> {
  const out: Partial<Record<ValidationSeverity, ValidationIssue[]>> = {}
  for (const issue of issues) {
    ;(out[issue.severity] ??= []).push(issue)
  }
  return out
}

function groupByType(issues: ValidationIssue[]): IssueGroup[] {
  const map = new Map<string, ValidationIssue[]>()
  for (const issue of issues) {
    const key = issueTypeKey(issue.message)
    ;(map.get(key) ?? map.set(key, []).get(key)!).push(issue)
  }
  return [...map.entries()]
    .map(([key, groupIssues]) => ({ key, sample: groupIssues[0].message, issues: groupIssues }))
    .sort((a, b) => b.issues.length - a.issues.length)
}

function IssueRow({ issue, cfg }: { issue: ValidationIssue; cfg: typeof severityConfig[ValidationSeverity] }) {
  return (
    <div className={`flex gap-2 p-2 rounded border text-xs ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className="font-bold shrink-0">{cfg.icon}</span>
      <div className="min-w-0">
        <span className="font-medium break-words">{issue.message}</span>
        {issue.path && <span className="ml-2 font-mono opacity-70 break-all">{issue.path}</span>}
      </div>
    </div>
  )
}

function TypeGroup({ group, cfg, open, onToggle }: {
  group: IssueGroup
  cfg: typeof severityConfig[ValidationSeverity]
  open: boolean
  onToggle: () => void
}) {
  // A group with just one issue doesn't need its own collapse toggle — show it directly.
  if (group.issues.length === 1) {
    return <IssueRow issue={group.issues[0]} cfg={cfg} />
  }
  return (
    <div className={`rounded border ${cfg.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left ${cfg.bg} ${cfg.text} hover:opacity-80 transition-opacity`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-bold shrink-0">{cfg.icon}</span>
          <span className="font-medium truncate">{group.sample}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="px-1.5 py-0.5 rounded-full bg-white/70 text-[11px] font-semibold">{group.issues.length}</span>
          <span className="text-[10px]">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="p-1.5 space-y-1 bg-white">
          {group.issues.map((issue, i) => (
            <div key={i} className="pl-2 text-xs text-nhs-grey-1">
              {issue.path && <span className="font-mono text-nhs-grey-3 break-all">{issue.path}</span>}
              {!issue.path && <span className="text-nhs-grey-3 italic">No path</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DegradeRow({ issue }: { issue: ValidationIssue }) {
  const d = issue.snomedDegrade
  if (!d) return null
  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-950/30">
      {issue.path && (
        <div className="mb-1 break-all font-mono text-nhs-grey-3 dark:text-gray-400">{issue.path}</div>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="font-semibold text-nhs-grey-2 dark:text-gray-300">Original:</span>
        <span className="break-all">
          <span className="font-mono">{d.originalCode}</span>
          {d.originalDisplay && <span className="text-nhs-grey-2 dark:text-gray-300"> — {d.originalDisplay}</span>}
        </span>
        <span className="font-semibold text-nhs-grey-2 dark:text-gray-300">Degraded to:</span>
        <span className="break-all">
          <span className="font-mono">{d.degradedCode}</span>
          <span className="text-nhs-grey-2 dark:text-gray-300"> — {d.degradedDisplay}</span>
        </span>
      </div>
    </div>
  )
}

function DegradeSection({ issues, open, onToggle }: {
  issues: ValidationIssue[]
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 overflow-hidden shrink-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold bg-nhs-yellow text-nhs-grey-1">⇄</span>
          <span className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100">SNOMED CT code degrades</span>
          <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100 text-[11px] font-semibold">{issues.length}</span>
        </span>
        <span className="text-xs text-nhs-grey-3">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
        <div className="p-2 space-y-1.5">
          {issues.map((issue, i) => <DegradeRow key={i} issue={issue} />)}
        </div>
      )}
    </div>
  )
}

function PassedSection({ titles, open, onToggle }: {
  titles: string[]
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-nhs-grey-4 overflow-hidden shrink-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-nhs-grey-5 hover:bg-nhs-grey-4/40 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold bg-nhs-green text-white">✓</span>
          <span className="text-sm font-semibold text-nhs-grey-1">Passed</span>
          <span className="px-1.5 py-0.5 rounded-full bg-nhs-grey-4 text-nhs-grey-2 text-[11px] font-semibold">{titles.length}</span>
        </span>
        <span className="text-xs text-nhs-grey-3">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
        <div className="p-2 space-y-1">
          {titles.map(title => (
            <div key={title} className="flex gap-2 p-1.5 text-xs text-nhs-grey-1">
              <span className="font-bold shrink-0 text-nhs-green">✓</span>
              <span>{title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SeveritySection({ severity, issues, open, onToggle, openGroups, onToggleGroup }: {
  severity: ValidationSeverity
  issues: ValidationIssue[]
  open: boolean
  onToggle: () => void
  openGroups: Set<string>
  onToggleGroup: (key: string) => void
}) {
  const cfg = severityConfig[severity]
  const groups = groupByType(issues)
  return (
    <div className="rounded-lg border border-nhs-grey-4 overflow-hidden shrink-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-nhs-grey-5 hover:bg-nhs-grey-4/40 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${cfg.badge}`}>{cfg.icon}</span>
          <span className="text-sm font-semibold text-nhs-grey-1">{cfg.label}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-nhs-grey-4 text-nhs-grey-2 text-[11px] font-semibold">{issues.length}</span>
        </span>
        <span className="text-xs text-nhs-grey-3">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
        <div className="p-2 space-y-1.5">
          {groups.map(group => (
            <TypeGroup
              key={group.key}
              group={group}
              cfg={cfg}
              open={openGroups.has(`${severity}:${group.key}`)}
              onToggle={() => onToggleGroup(`${severity}:${group.key}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ValidationPanel({ result, onCleanRefs }: Props) {
  const errors = result.issues.filter(i => i.severity === 'error')
  const warnings = result.issues.filter(i => i.severity === 'warning')
  const danglingCount = warnings.filter(i => i.message.includes('does not resolve')).length

  // SNOMED code degrades get their own section (each shown individually,
  // never grouped) rather than being folded into the generic Warnings list.
  const degradeIssues = result.issues.filter(i => i.snomedDegrade)
  const otherIssues = result.issues.filter(i => !i.snomedDegrade)

  const bySeverity = groupBySeverity(otherIssues)
  // Default: open whichever is the most severe non-empty section, collapse the rest.
  const defaultOpenSeverity = SEVERITY_ORDER.find(s => (bySeverity[s]?.length ?? 0) > 0)
  const [openSeverities, setOpenSeverities] = useState<Set<ValidationSeverity>>(
    () => new Set(defaultOpenSeverity ? [defaultOpenSeverity] : [])
  )
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [degradeOpen, setDegradeOpen] = useState(true)
  const [passedOpen, setPassedOpen] = useState(false)

  const toggleSeverity = (s: ValidationSeverity) =>
    setOpenSeverities(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Summary bar */}
      <div className={`shrink-0 flex items-center gap-3 p-3 rounded-lg border ${result.valid ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
        <span className={`text-lg font-bold ${result.valid ? 'text-nhs-green' : 'text-nhs-red'}`}>
          {result.valid ? '✓' : '✕'}
        </span>
        <div className="flex-1">
          <span className={`font-semibold text-sm ${result.valid ? 'text-nhs-green' : 'text-nhs-red'}`}>
            {result.valid ? 'Bundle is structurally valid' : 'Validation errors found'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {errors.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-nhs-red text-white">
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-nhs-yellow text-nhs-grey-1">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
          {result.passed.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-nhs-green text-white">
              {result.passed.length} passed
            </span>
          )}
          {result.issues.length === 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-nhs-green text-white">No issues</span>
          )}
          {danglingCount > 0 && onCleanRefs && (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={onCleanRefs}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-nhs-blue text-white hover:bg-nhs-blue/80 transition-colors"
              >
                Remove {danglingCount} dangling ref{danglingCount !== 1 ? 's' : ''} →
              </button>
              <InfoHint topic="validation.clean-refs" />
            </span>
          )}
        </div>
      </div>

      {/* Resource counts */}
      {Object.keys(result.resourceCounts).length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-2">
          {Object.entries(result.resourceCounts).map(([rt, count]) => (
            <span key={rt} className="px-2 py-1 rounded text-xs bg-nhs-grey-5 text-nhs-grey-2 font-mono">
              {rt}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Issues — accordion by severity, then by issue type. SNOMED code
          degrades get their own section, right after Errors, with each
          instance listed individually rather than grouped. Checks that
          passed get their own section too, last, since they're the least
          urgent. */}
      {(result.issues.length > 0 || result.passed.length > 0) && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {(bySeverity.error?.length ?? 0) > 0 && (
            <SeveritySection
              severity="error"
              issues={bySeverity.error!}
              open={openSeverities.has('error')}
              onToggle={() => toggleSeverity('error')}
              openGroups={openGroups}
              onToggleGroup={toggleGroup}
            />
          )}
          {degradeIssues.length > 0 && (
            <DegradeSection
              issues={degradeIssues}
              open={degradeOpen}
              onToggle={() => setDegradeOpen(v => !v)}
            />
          )}
          {SEVERITY_ORDER.filter(s => s !== 'error' && (bySeverity[s]?.length ?? 0) > 0).map(severity => (
            <SeveritySection
              key={severity}
              severity={severity}
              issues={bySeverity[severity]!}
              open={openSeverities.has(severity)}
              onToggle={() => toggleSeverity(severity)}
              openGroups={openGroups}
              onToggleGroup={toggleGroup}
            />
          ))}
          {result.passed.length > 0 && (
            <PassedSection
              titles={result.passed}
              open={passedOpen}
              onToggle={() => setPassedOpen(v => !v)}
            />
          )}
        </div>
      )}
    </div>
  )
}
