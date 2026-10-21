import type * as fhir3 from 'fhir/r3'
import type { GpConnectOperationIssue } from './types'
import { getEntries } from './utils'

const SEVERITY_ORDER: Record<string, number> = { fatal: 0, error: 1, warning: 2, information: 3 }

export function extractOperationIssues(bundle: fhir3.Bundle): GpConnectOperationIssue[] {
  const issues: GpConnectOperationIssue[] = []
  for (const oo of getEntries<fhir3.OperationOutcome>(bundle, 'OperationOutcome')) {
    for (const issue of oo.issue ?? []) {
      const coding = issue.details?.coding?.[0]
      issues.push({
        outcomeId: oo.id,
        severity: issue.severity ?? 'information',
        code: issue.code,
        detailCode: coding?.code,
        detailText: issue.details?.text ?? coding?.display,
        diagnostics: issue.diagnostics,
      })
    }
  }
  return issues.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
}
