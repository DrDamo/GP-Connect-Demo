import { useMemo } from 'react'
import type { GpConnectBundle, GpConnectOperationIssue } from '../../fhir/types'
import type { DomainId } from './domains'

const LIST_CODE_TO_DOMAIN: Record<string, DomainId> = {
  '886921000000105':  'allergies',
  '1103671000000101': 'allergies',
  '933361000000108':  'medications',
  '1102181000000102': 'immunisations',
  '887191000000108':  'investigations',
  '1149501000000101': 'consultations',
  '826501000000100':  'coded-data',
  '792931000000107':  'referrals',
  '714311000000108':  'diary-entries',
  '717711000000103':  'problems',
}

const WARNING_CODE_LABEL: Record<string, string> = {
  'data-in-transit':      'Data in transit',
  'data-awaiting-filing': 'Data awaiting filing',
  'confidential-items':   'Confidential items withheld',
}

export interface DomainWarning {
  code: string
  note?: string
}

export function useDomainWarnings(record: GpConnectBundle): Partial<Record<DomainId, DomainWarning>> {
  return useMemo(() => {
    const result: Partial<Record<DomainId, DomainWarning>> = {}
    for (const list of record.lists) {
      if (list.category !== 'primary' || !list.warningCode || !list.listCode) continue
      const domain = LIST_CODE_TO_DOMAIN[list.listCode]
      if (!domain || result[domain]) continue
      result[domain] = { code: list.warningCode, note: list.note }
    }
    return result
  }, [record.lists])
}

export function DomainWarningBanner({ warning }: { warning: DomainWarning }) {
  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-warn-line dark:bg-warn-bg">
      <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-warn" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-warn">
          {WARNING_CODE_LABEL[warning.code] ?? warning.code}
        </p>
        {warning.note && (
          <p className="mt-0.5 text-xs text-amber-700 dark:text-warn">{warning.note}</p>
        )}
      </div>
    </div>
  )
}

/** Record-wide banner for OperationOutcome issues returned in the response.
 * Errors render red; warnings/information amber. */
export function OperationOutcomeBanner({ issues }: { issues: GpConnectOperationIssue[] | undefined }) {
  if (!issues?.length) return null
  const hasError = issues.some(i => i.severity === 'error' || i.severity === 'fatal')
  const tone = hasError
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-bad-line dark:bg-bad-bg dark:text-bad'
    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-warn-line dark:bg-warn-bg dark:text-warn'
  return (
    <div className={`mb-4 rounded-lg border p-3 ${tone}`} role="status">
      <p className="text-sm font-semibold">
        The response includes {issues.length === 1 ? 'an OperationOutcome issue' : `${issues.length} OperationOutcome issues`}
      </p>
      <ul className="mt-1 space-y-1">
        {issues.map((issue, i) => (
          <li key={i} className="text-xs">
            <span className="font-semibold uppercase tracking-wide">{issue.severity}</span>
            {issue.detailCode && <span className="ml-1 font-mono">{issue.detailCode}</span>}
            {issue.detailText && <span> — {issue.detailText}</span>}
            {issue.diagnostics && <span className="block opacity-80">{issue.diagnostics}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
