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
  /** The validator says it could not check this code (no terminology server,
   *  or a code system it doesn't have). Not a finding about the record. */
  unchecked?: true
}

export interface ProfileSummary {
  /** Findings by severity, not counting `unchecked` issues. */
  counts: Record<ProfileSeverity, number>
  /** Issues where a code could not be checked (see ProfileIssue.unchecked). */
  unchecked: number
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

// The HL7 validator's wording when it skips a terminology check (validator
// 7.0.x messages; see ../../test/profileOutcome.test.ts for examples).
const UNCHECKED_PATTERNS = [
  /because there is no terminology service/,
  /in the absence of a terminology server/,
  /running without terminology services/,
  /^Unable to validate code without using server/,
  /^A definition for CodeSystem .* could not be found, so the code cannot be validated/,
  // The terminology server rejected the value set itself (e.g. its ECL), or
  // failed: neither says anything about the record.
  /^Could not confirm that the codings provided are in the value set/,
  /^Error from server: /,
]

export function isUnchecked(text: string): boolean {
  return UNCHECKED_PATTERNS.some(p => p.test(text))
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
  let unchecked = 0
  const issues: ProfileIssue[] = raw.map(i => {
    const severity = toSeverity(i.severity)
    const text = i.details?.text ?? i.diagnostics ?? 'No description'
    const isSkip = isUnchecked(text)
    if (isSkip) unchecked++
    else counts[severity]++
    const expression = i.expression?.[0] ?? i.location?.[0]
    return {
      severity,
      code: i.code,
      text,
      expression,
      line: i.extension?.find(e => e.url === LINE_EXT)?.valueInteger,
      resource: entryResource(expression, bundle),
      ...(isSkip ? { unchecked: true as const } : {}),
    }
  })
  // Real findings first (by severity), skipped checks last, so the cap never
  // drops a finding in favour of a skipped check. The validator reports in
  // document order; sort is stable, so that order holds within each group.
  const rank = (i: ProfileIssue) => (i.unchecked ? 3 : SEVERITY_RANK[i.severity])
  issues.sort((a, b) => rank(a) - rank(b))
  return { counts, unchecked, issues: issues.slice(0, maxIssues), truncated: issues.length > maxIssues }
}
