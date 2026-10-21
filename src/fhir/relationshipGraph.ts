import type * as fhir3 from 'fhir/r3'
import { getBundleIndex, lookupReference, type AnyResource, type BundleIndex } from './bundleIndex'
import { walkReferences } from './incomingRefs'
import { titleIndexKey } from './lineIndex'
import { formatDate, resolveItemDisplay, extractOriginalTermText } from './utils'
import type { GpConnectInvestigation, GpConnectMedication } from './types'

/** How a reference reads to a person, which drives line style. */
export type EdgeKind = 'contains' | 'chain' | 'link' | 'context' | 'actor' | 'patient'
/** Colour family for a node. */
export type NodeKind = 'enc' | 'list' | 'cond' | 'obs' | 'mr' | 'ms' | 'med' | 'who' | 'dr' | 'pat'
/** core = part of the consultation/medication/report itself; in = points at
 * it; out = it points there; context = who/where/what product; far = reached
 * through a resource that points in (e.g. a problem's other links);
 * patient = the record's subject, shown only through these resources' own
 * subject/patient references. */
export type NodeRole = 'core' | 'in' | 'out' | 'context' | 'far' | 'patient'

export interface GraphNode {
  key: string
  type: string
  /** Resource id, or the title-based key for id-less Lists — what the
   * Inspector's line index and "View in record" navigation use. */
  id?: string
  label: string
  sub?: string
  kind: NodeKind
  role: NodeRole
  lane: number
}

export interface GraphEdge {
  from: string
  to: string
  /** FHIRPath-like element the reference sits in, e.g. `MedicationRequest.basedOn` */
  path: string
  kind: EdgeKind
}

/** Containment tree for the Nested view. `group` boxes are not FHIR
 * resources (e.g. a medication's authorisation history). */
export interface TreeNode {
  key: string
  group?: { label: string; sub?: string }
  /** Its children are grouped by their order in the parent, not by a FHIR
   * reference (e.g. TPP/EMIS test groups sent as a flat result list). */
  inferred?: boolean
  children: TreeNode[]
}

export type StorySegment = string | { node: string } | { path: string }

export interface RelationshipGraph {
  domain: 'consultation' | 'medication' | 'investigation'
  title: string
  subtitle?: string
  /** Node the view was opened from */
  focus: string
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  tree: TreeNode
  treeNote: string
  lanes: string[]
  rail: { title: string; keys: string[] }[]
  story: StorySegment[][]
  /** The FHIR resource behind each node, for the source preview */
  resources: Map<string, AnyResource>
}

// Who, where and what: the people, places, product and sample around the clinical content.
const SUPPORTING = new Set(['Practitioner', 'PractitionerRole', 'Organization', 'Location', 'HealthcareService', 'Medication', 'Device', 'Specimen'])
const CONSULTATION_WRAPPER = '325851000000107'
/** A problem can link to hundreds of resources; past this many, its
 * onward links are summarised rather than drawn. */
const FAR_PER_SOURCE = 8
/** Bound on how far an authorisation chain is followed. */
const MAX_CHAIN = 15

// ── Reference adjacency (cached per bundle) ──────────────────────────────

interface Hop { other: AnyResource; path: string }
interface Adjacency {
  out: Map<AnyResource, Hop[]>
  in: Map<AnyResource, Hop[]>
  keys: Map<AnyResource, string>
  /** References to the Patient, kept apart: nearly everything has one, so
   * they'd swamp the graph if treated like other links. */
  patient: Map<AnyResource, Hop[]>
}

const adjacencyCache = new WeakMap<fhir3.Bundle, Adjacency>()

function getAdjacency(bundle: fhir3.Bundle): Adjacency {
  const hit = adjacencyCache.get(bundle)
  if (hit) return hit
  const index = getBundleIndex(bundle)
  const adj: Adjacency = { out: new Map(), in: new Map(), keys: new Map(), patient: new Map() }
  let anon = 0
  const sources: AnyResource[] = []
  for (const r of index.all) {
    sources.push(r)
    for (const c of (r as { contained?: AnyResource[] }).contained ?? []) sources.push(c)
  }
  for (const r of sources) {
    const title = (r as { title?: string }).title
    adj.keys.set(r, r.id ? `${r.resourceType}/${r.id}` : `${r.resourceType}#${title ?? ++anon}`)
  }
  for (const source of sources) {
    const seen = new Set<string>()
    walkReferences(source, source.resourceType, (ref, path) => {
      const target = lookupReference(index, ref)
      if (!target || target === source) return
      const dedupe = `${adj.keys.get(target) ?? target.resourceType}|${path}`
      if (seen.has(dedupe)) return
      seen.add(dedupe)
      if (target.resourceType === 'Patient') {
        push(adj.patient, source, { other: target, path })
        return
      }
      push(adj.out, source, { other: target, path })
      push(adj.in, target, { other: source, path })
    })
  }
  adjacencyCache.set(bundle, adj)
  return adj
}

function push<K, V>(map: Map<K, V[]>, k: K, v: V) {
  const list = map.get(k)
  if (list) list.push(v)
  else map.set(k, [v])
}

// ── Classification and labels ────────────────────────────────────────────

function edgeKind(path: string, target: AnyResource, source: AnyResource, index: BundleIndex): EdgeKind {
  if (target.resourceType === 'Patient') return 'patient'
  if (SUPPORTING.has(target.resourceType)) return 'actor'
  if (/\.entry\.item$/.test(path) || path === 'DiagnosticReport.result') return 'contains'
  if (path === 'Observation.related.target') return isMemberLink(source, target, index) ? 'contains' : 'link'
  if (/\.(basedOn|priorPrescription|replaces|partOf)$/.test(path)) return 'chain'
  if (/\.(context|encounter)$/.test(path)) return 'context'
  return 'link'
}

function nodeKind(type: string): NodeKind {
  switch (type) {
    case 'Patient': return 'pat'
    case 'DiagnosticReport': return 'dr'
    case 'Encounter': return 'enc'
    case 'List': return 'list'
    case 'Condition': return 'cond'
    case 'MedicationRequest': return 'mr'
    case 'MedicationStatement': return 'ms'
    case 'Medication': return 'med'
  }
  return SUPPORTING.has(type) ? 'who' : 'obs'
}

/** "23 Mar 2010 15:36" when a time is present, otherwise just the date. */
function when(dt: string | undefined): string | undefined {
  if (!dt) return undefined
  const date = formatDate(dt)
  if (!dt.includes('T')) return date
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return date
  // Systems often send midnight to mean "no time recorded".
  if (d.getHours() === 0 && d.getMinutes() === 0) return date
  return `${date} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(' · ') || undefined

function describe(bundle: fhir3.Bundle, r: AnyResource, key: string, medicationCore: boolean): { label: string; sub?: string } {
  // Reads optional fields across many resource types; typing each one adds nothing here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = r as AnyResource & Record<string, any>
  const display = r.id ? resolveItemDisplay(bundle, key) : undefined
  switch (r.resourceType) {
    case 'Encounter':
      return { label: display ? `Consultation: ${display}` : 'Consultation', sub: join(when(any.period?.start), any.status) }
    case 'List': {
      const n = (any.entry as unknown[] | undefined)?.length ?? 0
      // Consultation Lists are coded "Consultation", "Topic (EHR)" or
      // "Category (EHR)" — lead with that so a topic titled "Gout" isn't
      // mistaken for the Gout observation inside it.
      const codeText = extractOriginalTermText(any.code)?.replace(/\s*\(EHR\)$/, '')
      const title = any.title as string | undefined
      return {
        label: codeText && title && codeText.toLowerCase() !== title.toLowerCase() && n < 50 && /^(Consultation|Topic|Category)/.test(codeText)
          ? `${codeText}: ${title}`
          : title ?? codeText ?? 'List',
        sub: `${n} ${n === 1 ? 'entry' : 'entries'}`,
      }
    }
    case 'Condition':
      return { label: `Problem: ${display ?? 'unnamed'}`, sub: join(any.clinicalStatus, when(any.onsetDateTime)) }
    case 'MedicationRequest': {
      const plan = any.intent === 'plan'
      const date = when(any.authoredOn)
      if (medicationCore) return { label: `${plan ? 'Authorisation' : 'Issue'}${date ? ` · ${date}` : ''}`, sub: join(any.intent, any.status, quantity(any)) }
      return { label: display ?? 'Medication request', sub: join(plan ? 'authorisation' : 'issue', any.status, date) }
    }
    case 'MedicationStatement': {
      const p = any.effectivePeriod
      const range = p ? [when(p.start)?.split(' ').slice(0, 3).join(' '), p.end ? formatDate(p.end) : 'ongoing'].filter(Boolean).join(' – ') : undefined
      if (medicationCore) return { label: `Statement · ${any.status ?? 'unknown'}`, sub: range }
      return { label: display ?? 'Medication statement', sub: join('statement', any.status, range) }
    }
    case 'Observation':
      return { label: display ?? 'Observation', sub: when(any.effectiveDateTime ?? any.effectivePeriod?.start ?? any.issued) }
    case 'DiagnosticReport':
      return { label: display ? `Report: ${display}` : 'Diagnostic report', sub: join(when(any.effectiveDateTime ?? any.issued), any.status) }
    case 'Specimen':
      return { label: `Specimen: ${extractOriginalTermText(any.type) ?? 'unspecified'}`, sub: when(any.collection?.collectedDateTime ?? any.receivedTime) }
    case 'Patient': {
      const name = (any.name as fhir3.HumanName[] | undefined)?.find(n => n.use === 'official') ?? any.name?.[0]
      const text = name?.text ?? [name?.prefix?.join(' '), name?.given?.join(' '), name?.family].filter(Boolean).join(' ')
      const nhs = (any.identifier as fhir3.Identifier[] | undefined)?.find(i => i.system?.includes('nhs-number'))?.value
      return { label: text ? `Patient: ${text}` : 'Patient', sub: join(nhs && `NHS ${nhs}`, any.birthDate && `born ${formatDate(any.birthDate)}`) }
    }
    case 'Location':
    case 'HealthcareService':
      return { label: any.name ?? r.resourceType }
    case 'PractitionerRole':
      return { label: extractOriginalTermText(any.code?.[0]) ?? 'Practitioner role' }
  }
  return { label: display ?? r.resourceType, sub: when(any.recordedDate ?? any.assertedDate ?? any.authoredOn ?? any.created ?? any.date) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function quantity(r: Record<string, any>): string | undefined {
  const q = r.dispenseRequest?.quantity
  return q?.value !== undefined ? `${q.value} ${q.unit ?? ''}`.trim() : undefined
}

function listEncounter(l: AnyResource): string | undefined {
  return (l as { encounter?: { reference?: string } }).encounter?.reference
}

/** Observation.related entries that make the target a member of the source
 * (has-member, or untyped as some suppliers send) rather than a derivation. */
function isMemberLink(source: AnyResource, target: AnyResource, index: BundleIndex): boolean {
  const related = (source as { related?: { type?: string; target?: { reference?: string } }[] }).related ?? []
  return related.some(r => (r.type === 'has-member' || r.type === undefined) && lookupReference(index, r.target?.reference) === target)
}

function hasCode(r: AnyResource, code: string): boolean {
  return !!(r as { code?: fhir3.CodeableConcept }).code?.coding?.some(c => c.code === code)
}

// ── Builder ──────────────────────────────────────────────────────────────

class GraphBuilder {
  readonly index: BundleIndex
  readonly adj: Adjacency
  readonly nodes = new Map<string, GraphNode>()
  readonly byKey = new Map<string, AnyResource>()
  readonly core = new Set<AnyResource>()
  readonly bundle: fhir3.Bundle
  readonly medicationCore: boolean

  constructor(bundle: fhir3.Bundle, medicationCore: boolean) {
    this.bundle = bundle
    this.medicationCore = medicationCore
    this.index = getBundleIndex(bundle)
    this.adj = getAdjacency(bundle)
  }

  key(r: AnyResource): string {
    return this.adj.keys.get(r) ?? `${r.resourceType}/${r.id}`
  }

  add(r: AnyResource, role: NodeRole, lane: number): string {
    const key = this.key(r)
    const existing = this.nodes.get(key)
    if (existing) return key
    const described = describe(this.bundle, r, key, this.medicationCore && role === 'core')
    const label = described.label.replace(/\s+/g, ' ').trim()
    const sub = described.sub?.replace(/\s+/g, ' ').trim()
    const title = (r as { title?: string }).title
    this.nodes.set(key, {
      key, type: r.resourceType, label, sub, role, lane,
      id: r.id ?? (r.resourceType === 'List' && title ? titleIndexKey(title) : undefined),
      kind: nodeKind(r.resourceType),
    })
    this.byKey.set(key, r)
    if (role === 'core') this.core.add(r)
    return key
  }

  out(r: AnyResource): Hop[] { return this.adj.out.get(r) ?? [] }
  in(r: AnyResource): Hop[] { return this.adj.in.get(r) ?? [] }

  /** Adds everything one hop from the core, then the onward links of
   * resources that point in (a problem's other consultations and drugs). */
  addNeighbours(lastLane: number) {
    const roleOf = new Map<AnyResource, NodeRole>()
    const rank: Record<NodeRole, number> = { core: 0, in: 1, out: 2, context: 3, far: 4, patient: 5 }
    const offer = (r: AnyResource, role: NodeRole) => {
      if (this.core.has(r)) return
      const prev = roleOf.get(r)
      if (!prev || rank[role] < rank[prev]) roleOf.set(r, role)
    }
    for (const c of this.core) {
      for (const h of this.in(c)) offer(h.other, 'in')
      for (const h of this.out(c)) offer(h.other, SUPPORTING.has(h.other.resourceType) || h.other.resourceType === 'Encounter' ? 'context' : 'out')
    }
    for (const [r, role] of roleOf) this.add(r, role, role === 'in' ? 0 : lastLane)

    // Second hop, only from non-List resources that point in: Lists such
    // as "Medications and devices" hold the whole record.
    for (const [r, role] of roleOf) {
      if (role !== 'in' || r.resourceType === 'List') continue
      let added = 0
      for (const h of this.out(r)) {
        const t = h.other
        if (this.nodes.has(this.key(t)) || SUPPORTING.has(t.resourceType)) continue
        if (added++ >= FAR_PER_SOURCE) break
        this.add(t, 'far', -1)
      }
    }
  }

  edges(): GraphEdge[] {
    const edges: GraphEdge[] = []
    const seen = new Set<string>()
    for (const [key, r] of this.byKey) {
      for (const h of this.out(r)) {
        const to = this.key(h.other)
        if (!this.nodes.has(to)) continue
        const d = `${key}|${to}|${h.path}`
        if (seen.has(d)) continue
        seen.add(d)
        edges.push({ from: key, to, path: h.path, kind: edgeKind(h.path, h.other, r, this.index) })
      }
    }
    return edges
  }

  /** One Patient node, linked only from resources already in the graph. */
  addPatient(lane: number): GraphEdge[] {
    const edges: GraphEdge[] = []
    for (const [key, r] of [...this.byKey]) {
      for (const h of this.adj.patient.get(r) ?? []) {
        const to = this.add(h.other, 'patient', lane)
        edges.push({ from: key, to, path: h.path, kind: 'patient' })
      }
    }
    return edges
  }

  finish(domain: RelationshipGraph['domain'], focus: string, title: string, subtitle: string | undefined,
    tree: TreeNode, treeNote: string, coreLanes: string[], story: (g: RelationshipGraph) => StorySegment[][]): RelationshipGraph {
    const edges = this.edges()
    const lastLane = Math.max(0, ...[...this.nodes.values()].map(n => n.lane))
    edges.push(...this.addPatient(lastLane))
    const hasFar = [...this.nodes.values()].some(n => n.role === 'far')
    const lanes = [...(hasFar ? ['Further out'] : []), 'Points here', ...coreLanes, 'Points to']
    for (const n of this.nodes.values()) {
      n.lane = n.role === 'far' ? 0 : n.lane + (hasFar ? 1 : 0)
    }
    const keysBy = (role: NodeRole) => [...this.nodes.values()].filter(n => n.role === role).map(n => n.key)
    const rail = [
      { title: 'The patient', keys: keysBy('patient') },
      { title: 'Points here', keys: keysBy('in') },
      { title: 'Linked to', keys: keysBy('out') },
      { title: 'Who, where, what', keys: keysBy('context') },
      { title: 'Further out', keys: keysBy('far') },
    ].filter(g => g.keys.length)
    const graph: RelationshipGraph = { domain, title, subtitle, focus, nodes: this.nodes, edges, tree, treeNote, lanes, rail, story: [], resources: this.byKey }
    graph.story = [...story(graph), ...patientStory(graph)]
    return graph
  }
}

// ── Consultation ─────────────────────────────────────────────────────────

export function buildConsultationGraph(bundle: fhir3.Bundle, encounterId: string): RelationshipGraph | undefined {
  const b = new GraphBuilder(bundle, false)
  const enc = lookupReference(b.index, `Encounter/${encounterId}`)
  if (!enc) return undefined
  const focus = b.add(enc, 'core', 1)

  const visited = new Set<AnyResource>([enc])
  const listTree = (list: AnyResource): TreeNode => {
    visited.add(list)
    const node: TreeNode = { key: b.add(list, 'core', 2), children: [] }
    for (const e of (list as fhir3.List).entry ?? []) {
      const target = lookupReference(b.index, e.item?.reference)
      if (!target || visited.has(target)) continue
      if (target.resourceType === 'List') node.children.push(listTree(target))
      else {
        visited.add(target)
        node.children.push({ key: b.add(target, 'core', 3), children: [] })
      }
    }
    return node
  }
  const wrappers = (b.index.byType.get('List') ?? []).filter(l =>
    hasCode(l, CONSULTATION_WRAPPER) && lookupReference(b.index, listEncounter(l)) === enc)
  const tree: TreeNode = { key: focus, children: wrappers.map(listTree) }

  b.addNeighbours(4)
  const e = enc as fhir3.Encounter
  return b.finish(
    'consultation', focus,
    b.nodes.get(focus)!.label, when(e.period?.start),
    tree,
    'Inner boxes are the entries of the List around them (List.entry.item), so those links are shown by nesting rather than lines. Every List here also points back to the Encounter (List.encounter).',
    ['Consultation', 'Record structure', 'Recorded items'],
    g => consultationStory(g, b),
  )
}

// ── Medication ───────────────────────────────────────────────────────────

const authored = (r: AnyResource) => (r as { authoredOn?: string }).authoredOn ?? ''

export function buildMedicationGraph(bundle: fhir3.Bundle, med: GpConnectMedication): RelationshipGraph | undefined {
  const b = new GraphBuilder(bundle, true)
  const stmt = med.medicationStatementId ? lookupReference(b.index, `MedicationStatement/${med.medicationStatementId}`) : undefined
  const isPlan = (r: AnyResource | undefined): r is AnyResource => r?.resourceType === 'MedicationRequest' && (r as fhir3.MedicationRequest).intent === 'plan'

  let seeds = med.medicationRequestIds
    .map(ref => lookupReference(b.index, ref.includes('/') ? ref : `MedicationRequest/${ref}`))
    .filter(isPlan)
  if (!seeds.length && stmt) seeds = b.out(stmt).filter(h => h.path.endsWith('.basedOn')).map(h => h.other).filter(isPlan)
  if (!stmt && !seeds.length) return undefined

  // Follow the reauthorisation chain both ways (priorPrescription).
  const plans: AnyResource[] = []
  const queue = [...seeds]
  while (queue.length && plans.length < MAX_CHAIN) {
    const p = queue.shift()!
    if (plans.includes(p)) continue
    plans.push(p)
    for (const h of b.out(p)) if (h.path.endsWith('.priorPrescription') && isPlan(h.other)) queue.push(h.other)
    for (const h of b.in(p)) if (h.path.endsWith('.priorPrescription') && isPlan(h.other)) queue.push(h.other)
  }
  plans.sort((x, y) => authored(y).localeCompare(authored(x)))

  const placed = new Set<AnyResource>()
  const planNodes: TreeNode[] = plans.map(p => {
    const statements = b.in(p).filter(h => h.other.resourceType === 'MedicationStatement' && h.path.endsWith('.basedOn')).map(h => h.other)
    const issues = b.in(p)
      .filter(h => h.other.resourceType === 'MedicationRequest' && h.path.endsWith('.basedOn') && !isPlan(h.other))
      .map(h => h.other)
      .sort((x, y) => authored(y).localeCompare(authored(x)))
    const key = b.add(p, 'core', 2)
    const children: TreeNode[] = []
    for (const s of statements) { placed.add(s); children.push({ key: b.add(s, 'core', 1), children: [] }) }
    for (const i of issues) { placed.add(i); children.push({ key: b.add(i, 'core', 3), children: [] }) }
    return { key, children }
  })
  if (stmt && !placed.has(stmt)) planNodes.unshift({ key: b.add(stmt, 'core', 1), children: [] })

  const focus = stmt ? b.key(stmt) : b.key(plans[0])
  b.addNeighbours(4)
  const tree: TreeNode = {
    key: 'group:medication',
    group: { label: med.drugName, sub: plans.length > 1 ? 'Authorisation history, newest first' : 'Authorisation' },
    children: planNodes,
  }
  return b.finish(
    'medication', focus, med.drugName, med.status,
    tree,
    'Each authorisation box holds the statement and the issues that point to it (basedOn). The outer box groups the history and is not a FHIR resource.',
    ['Statements', 'Authorisations', 'Issues'],
    g => medicationStory(g, b, plans),
  )
}

// ── Investigation ────────────────────────────────────────────────────────

const COMMENT_NOTE = '37331000000100'
const isComment = (r: AnyResource) => hasCode(r, COMMENT_NOTE)

function derivedFrom(obs: AnyResource, index: BundleIndex): AnyResource | undefined {
  const related = (obs as { related?: { type?: string; target?: { reference?: string } }[] }).related ?? []
  return lookupReference(index, related.find(r => r.type === 'derived-from')?.target?.reference)
}

/** Takes the investigation as the record reads it: its name is usually more
 * specific than the report's own code, and its test groups are what the
 * Investigations view worked out for suppliers that send results flat. */
export function buildInvestigationGraph(
  bundle: fhir3.Bundle,
  inv: Pick<GpConnectInvestigation, 'id' | 'name' | 'testGroups'>,
): RelationshipGraph | undefined {
  const b = new GraphBuilder(bundle, false)
  const report = lookupReference(b.index, `DiagnosticReport/${inv.id}`)
  if (!report) return undefined
  const name = inv.name
  const focus = b.add(report, 'core', 1)
  if (name) b.nodes.get(focus)!.label = `Report: ${name}`

  // Results, then each result's members (Observation.related has-member), as deep as they go.
  const visited = new Set<AnyResource>([report])
  const treeOf = new Map<AnyResource, TreeNode>()
  const obsTree = (obs: AnyResource, depth: number): TreeNode => {
    visited.add(obs)
    const node: TreeNode = { key: b.add(obs, 'core', Math.min(depth + 1, 3)), children: [] }
    treeOf.set(obs, node)
    for (const h of b.out(obs)) {
      const t = h.other
      if (h.path !== 'Observation.related.target' || t.resourceType !== 'Observation' || visited.has(t)) continue
      if (isMemberLink(obs, t, b.index)) node.children.push(obsTree(t, depth + 1))
    }
    return node
  }
  const top: TreeNode[] = []
  for (const h of b.out(report)) {
    if (h.path === 'DiagnosticReport.result' && h.other.resourceType === 'Observation' && !visited.has(h.other)) top.push(obsTree(h.other, 1))
  }
  // A comment derived from one of the results sits inside that result.
  let children = top.filter(t => {
    const r = b.byKey.get(t.key)!
    const parent = isComment(r) ? derivedFrom(r, b.index) : undefined
    const host = parent && parent !== r ? treeOf.get(parent) : undefined
    if (!host) return true
    host.children.push(t)
    return false
  })

  // No has-member links at all: fall back to the groups the Investigations
  // view infers from result order (a valueless result heads the ones after it).
  const linked = children.some(t => t.children.some(c => !isComment(b.byKey.get(c.key)!)))
  if (!linked) {
    const byId = new Map(children.map(t => [b.byKey.get(t.key)?.id, t]))
    const moved = new Set<TreeNode>()
    for (const g of inv.testGroups) {
      const header = byId.get(g.id)
      if (!header) continue
      for (const r of g.results) {
        const member = byId.get(r.id)
        if (!member || member === header || moved.has(member)) continue
        header.children.push(member)
        header.inferred = true
        moved.add(member)
        b.nodes.get(member.key)!.lane = 3
      }
    }
    children = children.filter(t => !moved.has(t))
  }

  b.addNeighbours(4)
  const tree: TreeNode = { key: focus, children }
  const dr = report as fhir3.DiagnosticReport & { effectiveDateTime?: string }
  return b.finish(
    'investigation', focus,
    name ?? resolveItemDisplay(bundle, focus) ?? 'Investigation', when(dr.effectiveDateTime ?? dr.issued),
    tree,
    'Boxes inside the report are its results (DiagnosticReport.result). Boxes inside a result are its members (Observation.related, has-member) or a comment derived from it (Observation.related, derived-from). Dashed boxes marked "Grouped by order" are test groups the supplier sent as a flat list: they are grouped the way the Investigations view reads them, not by a FHIR reference.',
    ['Report', 'Results', 'Group members'],
    g => investigationStory(g, b),
  )
}

// ── Story ────────────────────────────────────────────────────────────────

/** "{a}, {b} and {c}" as segments, capped with "and N more". */
function listOf(keys: string[], cap = 4): StorySegment[] {
  const shown = keys.slice(0, cap)
  const rest = keys.length - shown.length
  const out: StorySegment[] = []
  shown.forEach((k, i) => {
    if (i > 0) out.push(i === shown.length - 1 && !rest ? ' and ' : ', ')
    out.push({ node: k })
  })
  if (rest) out.push(` and ${rest} more`)
  return out
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/** "Pointing back in" sentences: one per resource that references the core. */
function incomingStory(g: RelationshipGraph, b: GraphBuilder): StorySegment[][] {
  const paras: StorySegment[][] = []
  const inbound = [...g.nodes.values()].filter(n => n.role === 'in')
  const lists = inbound.filter(n => n.type === 'List')
  const others = inbound.filter(n => n.type !== 'List')
  for (const src of others.slice(0, 8)) {
    const byPath = new Map<string, string[]>()
    for (const e of g.edges) if (e.from === src.key && g.nodes.get(e.to)?.role === 'core') push(byPath, e.path, e.to)
    const p: StorySegment[] = [{ node: src.key }]
    let first = true
    for (const [path, targets] of byPath) {
      p.push(first ? ' points here: to ' : '; and to ', ...listOf(targets), ' ', { path })
      first = false
    }
    const far = g.edges.filter(e => e.from === src.key && g.nodes.get(e.to)?.role === 'far').map(e => e.to)
    if (far.length) {
      const total = b.out(b.byKey.get(src.key)!).filter(h => !SUPPORTING.has(h.other.resourceType) && !b.core.has(h.other)).length
      p.push('. It also reaches beyond: ', ...listOf(far, 3), total > far.length ? ` (${total} onward links in all)` : '')
    }
    p.push('.')
    paras.push(p)
  }
  if (others.length > 8) paras.push([`${others.length - 8} more resources point here; see the diagram for the rest.`])
  if (lists.length) {
    paras.push(['It is also listed in ', ...listOf(lists.map(l => l.key), 6), ' ', { path: 'List.entry.item' }, '.'])
  }
  return paras
}

function consultationStory(g: RelationshipGraph, b: GraphBuilder): StorySegment[][] {
  const enc = b.byKey.get(g.focus) as fhir3.Encounter
  const actor = (pattern: RegExp) => g.edges.find(e => e.from === g.focus && pattern.test(e.path))?.to
  const performer = actor(/participant\.individual$/)
  const location = actor(/location\.location$/)
  const org = actor(/serviceProvider$/)
  const paras: StorySegment[][] = []

  const p1: StorySegment[] = [`On ${when(enc.period?.start) ?? 'an unrecorded date'}, `]
  if (performer) p1.push({ node: performer }, ' saw the patient')
  else p1.push('the patient was seen')
  if (location) p1.push(' at ', { node: location })
  if (org) p1.push(' for ', { node: org })
  p1.push(' ', { path: 'Encounter.participant / location / serviceProvider' }, '. This is the ', { node: g.focus }, '.')
  paras.push(p1)

  const wrappers = g.tree.children
  if (!wrappers.length) {
    paras.push(['No consultation List points to this Encounter, so it has no recorded topics.'])
  }
  for (const w of wrappers) {
    const topics = w.children
    paras.push([
      'It is recorded as a ', { node: w.key }, ' ', { path: 'List.encounter' }, ', holding ',
      topics.length === 1 ? 'one topic, ' : `${plural(topics.length, 'topic')}: `, ...listOf(topics.map(t => t.key)), ' ', { path: 'List.entry.item' }, '.',
    ])
    for (const t of topics.slice(0, 6)) {
      const p: StorySegment[] = []
      const problem = g.edges.find(e => e.from === t.key && /RelatedProblemHeader/.test(e.path))
      if (problem) p.push({ node: t.key }, ' is filed under ', { node: problem.to }, ' ', { path: 'List.extension(RelatedProblemHeader)' }, '. ')
      const headings = t.children.filter(c => c.children.length || g.nodes.get(c.key)?.type === 'List')
      const direct = t.children.filter(c => !headings.includes(c))
      if (headings.length) {
        if (problem) p.push('It has ')
        else p.push({ node: t.key }, ' has ')
        p.push(plural(headings.length, 'heading'), ': ')
        headings.forEach((h, i) => {
          if (i) p.push(i === headings.length - 1 ? ' and ' : ', ')
          p.push({ node: h.key })
          const items = h.children.map(c => c.key)
          if (items.length <= 2) p.push(' with ', ...listOf(items))
          else p.push(` with ${items.length} entries, such as `, { node: items[0] })
        })
        p.push('.')
      }
      if (direct.length) {
        if (headings.length) p.push(' It also holds ')
        else p.push({ node: t.key }, ' holds ')
        p.push(...listOf(direct.map(d => d.key)), ' directly.')
      }
      if (p.length) paras.push(p)
    }
    if (topics.length > 6) paras.push([`${topics.length - 6} more topics follow the same pattern.`])
  }
  paras.push(...incomingStory(g, b))
  return paras
}

function medicationStory(g: RelationshipGraph, b: GraphBuilder, plans: AnyResource[]): StorySegment[][] {
  const paras: StorySegment[][] = []
  const oldestFirst = [...plans].reverse()
  const product = g.edges.find(e => g.nodes.get(e.to)?.type === 'Medication')?.to
  const drug: StorySegment = product ? { node: product } : g.title

  oldestFirst.forEach((plan, i) => {
    const key = b.key(plan)
    const r = plan as fhir3.MedicationRequest & { statusReason?: unknown }
    const p: StorySegment[] = []
    const prior = g.edges.find(e => e.from === key && e.path.endsWith('.priorPrescription'))
    if (i === 0) p.push(drug, ' was first authorised as ', { node: key }, ' ', { path: 'MedicationRequest intent=plan' }, '.')
    else if (prior) p.push('Then ', { node: key }, ' replaced ', { node: prior.to }, ' ', { path: 'MedicationRequest.priorPrescription' }, '.')
    else p.push('A separate ', { node: key }, ' was also made, with no priorPrescription link to the others.')

    const issues = g.edges.filter(e => e.to === key && e.path === 'MedicationRequest.basedOn').map(e => e.from)
    if (issues.length) {
      p.push(` ${issues.length === 1 ? 'One issue was' : `${issues.length} issues were`} made under it, `, ...listOf(issues, 3), ' ', { path: 'MedicationRequest.basedOn' })
      const inEncounter = issues.map(i => g.edges.find(e => e.from === i && e.path === 'MedicationRequest.context')).filter(Boolean)
      if (inEncounter.length) p.push(`; ${inEncounter.length === issues.length ? (issues.length === 1 ? 'it was' : 'all were') : `${inEncounter.length} were`} made in `, { node: inEncounter[0]!.to }, ' ', { path: 'MedicationRequest.context' })
      p.push('.')
    } else p.push(' No issues point to it.')
    if (r.status === 'stopped' || r.status === 'cancelled') p.push(` It is ${r.status}.`)
    paras.push(p)

    // EMIS sometimes timestamps an issue before the authorisation it is based on.
    const planTime = Date.parse(authored(plan))
    for (const issueKey of issues) {
      const t = Date.parse(authored(b.byKey.get(issueKey)!))
      if (Number.isFinite(planTime) && Number.isFinite(t) && t < planTime) {
        const mins = Math.floor((planTime - t) / 60000)
        paras.push([{ node: issueKey }, ` is timestamped ${mins < 120 ? plural(mins, 'minute') : plural(Math.round(mins / 60), 'hour')} before its own authorisation, `, { node: key }, '. EMIS can produce this, so it is worth knowing about when testing.'])
        break
      }
    }
  })

  const stmts = g.edges.filter(e => g.nodes.get(e.from)?.type === 'MedicationStatement' && e.path === 'MedicationStatement.basedOn')
  if (stmts.length) {
    const p: StorySegment[] = [stmts.length === 1 ? 'The statement ' : 'Each authorisation has its own statement: ']
    stmts.forEach((s, i) => {
      if (i) p.push(i === stmts.length - 1 ? ' and ' : ', ')
      p.push({ node: s.from }, ' for ', { node: s.to })
    })
    p.push(' ', { path: 'MedicationStatement.basedOn' }, '.')
    paras.push(p)
  }

  const recorders = [...new Set(g.edges.filter(e => g.nodes.get(e.from)?.role === 'core' && /\.(recorder|requester\.agent|informationSource)$/.test(e.path)).map(e => e.to))]
  if (recorders.length) paras.push([recorders.length === 1 ? 'Everything here was recorded by ' : 'They were recorded by ', ...listOf(recorders), ' ', { path: 'MedicationRequest.recorder' }, '.'])

  paras.push(...incomingStory(g, b))
  return paras
}

function investigationStory(g: RelationshipGraph, b: GraphBuilder): StorySegment[][] {
  const paras: StorySegment[][] = []
  const dr = b.byKey.get(g.focus) as fhir3.DiagnosticReport & { effectiveDateTime?: string }
  const from = (key: string, pattern: RegExp) => g.edges.filter(e => e.from === key && pattern.test(e.path)).map(e => e.to)

  const p1: StorySegment[] = [{ node: g.focus }, ` was issued ${dr.issued ? `on ${when(dr.issued)}` : 'with no issued date'} `, { path: 'DiagnosticReport.issued' }]
  const performers = from(g.focus, /performer\.actor$/)
  if (performers.length) p1.push(' by ', ...listOf(performers), ' ', { path: 'DiagnosticReport.performer.actor' })
  p1.push('.')
  const enc = from(g.focus, /\.context$/)[0]
  if (enc) p1.push(' It is filed in ', { node: enc }, ' ', { path: 'DiagnosticReport.context' }, '.')
  paras.push(p1)

  const results = g.tree.children
  if (!results.length) paras.push(['It holds no results.'])
  else {
    const groups = results.filter(t => t.children.some(c => !isComment(b.byKey.get(c.key)!)))
    const comments = results.filter(t => isComment(b.byKey.get(t.key)!))
    const single = results.filter(t => !groups.includes(t) && !comments.includes(t))
    const total = g.edges.filter(e => e.from === g.focus && e.path === 'DiagnosticReport.result').length
    const p: StorySegment[] = [`It holds ${plural(total, 'result')} `, { path: 'DiagnosticReport.result' }, '.']
    if (groups.length) {
      p.push(` ${groups.length === 1 ? 'One is a test group' : `${groups.length} are test groups`}: `)
      groups.slice(0, 4).forEach((t, i) => {
        if (i) p.push(i === Math.min(groups.length, 4) - 1 ? ' and ' : ', ')
        const members = t.children.filter(c => !isComment(b.byKey.get(c.key)!))
        p.push({ node: t.key }, ` with ${plural(members.length, 'member')}`)
        if (members.length) p.push(members.length <= 2 ? ' (' : ', such as ', ...listOf(members.map(m => m.key), 2), members.length <= 2 ? ')' : '')
      })
      if (groups.length > 4) p.push(` and ${groups.length - 4} more`)
      if (groups.some(t => t.inferred)) {
        p.push('. These groups have no FHIR link: every result sits directly in the report, and, like the Investigations view, the picture groups them by order. A result with no value starts a group and the results after it belong to it.')
      } else p.push(' ', { path: 'Observation.related (has-member)' }, '.')
    }
    if (single.length) p.push(groups.length ? ' The rest stand alone: ' : ' Each stands alone: ', ...listOf(single.map(t => t.key)), '.')
    if (comments.length) p.push(' ', ...listOf(comments.map(t => t.key), 2), comments.length === 1 ? ' is the filing comment for the whole report.' : ' are filing comments for the whole report.')
    paras.push(p)
  }

  // Comments nested in a result (derived-from)
  const nestedComments: [string, string][] = []
  const walk = (t: TreeNode) => t.children.forEach(c => {
    if (isComment(b.byKey.get(c.key)!) && t.key !== g.focus) nestedComments.push([c.key, t.key])
    walk(c)
  })
  walk(g.tree)
  for (const [c, t] of nestedComments.slice(0, 4)) paras.push([{ node: c }, ' is a comment on ', { node: t }, ' ', { path: 'Observation.related' }, '.'])
  if (nestedComments.length > 4) paras.push([`${nestedComments.length - 4} more results carry comments.`])

  const specimens = [...new Set(g.edges.filter(e => g.nodes.get(e.to)?.type === 'Specimen').map(e => e.to))]
  if (specimens.length) {
    const ownSpecimen = new Set(g.edges.filter(e => e.path === 'Observation.specimen').map(e => e.from)).size
    paras.push([
      specimens.length === 1 ? 'The sample was ' : 'The samples were ', ...listOf(specimens), ' ', { path: 'DiagnosticReport.specimen' },
      ownSpecimen ? `; ${plural(ownSpecimen, 'result')} also ${ownSpecimen === 1 ? 'names its' : 'name their'} own ` : '.',
      ...(ownSpecimen ? [{ path: 'Observation.specimen' } as StorySegment, '.'] : []),
    ])
  }

  const obsKeys = [...g.nodes.values()].filter(n => n.role === 'core' && n.type === 'Observation').map(n => n.key)
  if (enc && obsKeys.length) {
    const inEnc = obsKeys.filter(k => g.edges.some(e => e.from === k && e.to === enc && e.path === 'Observation.context')).length
    if (inEnc) paras.push([inEnc === obsKeys.length ? 'Every result also points to ' : `${inEnc} of the ${obsKeys.length} results also point to `, { node: enc }, ' ', { path: 'Observation.context' }, '.'])
  }
  const obsPerformers = [...new Set(g.edges.filter(e => obsKeys.includes(e.from) && e.path === 'Observation.performer').map(e => e.to))]
  if (obsPerformers.length) paras.push(['The results name ', ...listOf(obsPerformers), ' as performer ', { path: 'Observation.performer' }, '.'])

  const otherLinks = new Map<string, string[]>()
  for (const e of g.edges) {
    if (g.nodes.get(e.from)?.role === 'core' && g.nodes.get(e.to)?.role === 'out' && g.nodes.get(e.to)?.type !== 'Specimen') push(otherLinks, e.path, e.to)
  }
  for (const [path, targets] of otherLinks) paras.push(['They also link to ', ...listOf([...new Set(targets)], 3), ' ', { path }, '.'])

  paras.push(...incomingStory(g, b))
  return paras
}

/** Which resources name the patient, and any core resource that doesn't. */
function patientStory(g: RelationshipGraph): StorySegment[][] {
  const links = g.edges.filter(e => e.kind === 'patient')
  if (!links.length) return []
  const patient = links[0].to
  const sources = new Set(links.map(e => e.from))
  const paths = [...new Set(links.map(e => e.path))]
  const clinical = [...g.nodes.values()].filter(n => n.role !== 'patient' && !SUPPORTING.has(n.type)).length
  const p: StorySegment[] = [`${sources.size} of the ${clinical} clinical resources here point to `, { node: patient }, ' (']
  paths.slice(0, 4).forEach((path, i) => { if (i) p.push(', '); p.push({ path }) })
  if (paths.length > 4) p.push(` and ${paths.length - 4} more`)
  p.push('). Lines to the patient are drawn only for the resource you hover over or select.')
  const missing = [...g.nodes.values()].filter(n => n.role === 'core' && !sources.has(n.key) && n.type !== 'List').map(n => n.key)
  if (missing.length) p.push(' ', ...listOf(missing, 3), missing.length === 1 ? " doesn't name the patient." : " don't name the patient.")
  return [p]
}
