// Turns the HL7 validator's OperationOutcome (often 10k+ issues and >10 MB for
// a whole GP Connect record) into the compact shape the browser needs.

export type ProfileSeverity = 'error' | 'warning' | 'information'

export interface ProfileIssue {
  severity: ProfileSeverity
  code?: string
  text: string
  /** FHIRPath location, e.g. Bundle.entry[12].resource.code */
  expression?: string
  line?: number
  /** `Type/id` of the bundle entry the issue sits in, when it can be resolved. */
  resource?: string
}

export interface ProfileSummary {
  counts: Record<ProfileSeverity, number>
  issues: ProfileIssue[]
  /** True when more issues were found than are returned. */
  truncated: boolean
}

interface OOIssue {
  severity?: string
  code?: string
  details?: { text?: string }
  diagnostics?: string
  expression?: string[]
  location?: string[]
  extension?: { url?: string; valueInteger?: number }[]
}

const SEVERITY_RANK: Record<ProfileSeverity, number> = { error: 0, warning: 1, information: 2 }
const LINE_EXT = 'http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-line'

function toSeverity(s: string | undefined): ProfileSeverity {
  // `fatal` is reported as an error; anything unknown as information.
  if (s === 'fatal' || s === 'error') return 'error'
  if (s === 'warning') return 'warning'
  return 'information'
}

/** Resource reference for `Bundle.entry[n]…`, from the submitted bundle. */
function entryResource(expression: string | undefined, bundle: unknown): string | undefined {
  const m = expression?.match(/^Bundle\.entry\[(\d+)\]/)
  if (!m) return undefined
  const entries = (bundle as { entry?: { resource?: { resourceType?: string; id?: string } }[] } | undefined)?.entry
  const r = entries?.[Number(m[1])]?.resource
  return r?.resourceType ? (r.id ? `${r.resourceType}/${r.id}` : r.resourceType) : undefined
}

export function summariseOutcome(outcome: unknown, bundle: unknown, maxIssues: number): ProfileSummary {
  const raw = ((outcome as { issue?: OOIssue[] } | undefined)?.issue ?? [])
  const counts: Record<ProfileSeverity, number> = { error: 0, warning: 0, information: 0 }
  const issues: ProfileIssue[] = raw.map(i => {
    const severity = toSeverity(i.severity)
    counts[severity]++
    const expression = i.expression?.[0] ?? i.location?.[0]
    return {
      severity,
      code: i.code,
      text: i.details?.text ?? i.diagnostics ?? 'No description',
      expression,
      line: i.extension?.find(e => e.url === LINE_EXT)?.valueInteger,
      resource: entryResource(expression, bundle),
    }
  })
  // The validator reports in document order; keep that within each severity.
  issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  return { counts, issues: issues.slice(0, maxIssues), truncated: issues.length > maxIssues }
}
