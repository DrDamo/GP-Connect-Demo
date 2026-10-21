import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { EdgeKind, GraphEdge, GraphNode, RelationshipGraph, TreeNode } from '../../fhir/relationshipGraph'
import type { GpConnectBundle } from '../../fhir/types'
import type { DomainId } from './domains'
import { findRecordLocation } from './recordLocation'

type Mode = 'nested' | 'wiring' | 'orbit' | 'timeline'

const DOMAIN_TITLE: Record<RelationshipGraph['domain'], string> = {
  consultation: 'Consultation relationships',
  medication: 'Medication relationships',
  investigation: 'Investigation relationships',
}

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'nested', label: 'Nested', hint: 'Boxes inside boxes, shaped like the record' },
  { mode: 'wiring', label: 'Wiring', hint: 'Columns by role, every reference drawn as a line' },
  { mode: 'orbit', label: 'Orbit', hint: 'Everything around one resource, by distance' },
  { mode: 'timeline', label: 'Timeline', hint: 'Authorisations as bars over time, with each issue marked on its bar' },
]

/** Timeline only makes sense where the resources form a dated sequence. */
const modesFor = (domain: RelationshipGraph['domain']) => MODES.filter(m => m.mode !== 'timeline' || domain === 'medication')

const KINDS: { kind: EdgeKind; label: string }[] = [
  { kind: 'contains', label: 'Contains (List entry)' },
  { kind: 'chain', label: 'Based on or replaces' },
  { kind: 'link', label: 'Clinical link' },
  { kind: 'context', label: 'Happened in' },
  { kind: 'actor', label: 'Who, where, product or sample' },
  { kind: 'patient', label: 'About the patient' },
]

/** Boxes with more children than this start collapsed. */
const COLLAPSE_AT = 8
const COLLAPSED_SHOW = 6
/** Orbit groups a ring by resource type once it holds more than this. */
const ORBIT_RING_MAX = 14
/** Above this many resources Orbit always groups — ungrouped it is unreadable. */
const ORBIT_SHOW_ALL_MAX = 60

const LABEL_FONT = '600 12.5px "IBM Plex Sans", Arial, sans-serif'
const TYPE_FONT = '500 10px "IBM Plex Mono", monospace'
const NODE_H = 40

// ── Text measurement ─────────────────────────────────────────────────────

let measureCtx: CanvasRenderingContext2D | null | undefined
function textWidth(s: string, font: string): number {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return s.length * 7
  measureCtx.font = font
  return measureCtx.measureText(s).width
}

function fitText(s: string, font: string, max: number): string {
  if (textWidth(s, font) <= max) return s
  let lo = 0, hi = s.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (textWidth(s.slice(0, mid) + '…', font) <= max) lo = mid
    else hi = mid - 1
  }
  return s.slice(0, lo) + '…'
}

interface Box { x: number; y: number; w: number; h: number }

function nodeBox(label: string, type: string, maxW: number): { label: string; w: number } {
  const fitted = fitText(label, LABEL_FONT, maxW - 24)
  const w = Math.ceil(Math.max(textWidth(fitted, LABEL_FONT), textWidth(type, TYPE_FONT) + 14)) + 26
  return { label: fitted, w: Math.min(w, maxW) }
}

function clipToBox(b: Box, tx: number, ty: number): [number, number] {
  const dx = tx - b.x, dy = ty - b.y
  if (!dx && !dy) return [b.x, b.y]
  const s = Math.min((b.w / 2 + 2) / Math.abs(dx || 1e-9), (b.h / 2 + 2) / Math.abs(dy || 1e-9))
  return [b.x + dx * s, b.y + dy * s]
}

/** Spreads parallel edges between the same pair so they don't overlap. */
function pairOffsets(edges: { from: string; to: string }[]): number[] {
  const groups = new Map<string, number[]>()
  edges.forEach((e, i) => {
    const k = [e.from, e.to].sort().join('|')
    const g = groups.get(k)
    if (g) g.push(i)
    else groups.set(k, [i])
  })
  const off: number[] = []
  for (const g of groups.values()) g.forEach((i, j) => { off[i] = j - (g.length - 1) / 2 })
  return off
}

// ── Shared interaction state ─────────────────────────────────────────────

interface Interaction {
  active: string | null
  pinned: string | null
  hot: Set<string>
  /** Props that make an element a hoverable, focusable, clickable node */
  bind: (key: string, label: string) => {
    'data-key': string
    tabIndex: number
    role: 'button'
    'aria-label': string
    'aria-pressed': boolean
    onMouseOver: (e: React.MouseEvent) => void
    onFocus: (e: React.FocusEvent) => void
    onBlur: () => void
    onClick: (e: React.MouseEvent) => void
    onKeyDown: (e: React.KeyboardEvent) => void
  }
}

function nodeClass(i: Interaction, key: string, focus: string, extra = '') {
  return [
    extra,
    key === focus && 'focus',
    i.hot.has(key) && 'hot',
    i.pinned === key && 'pinned',
  ].filter(Boolean).join(' ')
}

function Markers({ uid }: { uid: string }) {
  return (
    <defs>
      {KINDS.map(({ kind }) => (
        <marker key={kind} id={`${uid}-${kind}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 z" style={{ fill: `var(--viz-${kind})` }} />
        </marker>
      ))}
    </defs>
  )
}

function SvgNode({ node, x, y, maxW, i, focus, extraClass = '', labelOverride }: {
  node: { key: string; type: string; label: string; sub?: string; kind: string }
  x: number
  y: number
  maxW: number
  i: Interaction
  focus: string
  extraClass?: string
  labelOverride?: string
}) {
  const { label, w } = nodeBox(labelOverride ?? node.label, node.type, maxW)
  return (
    <g className={`viz-node ${nodeClass(i, node.key, focus, extraClass)}`} {...i.bind(node.key, `${node.type}: ${node.label}`)}>
      <rect className="box" x={x - w / 2} y={y - NODE_H / 2} width={w} height={NODE_H} rx={7} />
      <circle cx={x - w / 2 + 12} cy={y - 8} r={3.5} style={{ fill: `var(--viz-${node.kind})` }} />
      <text className="ty" x={x - w / 2 + 20} y={y - 4.5}>{node.type}</text>
      <text className="lb" x={x - w / 2 + 10} y={y + 12}>{label}</text>
      <title>{`${node.type}: ${node.label}${node.sub ? ` — ${node.sub}` : ''}`}</title>
    </g>
  )
}

function TypeLine({ node }: { node: GraphNode }) {
  return (
    <span className="font-mono text-[10.5px] text-muted inline-flex items-center gap-1.5">
      <i className="viz-dot" style={{ background: `var(--viz-${node.kind})` }} />
      {node.type}
    </span>
  )
}

// ── Nested ───────────────────────────────────────────────────────────────

function NestedView({ graph, visible, edges, hiddenUnder, expanded, onToggleExpand, i, uid }: {
  graph: RelationshipGraph
  visible: Set<string>
  edges: GraphEdge[]
  hiddenUnder: Map<string, number>
  expanded: Set<string>
  onToggleExpand: (key: string) => void
  i: Interaction
  uid: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [paths, setPaths] = useState<{ d: string; e: GraphEdge }[]>([])

  const draw = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const base = wrap.getBoundingClientRect()
    const elOf = (key: string) => wrap.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)
    const rect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top, cy: (r.top + r.bottom) / 2 - base.top }
    }
    const out: { d: string; e: GraphEdge }[] = []
    for (const e of edges) {
      const ea = elOf(e.from), eb = elOf(e.to)
      if (!ea || !eb) continue
      // Containment is already shown by one box sitting inside the other.
      if (ea.contains(eb) || eb.contains(ea)) continue
      const a = rect(ea), b = rect(eb)
      const aRail = !!ea.closest('[data-rail]'), bRail = !!eb.closest('[data-rail]')
      let d: string
      if (aRail && bRail) {
        const x = Math.min(a.l, b.l), bulge = 26 + Math.abs(a.cy - b.cy) * 0.12
        d = `M${a.l},${a.cy} C${x - bulge},${a.cy} ${x - bulge},${b.cy} ${b.l - 2},${b.cy}`
      } else if (!aRail && !bRail) {
        const down = b.cy > a.cy, y1 = down ? a.b : a.t, y2 = down ? b.t - 2 : b.b + 2, x = Math.min(a.r, b.r) - 24
        d = `M${x},${y1} C${x + 44},${y1 + (down ? 24 : -24)} ${x + 44},${y2 + (down ? -24 : 24)} ${x},${y2}`
      } else {
        const tree = aRail ? b : a, rail = aRail ? a : b
        const x1 = tree.r, y1 = Math.min(Math.max(rail.cy, tree.t + 14), tree.b - 14), x2 = rail.l, y2 = rail.cy, c = (x2 - x1) * 0.5
        d = aRail
          ? `M${x2},${y2} C${x2 - c},${y2} ${x1 + c},${y1} ${x1 + 2},${y1}`
          : `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2 - 2},${y2}`
      }
      out.push({ d, e })
    }
    setPaths(out)
  }, [edges])

  useLayoutEffect(() => {
    draw()
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [draw, visible, expanded])

  const head = (node: GraphNode) => (
    <div className="flex flex-col gap-px min-w-0">
      <TypeLine node={node} />
      <span className="font-semibold text-sm text-ink break-words">{node.label}</span>
      {node.sub && <span className="text-xs text-muted break-words">{node.sub}</span>}
    </div>
  )

  const renderBox = (t: TreeNode): ReactNode => {
    if (!t.group && !visible.has(t.key)) return null
    const kids = t.children.map(renderBox).filter(Boolean)
    const more = hiddenUnder.get(t.key)
    const canCollapse = expanded.has(t.key) && t.children.length > COLLAPSE_AT
    const footer = (more || canCollapse) && (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggleExpand(t.key) }}
        className="self-start text-xs text-accent hover:underline"
      >
        {more ? `Show ${more} more` : 'Show fewer'}
      </button>
    )
    if (t.group) {
      return (
        <div key={t.key} className="viz-box group">
          <div className="flex flex-col gap-px">
            <span className="font-mono text-[10.5px] text-muted">Grouping (not a FHIR resource)</span>
            <span className="font-semibold text-sm text-ink">{t.group.label}</span>
            {t.group.sub && <span className="text-xs text-muted">{t.group.sub}</span>}
          </div>
          {kids.length > 0 && <div className="viz-kids flex-col !flex-nowrap">{kids}</div>}
          {footer}
        </div>
      )
    }
    const node = graph.nodes.get(t.key)!
    return (
      <div key={t.key} className={`viz-box ${nodeClass(i, t.key, graph.focus, t.inferred ? 'inferred' : '')}`} {...i.bind(t.key, `${node.type}: ${node.label}`)}>
        {head(node)}
        {t.inferred && kids.length > 0 && (
          <span className="text-[11px] text-muted -mt-1" title="These results are not linked to this one in FHIR; they follow it in DiagnosticReport.result, which is how the Investigations view groups them.">
            Grouped by order, not a FHIR link
          </span>
        )}
        {kids.length > 0 && <div className="viz-kids">{kids}</div>}
        {footer}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative grid grid-cols-[minmax(0,1.7fr)_minmax(13rem,1fr)] gap-10 xl:gap-14 p-4 sm:p-5 min-w-[620px]">
      {/* Lines sit faintly behind the boxes; the hovered or selected
          resource's own lines are redrawn on top at full strength. */}
      <svg className={`absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0 viz-behind ${i.active ? 'is-dim' : ''}`} aria-hidden>
        <Markers uid={uid} />
        {paths.map(({ d, e }, n) => (
          <path key={n} d={d} className={`viz-edge ${e.kind}`} markerEnd={`url(#${uid}-${e.kind})`} />
        ))}
      </svg>
      {i.active && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[2]" aria-hidden>
          {paths.filter(({ e }) => e.from === i.active || e.to === i.active).map(({ d, e }, n) => (
            <path key={n} d={d} className={`viz-edge ${e.kind} hot`} markerEnd={`url(#${uid}-${e.kind})`} />
          ))}
        </svg>
      )}
      <div className="min-w-0">{renderBox(graph.tree)}</div>
      <div data-rail className="flex flex-col gap-4 min-w-0">
        {graph.rail.map(group => {
          const keys = group.keys.filter(k => visible.has(k))
          if (!keys.length) return null
          return (
            <div key={group.title} className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-muted">{group.title}</h4>
              {keys.map(k => {
                const node = graph.nodes.get(k)!
                return (
                  <div key={k} className={`viz-card ${nodeClass(i, k, graph.focus, node.role === 'far' ? 'far' : '')}`} {...i.bind(k, `${node.type}: ${node.label}`)}>
                    <TypeLine node={node} />
                    <span className="font-semibold text-[13px] text-ink break-words">{node.label}</span>
                    {node.sub && <span className="text-xs text-muted break-words">{node.sub}</span>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <p className="col-span-full text-xs text-muted -mt-6">{graph.treeNote}</p>
    </div>
  )
}

// ── Wiring (lanes) ───────────────────────────────────────────────────────

function WiringView({ graph, visible, edges, width, i, uid }: {
  graph: RelationshipGraph
  visible: Set<string>
  edges: GraphEdge[]
  /** Space available; lanes stretch to fill it and scroll below 190px each */
  width: number
  i: Interaction
  uid: string
}) {
  const laneN = graph.lanes.length
  const laneW = Math.max(190, Math.floor(width / laneN))
  const W = laneW * laneN, top = 60, gap = 16
  const byLane: GraphNode[][] = graph.lanes.map(() => [])
  for (const n of graph.nodes.values()) if (visible.has(n.key)) byLane[n.lane]?.push(n)
  const tallest = Math.max(1, ...byLane.map(l => l.length))
  const H = top + tallest * (NODE_H + gap) + 24

  const boxes = new Map<string, Box & { lane: number }>()
  byLane.forEach((nodes, li) => {
    nodes.forEach((n, j) => {
      const { w } = nodeBox(n.label, n.type, laneW - 16)
      boxes.set(n.key, { x: li * laneW + laneW / 2, y: top + NODE_H / 2 + j * (NODE_H + gap), w, h: NODE_H, lane: li })
    })
  })
  const offs = pairOffsets(edges)

  return (
    <svg className={`block ${i.active ? 'is-dim' : ''}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Wiring view">
      <Markers uid={uid} />
      {graph.lanes.map((t, li) => (
        <g key={t}>
          {li % 2 === 0 && <rect className="viz-lane-bg" x={li * laneW + 4} y={8} width={laneW - 8} height={H - 16} rx={10} />}
          <text className="viz-lane-title" x={li * laneW + laneW / 2} y={34} textAnchor="middle">{t}</text>
        </g>
      ))}
      <g>
        {edges.map((e, n) => {
          const a = boxes.get(e.from), b = boxes.get(e.to)
          if (!a || !b) return null
          const oy = offs[n] * 8
          let d: string
          if (a.lane === b.lane) {
            const side = a.lane === laneN - 1 ? -1 : 1
            const x1 = a.x + side * a.w / 2, x2 = b.x + side * b.w / 2, bulge = side * (28 + Math.abs(a.y - b.y) * 0.18)
            d = `M${x1},${a.y + oy} C${x1 + bulge},${a.y + oy} ${x2 + bulge},${b.y + oy} ${x2 + side * 2},${b.y + oy}`
          } else {
            const dir = b.lane > a.lane ? 1 : -1
            const x1 = a.x + dir * a.w / 2, x2 = b.x - dir * (b.w / 2 + 2), c = Math.max(40, Math.abs(x2 - x1) * 0.45)
            d = `M${x1},${a.y + oy} C${x1 + dir * c},${a.y + oy} ${x2 - dir * c},${b.y + oy} ${x2},${b.y + oy}`
          }
          const hot = i.active && (e.from === i.active || e.to === i.active)
          return <path key={n} d={d} className={`viz-edge ${e.kind} ${hot ? 'hot' : ''}`} markerEnd={`url(#${uid}-${e.kind})`} />
        })}
      </g>
      <g>
        {byLane.flat().map(n => {
          const b = boxes.get(n.key)!
          return <SvgNode key={n.key} node={n} x={b.x} y={b.y} maxW={laneW - 16} i={i} focus={graph.focus} extraClass={n.role === 'far' ? 'far' : ''} />
        })}
      </g>
    </svg>
  )
}

// ── Orbit ────────────────────────────────────────────────────────────────

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 z`
}

interface OrbitItem { key: string; type: string; label: string; sub?: string; kind: string; members?: string[]; far?: boolean }

function OrbitView({ graph, visible, edges, layoutEdges, centre, showAll, width, i, uid }: {
  graph: RelationshipGraph
  visible: Set<string>
  /** Lines to draw */
  edges: GraphEdge[]
  /** Lines that decide placement — the same minus hover-only ones */
  layoutEdges: GraphEdge[]
  centre: string
  width: number
  showAll: boolean
  i: Interaction
  uid: string
}) {

  const { items, mapped, ring1, ring2 } = useMemo(() => {
    const neighbours = new Set<string>()
    for (const e of layoutEdges) {
      if (e.from === centre) neighbours.add(e.to)
      if (e.to === centre) neighbours.add(e.from)
    }
    const r1 = [...visible].filter(k => k !== centre && neighbours.has(k))
    const r2 = [...visible].filter(k => k !== centre && !neighbours.has(k))
    const mapping = new Map<string, string>()
    const all = new Map<string, OrbitItem>()
    const place = (keys: string[], ring: string): string[] => {
      const byType = new Map<string, string[]>()
      for (const k of keys) {
        const t = graph.nodes.get(k)!.type
        const g = byType.get(t)
        if (g) g.push(k)
        else byType.set(t, [k])
      }
      const out: string[] = []
      const group = !showAll && keys.length > ORBIT_RING_MAX
      for (const [type, ks] of byType) {
        if (group && ks.length > 1) {
          const key = `cluster:${ring}:${type}`
          const first = graph.nodes.get(ks[0])!
          all.set(key, { key, type, label: `${ks.length} × ${type}`, kind: first.kind, members: ks })
          ks.forEach(k => mapping.set(k, key))
          out.push(key)
        } else {
          for (const k of ks) {
            const n = graph.nodes.get(k)!
            all.set(k, { ...n, far: n.role === 'far' })
            mapping.set(k, k)
            out.push(k)
          }
        }
      }
      return out
    }
    const c = graph.nodes.get(centre)!
    all.set(centre, { ...c })
    mapping.set(centre, centre)
    return { ring1: place(r1, '1'), ring2: place(r2, '2'), items: all, mapped: mapping }
  }, [graph, visible, layoutEdges, centre, showAll])

  const rank: Record<string, number> = { cond: 0, list: 1, enc: 2, obs: 3, mr: 4, ms: 5, med: 6, who: 7 }
  const ang = new Map<string, number>()
  const sorted1 = [...ring1].sort((a, b) => (rank[items.get(a)!.kind] ?? 9) - (rank[items.get(b)!.kind] ?? 9))
  sorted1.forEach((k, n) => ang.set(k, -Math.PI / 2 + (n / Math.max(1, sorted1.length)) * Math.PI * 2))

  // Lines between grouped nodes merge into one, thicker the more it carries.
  const merge = useCallback((list: GraphEdge[]) => {
    const seen = new Map<string, GraphEdge & { members: GraphEdge[] }>()
    for (const e of list) {
      const from = mapped.get(e.from), to = mapped.get(e.to)
      if (!from || !to || from === to) continue
      const k = `${from}|${to}|${e.kind}`
      const hit = seen.get(k)
      if (hit) hit.members.push(e)
      else seen.set(k, { ...e, from, to, members: [e] })
    }
    return [...seen.values()]
  }, [mapped])
  const placementEdges = useMemo(() => merge(layoutEdges), [merge, layoutEdges])
  const orbitEdges = useMemo(() => merge(edges), [merge, edges])

  // Outer ring: sit near the inner-ring resources each one links to, then spread apart.

  const ring2Angles = [...ring2]
  for (const k of ring2Angles) {
    let vx = 0, vy = 0, count = 0
    for (const e of placementEdges) {
      const other = e.from === k ? e.to : e.to === k ? e.from : undefined
      const a = other !== undefined ? ang.get(other) : undefined
      if (a !== undefined) { vx += Math.cos(a); vy += Math.sin(a); count++ }
    }
    ang.set(k, count ? Math.atan2(vy, vx) : 0)
  }
  const minSep = (Math.PI * 2) / Math.max(ring2Angles.length, 12) * 0.92
  for (let pass = 0; pass < 60; pass++) {
    ring2Angles.sort((a, b) => ang.get(a)! - ang.get(b)!)
    for (let n = 0; n < ring2Angles.length; n++) {
      const a = ring2Angles[n], b = ring2Angles[(n + 1) % ring2Angles.length]
      if (a === b) continue
      let d = ang.get(b)! - ang.get(a)!
      if (n === ring2Angles.length - 1) d += Math.PI * 2
      if (d < minSep) {
        const push = (minSep - d) / 2
        ang.set(a, ang.get(a)! - push)
        ang.set(b, ang.get(b)! + push)
      }
    }
  }

  // Rings grow with the number of resources on them so boxes don't overlap.
  const s1 = Math.min(1.5, Math.max(1, ring1.length / 9))
  const R1 = { x: 270 * s1, y: 190 * s1 }
  const s2 = Math.min(1.4, Math.max(1, ring2.length / 14))
  const R2 = { x: Math.max(R1.x + 210, 470 * s2), y: Math.max(R1.y + 140, 330 * s2) }
  const W = Math.round(2 * (R2.x + 110)), H = Math.round(2 * (R2.y + 40)), cx = W / 2, cy = H / 2
  const maxW = 190
  const pos = new Map<string, Box>()
  const put = (k: string, x: number, y: number) => {
    const it = items.get(k)!
    pos.set(k, { x, y, w: nodeBox(it.label, it.type, maxW).w, h: NODE_H })
  }
  put(centre, cx, cy)
  ring1.forEach(k => put(k, cx + R1.x * Math.cos(ang.get(k)!), cy + R1.y * Math.sin(ang.get(k)!)))
  ring2.forEach(k => put(k, cx + R2.x * Math.cos(ang.get(k)!), cy + R2.y * Math.sin(ang.get(k)!)))
  const offs = pairOffsets(orbitEdges)

  return (
    // Shrinks to fit the pane, but never below 80% so labels stay legible; past that it scrolls.
    <svg
      className={`block mx-auto h-auto ${i.active ? 'is-dim' : ''}`}
      style={{ width: Math.round(Math.max(Math.min(W, width), W * 0.8)) }}
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label="Orbit view"
    >
      <Markers uid={uid} />
      {/* Outer band is cut around the inner ring so the two tints don't mix. */}
      <path
        className="viz-ring outer"
        fillRule="evenodd"
        d={`${ellipsePath(cx, cy, R2.x, R2.y)} ${ellipsePath(cx, cy, R1.x, R1.y)}`}
      />
      <ellipse className="viz-ring inner" cx={cx} cy={cy} rx={R1.x} ry={R1.y} />
      <g>
        {orbitEdges.map((e, n) => {
          const a = pos.get(e.from), b = pos.get(e.to)
          if (!a || !b) return null
          const [x1, y1] = clipToBox(a, b.x, b.y), [x2, y2] = clipToBox(b, a.x, a.y)
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1
          const o = offs[n] * 34, qx = mx - (y2 - y1) / len * o, qy = my + (x2 - x1) / len * o
          const hot = i.active && (e.members.some(m => m.from === i.active || m.to === i.active) || e.from === i.active || e.to === i.active)
          return (
            <path
              key={n}
              d={`M${x1},${y1} Q${qx},${qy} ${x2},${y2}`}
              className={`viz-edge ${e.kind} ${hot ? 'hot' : ''}`}
              strokeWidth={e.members.length > 1 ? Math.min(5, 1.5 + Math.log2(e.members.length)) : undefined}
              markerEnd={`url(#${uid}-${e.kind})`}
            />
          )
        })}
      </g>
      <g>
        {[...pos.entries()].map(([k, b]) => {
          const it = items.get(k)!
          return (
            <SvgNode
              key={k}
              node={it}
              x={b.x}
              y={b.y}
              maxW={maxW}
              i={i}
              focus={centre}
              extraClass={it.members ? 'cluster' : it.far ? 'far' : ''}
            />
          )
        })}
      </g>
    </svg>
  )
}

// ── Timeline (medications) ───────────────────────────────────────────────

const DAY = 86_400_000
const TL_LABEL_W = 230
const TL_ROW_H = 70

// Reads dates off the FHIR resource behind each node.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

function parseTime(s: string | undefined): number | undefined {
  if (!s) return undefined
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : undefined
}

/** Axis ticks: years for long spans, otherwise months, thinned to fit. */
function timeTicks(from: number, to: number, px: number): { t: number; label: string }[] {
  const years = (to - from) / (365 * DAY)
  const ticks: { t: number; label: string }[] = []
  const d = new Date(from)
  // Years unless there's room to label months (e.g. when zoomed in).
  if (years > 3 && px / years < 420) {
    const step = Math.max(1, Math.ceil(years / Math.max(1, px / 70)))
    for (let y = d.getFullYear() + 1; Date.UTC(y, 0, 1) <= to; y += step) ticks.push({ t: Date.UTC(y, 0, 1), label: String(y) })
  } else {
    const months = Math.max(1, Math.round(years * 12))
    const step = [1, 2, 3, 6, 12].find(s => (px / months) * s >= 64) ?? 12
    for (let m = d.getMonth() + 1; ; m += step) {
      const t = Date.UTC(d.getFullYear(), m, 1)
      if (t > to) break
      const at = new Date(t)
      if (at.getUTCMonth() % step === 0 || step === 1) {
        ticks.push({ t, label: at.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }) })
      }
    }
  }
  return ticks
}

interface TlPlan {
  key: string
  start: number
  end: number
  ongoing: boolean
  stopped: boolean
  statements: { key: string; start: number; end: number; ongoing: boolean }[]
  issues: { key: string; t: number; early: boolean }[]
}

function TimelineView({ graph, width, i, uid }: { graph: RelationshipGraph; width: number; i: Interaction; uid: string }) {
  const res = (k: string) => graph.resources.get(k) as Loose | undefined
  const [zoom, setZoom] = useState(1)

  const { plans, from, to, orphans } = useMemo(() => {
    const out: TlPlan[] = []
    const orphanStatements: TlPlan['statements'] = []
    let lo = Infinity, hi = -Infinity
    const seen = (t: number | undefined) => { if (t !== undefined) { lo = Math.min(lo, t); hi = Math.max(hi, t) } }
    for (const t of graph.tree.children) {
      const r = res(t.key)
      if (!r) continue
      if (r.resourceType === 'MedicationStatement') {
        const s = parseTime(r.effectivePeriod?.start) ?? parseTime(r.dateAsserted)
        if (s === undefined) continue
        const e = parseTime(r.effectivePeriod?.end)
        seen(s); seen(e)
        orphanStatements.push({ key: t.key, start: s, end: e ?? s, ongoing: e === undefined })
        continue
      }
      const start = parseTime(r.authoredOn) ?? parseTime(r.dispenseRequest?.validityPeriod?.start)
      if (start === undefined) continue
      const issues = t.children
        .filter(c => res(c.key)?.resourceType === 'MedicationRequest')
        .map(c => ({ key: c.key, t: parseTime(res(c.key)?.authoredOn) }))
        .filter((x): x is { key: string; t: number } => x.t !== undefined)
        .map(x => ({ ...x, early: x.t < start }))
      const statements: TlPlan['statements'] = []
      for (const c of t.children) {
        const sr = res(c.key)
        if (sr?.resourceType !== 'MedicationStatement') continue
        const s = parseTime(sr.effectivePeriod?.start) ?? start
        const e = parseTime(sr.effectivePeriod?.end)
        statements.push({ key: c.key, start: s, end: e ?? s, ongoing: e === undefined })
        seen(s); seen(e)
      }
      const validEnd = parseTime(r.dispenseRequest?.validityPeriod?.end)
      const lastIssue = issues.reduce((m, x) => Math.max(m, x.t), start)
      seen(start); seen(validEnd); issues.forEach(x => seen(x.t))
      out.push({
        key: t.key, start, issues, statements,
        end: validEnd ?? lastIssue,
        ongoing: validEnd === undefined && r.status === 'active',
        stopped: r.status === 'stopped' || r.status === 'cancelled',
      })
    }
    out.sort((a, b) => a.start - b.start)
    if (!Number.isFinite(lo)) { lo = 0; hi = 365 * DAY }
    // Ongoing bars and open statements run to the end of the drawn range.
    for (const p of out) {
      for (const s of p.statements) if (s.ongoing) s.end = hi
      if (p.ongoing) p.end = Math.max(p.end, hi)
    }
    for (const s of orphanStatements) if (s.ongoing) s.end = hi
    const pad = Math.max((hi - lo) * 0.03, 15 * DAY)
    return { plans: out, orphans: orphanStatements, from: lo - pad, to: hi + pad }
  }, [graph]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!plans.length && !orphans.length) {
    return <p className="p-5 text-sm text-muted">None of these resources carry a date, so there is nothing to place on a timeline.</p>
  }
  // Labels stay put in their own column; the dated plot scrolls sideways when zoomed.
  const PW = Math.max(width - TL_LABEL_W, 480) * zoom
  const x0 = 14, x1 = PW - 28
  const x = (t: number) => x0 + ((t - from) / (to - from)) * (x1 - x0)
  const top = 44
  const rowCount = plans.length + orphans.length
  const H = top + rowCount * TL_ROW_H + 20
  const rowY = (n: number) => top + n * TL_ROW_H + 26
  const ticks = timeTicks(from, to, x1 - x0)
  const rowOf = new Map(plans.map((p, n) => [p.key, n]))
  const chains = graph.edges.filter(e => e.path.endsWith('.priorPrescription') && rowOf.has(e.from) && rowOf.has(e.to))
  const fmt = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const cls = (key: string, extra = '') => `viz-node ${nodeClass(i, key, graph.focus, extra)}`
  const stripes = Array.from({ length: rowCount }, (_, n) => n).filter(n => n % 2 === 0)
  const dim = i.active ? 'is-dim' : ''

  const label = (key: string, n: number, sub: string) => {
    const node = graph.nodes.get(key)!
    const y = rowY(n)
    return (
      <g key={key} className={cls(key)} {...i.bind(key, `${node.type}: ${node.label}`)}>
        <text className="viz-tl-label" x={16} y={y - 4}>{nodeBox(node.label, node.type, TL_LABEL_W - 8).label}</text>
        <text className="viz-tl-sub" x={16} y={y + 12}>{fitText(sub, TYPE_FONT, TL_LABEL_W - 20)}</text>
      </g>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-2 pb-2 text-xs text-muted">
        <span>Zoom:</span>
        {[1, 2, 4, 8].map(z => (
          <button
            key={z}
            type="button"
            aria-pressed={zoom === z}
            onClick={() => setZoom(z)}
            className={`px-2 py-0.5 rounded border ${zoom === z ? 'border-accent text-accent' : 'border-line hover:border-accent'}`}
          >
            {z === 1 ? 'Fit' : `×${z}`}
          </button>
        ))}
        {zoom > 1 && <span>Scroll sideways to move along the years.</span>}
      </div>
      <div className="flex">
        <svg className={`block shrink-0 viz-tl ${dim}`} width={TL_LABEL_W} height={H} role="group" aria-label="Timeline rows">
          {stripes.map(n => <rect key={n} className="viz-lane-bg" x={4} y={rowY(n) - 30} width={TL_LABEL_W - 4} height={TL_ROW_H - 4} rx={8} />)}
          {plans.map((p, n) => label(p.key, n, [graph.nodes.get(p.key)!.sub, plural(p.issues.length, 'issue')].filter(Boolean).join(' · ')))}
          {orphans.map((o, n) => label(o.key, plans.length + n, 'No authorisation'))}
        </svg>
        <div className="overflow-x-auto min-w-0 flex-1">
          <svg className={`block viz-tl ${dim}`} width={PW} height={H} viewBox={`0 0 ${PW} ${H}`} role="group" aria-label="Timeline">
            <defs>
              <marker id={`${uid}-tl-chain`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
                <path d="M0,1 L9,5 L0,9 z" style={{ fill: 'var(--viz-chain)' }} />
              </marker>
            </defs>
            {stripes.map(n => <rect key={n} className="viz-lane-bg" x={0} y={rowY(n) - 30} width={PW - 4} height={TL_ROW_H - 4} rx={8} />)}
            {ticks.map(tk => (
              <g key={tk.t}>
                <line className="viz-tl-grid" x1={x(tk.t)} x2={x(tk.t)} y1={top - 8} y2={H - 12} />
                <text className="viz-tl-tick" x={x(tk.t)} y={top - 16} textAnchor="middle">{tk.label}</text>
              </g>
            ))}

            {plans.map((p, n) => {
              const y = rowY(n)
              const node = graph.nodes.get(p.key)!
              const left = x(p.start), right = Math.max(x(p.end), left + 3)
              return (
                <g key={p.key}>
                  <g className={cls(p.key)} {...i.bind(p.key, `${node.type}: ${node.label}`)}>
                    <rect className={`viz-tl-bar ${p.stopped ? 'stopped' : ''}`} x={left} y={y - 9} width={right - left} height={14} rx={4} />
                    {p.ongoing && <path className="viz-tl-ongoing" d={`M${right + 2},${y - 9} l9,7 l-9,7 z`} />}
                    <title>{`${node.label}\n${fmt(p.start)} – ${p.ongoing ? 'ongoing' : fmt(p.end)}${p.stopped ? ' (stopped)' : ''}`}</title>
                  </g>
                  {p.statements.map(st => {
                    const sn = graph.nodes.get(st.key)!
                    return (
                      <g key={st.key} className={cls(st.key)} {...i.bind(st.key, `${sn.type}: ${sn.label}`)}>
                        <rect className="viz-tl-stmt" x={x(st.start)} y={y + 10} width={Math.max(x(st.end) - x(st.start), 3)} height={5} rx={2.5} />
                        <title>{`${sn.label}\n${fmt(st.start)} – ${st.ongoing ? 'ongoing' : fmt(st.end)}`}</title>
                      </g>
                    )
                  })}
                  {p.issues.map(iss => {
                    const inode = graph.nodes.get(iss.key)!
                    return (
                      <g key={iss.key} className={cls(iss.key, iss.early ? 'early' : '')} {...i.bind(iss.key, `${inode.type}: ${inode.label}`)}>
                        <circle className="viz-tl-issue" cx={x(iss.t)} cy={y - 2} r={4.5} />
                        <title>{`${inode.label}${iss.early ? '\nTimestamped before its own authorisation' : ''}`}</title>
                      </g>
                    )
                  })}
                </g>
              )
            })}
            {orphans.map((st, n) => {
              const y = rowY(plans.length + n)
              const sn = graph.nodes.get(st.key)!
              return (
                <g key={st.key} className={cls(st.key)} {...i.bind(st.key, `${sn.type}: ${sn.label}`)}>
                  <rect className="viz-tl-stmt" x={x(st.start)} y={y - 3} width={Math.max(x(st.end) - x(st.start), 3)} height={6} rx={3} />
                  <title>{`${sn.label}\n${fmt(st.start)} – ${st.ongoing ? 'ongoing' : fmt(st.end)}`}</title>
                </g>
              )
            })}

            {/* Reauthorisations: newer authorisation → the one it replaced */}
            {chains.map(e => {
              const a = plans[rowOf.get(e.from)!], b = plans[rowOf.get(e.to)!]
              const ya = rowY(rowOf.get(e.from)!) - 9, yb = rowY(rowOf.get(e.to)!) + 5
              const xa = x(a.start), xb = Math.min(x(b.end), xa - 2)
              const hot = i.active && (e.from === i.active || e.to === i.active)
              return (
                <path
                  key={`${e.from}|${e.to}`}
                  className={`viz-edge chain ${hot ? 'hot' : ''}`}
                  d={`M${xa},${ya} C${xa},${ya - 18} ${xb},${yb + 22} ${xb},${yb + 2}`}
                  markerEnd={`url(#${uid}-tl-chain)`}
                />
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}

// ── Story ────────────────────────────────────────────────────────────────

function StoryPanel({ graph, onHover }: { graph: RelationshipGraph; onHover: (key: string | null) => void }) {
  return (
    <div className="space-y-3 text-[15px] leading-7 text-ink-2 max-w-[78ch]">
      {graph.story.map((para, n) => (
        <p key={n}>
          {para.map((seg, m) => {
            if (typeof seg === 'string') return <span key={m}>{seg}</span>
            if ('path' in seg) {
              return <code key={m} className="font-mono text-[11.5px] text-accent bg-accent-soft px-1.5 py-px rounded whitespace-nowrap">{seg.path}</code>
            }
            const node = graph.nodes.get(seg.node)
            if (!node) return null
            return (
              <span
                key={m}
                className="inline-flex items-center gap-1.5 px-2 rounded-full bg-raised border border-line text-ink font-medium text-sm leading-relaxed whitespace-nowrap cursor-default"
                title={`${node.type}${node.sub ? ` · ${node.sub}` : ''}`}
                onMouseEnter={() => onHover(node.key)}
                onMouseLeave={() => onHover(null)}
              >
                <i className="viz-dot" style={{ background: `var(--viz-${node.kind})` }} />
                {node.label}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}

// ── FHIR source preview ──────────────────────────────────────────────────

const PREVIEW_LINES = 400
const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

/** JSON with the same token colours as the Inspector's editor. */
function highlightJson(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(JSON_TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const color = m[1] ? (m[2] ? 'var(--json-key)' : 'var(--json-str)') : m[3] ? 'var(--json-bool)' : 'var(--json-num)'
    out.push(<span key={m.index} style={{ color }}>{m[1] ?? m[0]}</span>)
    if (m[2]) out.push(m[2])
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** "Show FHIR source" that previews the resource's JSON while hovered or
 * focused; clicking still goes to the Inspector. */
function SourceButton({ resource, onClick }: { resource?: object; onClick: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const previewId = useId()

  const text = useMemo(() => {
    if (!resource) return undefined
    const lines = JSON.stringify(resource, null, 2).split('\n')
    return {
      body: lines.slice(0, PREVIEW_LINES).join('\n'),
      more: Math.max(0, lines.length - PREVIEW_LINES),
    }
  }, [resource])
  const highlighted = useMemo(() => (pos && text ? highlightJson(text.body) : null), [pos, text])

  const show = () => {
    window.clearTimeout(timer.current)
    if (pos || !text) return
    timer.current = window.setTimeout(() => {
      const b = btnRef.current?.getBoundingClientRect()
      if (!b) return
      const vw = window.innerWidth, vh = window.innerHeight
      const width = Math.min(560, vw - 16)
      // Beside the details panel when there's room, otherwise above or below the button.
      if (b.left - width - 12 >= 8) {
        const maxH = Math.min(vh - 16, 640)
        setPos({ left: b.left - width - 12, top: Math.max(8, Math.min(b.top - 40, vh - maxH - 8)), width, maxH })
      } else {
        const below = vh - b.bottom > b.top
        const maxH = Math.min(below ? vh - b.bottom - 16 : b.top - 16, 520)
        setPos({ left: Math.max(8, Math.min(b.left, vw - width - 8)), top: below ? b.bottom + 8 : b.top - 8 - maxH, width, maxH })
      }
    }, 250)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPos(null), 180)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="px-2 py-1 text-xs rounded border border-line hover:border-accent text-accent"
        onClick={onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={pos ? previewId : undefined}
      >
        Show FHIR source
      </button>
      {pos && text && createPortal(
        <div
          id={previewId}
          role="tooltip"
          className="gpc-viz fixed z-[60] flex flex-col rounded-lg border border-line-strong bg-surface shadow-xl overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="px-3 py-1.5 border-b border-line text-xs text-muted flex justify-between gap-3">
            <span>FHIR source preview</span>
            <span>Click the button to open it in the Inspector</span>
          </div>
          <pre className="flex-1 min-h-0 overflow-auto px-3 py-2 font-mono text-[11.5px] leading-[1.5] text-ink whitespace-pre" style={{ color: 'var(--json-punct)' }}>
            {highlighted}
            {text.more > 0 && `\n… ${text.more} more lines`}
          </pre>
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Details for the active resource ──────────────────────────────────────

function Details({ graph, record, keyId, pinned, orbitCentre, onCentre, onJumpToSource, onJumpToRecord, onClose }: {
  graph: RelationshipGraph
  record: GpConnectBundle
  keyId: string | null
  pinned: boolean
  orbitCentre: string | null
  onCentre?: (key: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
  onClose: () => void
}) {
  if (!keyId) {
    return (
      <p className="text-sm text-muted">
        Hover over or tab to a resource to see how it connects. Click it to keep it selected and get links to the record and the FHIR source.
      </p>
    )
  }
  if (keyId.startsWith('cluster:')) {
    const type = keyId.split(':')[2]
    const members = [...graph.nodes.values()].filter(n => n.type === type)
    return (
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-ink">{type} resources, grouped</p>
        <p className="text-muted text-xs">Orbit groups a ring by type when it has more than {ORBIT_RING_MAX} resources. Pick one to put it in the centre.</p>
        <ul className="space-y-1">
          {members.slice(0, 40).map(m => (
            <li key={m.key}>
              <button type="button" className="text-left text-accent hover:underline text-xs" onClick={() => onCentre?.(m.key)}>{m.label}</button>
              {m.sub && <span className="text-muted text-xs"> · {m.sub}</span>}
            </li>
          ))}
          {members.length > 40 && <li className="text-xs text-muted">and {members.length - 40} more</li>}
        </ul>
      </div>
    )
  }
  const node = graph.nodes.get(keyId)
  if (!node) return null
  const outgoing = graph.edges.filter(e => e.from === keyId)
  const incoming = graph.edges.filter(e => e.to === keyId)
  const target = node.id ? findRecordLocation({ sourceType: node.type, sourceId: node.id }, record) : undefined
  const rel = (e: GraphEdge, dir: 'out' | 'in') => {
    const other = graph.nodes.get(dir === 'out' ? e.to : e.from)
    return (
      <li key={`${dir}-${e.from}-${e.to}-${e.path}`} className="text-xs">
        <span className="text-ink">{dir === 'out' ? '→' : '←'} {other?.label}</span>
        <span className="block font-mono text-[10.5px] text-muted break-all">{e.path}</span>
      </li>
    )
  }
  const LIMIT = 12
  return (
    <div className="space-y-3 text-sm">
      <div>
        <TypeLine node={node} />
        <p className="font-semibold text-ink break-words">{node.label}</p>
        {node.sub && <p className="text-xs text-muted">{node.sub}</p>}
      </div>
      {pinned ? (
        <div className="flex flex-wrap gap-2">
          {target && onJumpToRecord && (
            <button type="button" className="px-2 py-1 text-xs rounded border border-line hover:border-accent text-accent" onClick={() => { onClose(); onJumpToRecord(target.domain, target.id) }}>
              View in record
            </button>
          )}
          {node.id && onJumpToSource && (
            <SourceButton resource={graph.resources.get(keyId)} onClick={() => { onClose(); onJumpToSource(node.id!) }} />
          )}
          {onCentre && orbitCentre !== keyId && (
            <button type="button" className="px-2 py-1 text-xs rounded border border-line hover:border-accent text-accent" onClick={() => onCentre(keyId)}>
              Centre Orbit here
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">Click to select it and get links to the record and the FHIR source.</p>
      )}
      {outgoing.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted mb-1">Points to ({outgoing.length})</h4>
          <ul className="space-y-1">{outgoing.slice(0, LIMIT).map(e => rel(e, 'out'))}</ul>
          {outgoing.length > LIMIT && <p className="text-xs text-muted mt-1">and {outgoing.length - LIMIT} more</p>}
        </div>
      )}
      {incoming.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted mb-1">Pointed to by ({incoming.length})</h4>
          <ul className="space-y-1">{incoming.slice(0, LIMIT).map(e => rel(e, 'in'))}</ul>
          {incoming.length > LIMIT && <p className="text-xs text-muted mt-1">and {incoming.length - LIMIT} more</p>}
        </div>
      )}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────

interface Props {
  graph: RelationshipGraph
  record: GpConnectBundle
  onClose: () => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

/** Pop-up picture of everything connected to one consultation or
 * medication: what it contains, what it points to, and what points back. */
export function RelationshipVisualiser({ graph, record, onClose, onJumpToSource, onJumpToRecord }: Props) {
  const uid = `viz${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  // Medications open on Wiring, where the authorisation chain reads left to
  // right; everything else on Nested, which is shaped like the record.
  const [mode, setMode] = useState<Mode>(graph.domain === 'medication' ? 'wiring' : 'nested')
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [hiddenKinds, setHiddenKinds] = useState<Set<EdgeKind>>(() => new Set())
  const [orbitCentre, setOrbitCentre] = useState<string | null>(null)
  const [orbitShowAll, setOrbitShowAll] = useState(false)
  const [storyOpen, setStoryOpen] = useState(true)
  const closeRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [paneWidth, setPaneWidth] = useState(1100)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPaneWidth(el.clientWidth - 24))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })


  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    // Capture phase: the dialog stops key events bubbling (so Enter on a node
    // doesn't reach the row behind it), which would otherwise swallow Escape.
    document.addEventListener('keydown', onKey, true)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [])

  // Collapsed boxes hide their later children in every view, and resources
  // linked only to hidden ones go with them.
  const { visible, hiddenUnder, hiddenCount } = useMemo(() => {
    const hidden = new Set<string>()
    const under = new Map<string, number>()
    const hideAll = (t: TreeNode) => { hidden.add(t.key); t.children.forEach(hideAll) }
    const walk = (t: TreeNode) => {
      if (t.children.length > COLLAPSE_AT && !expanded.has(t.key)) {
        t.children.slice(COLLAPSED_SHOW).forEach(hideAll)
        under.set(t.key, t.children.length - COLLAPSED_SHOW)
        t.children.slice(0, COLLAPSED_SHOW).forEach(walk)
      } else t.children.forEach(walk)
    }
    walk(graph.tree)
    const vis = new Set<string>()
    for (const n of graph.nodes.values()) if (n.role === 'core' && !hidden.has(n.key)) vis.add(n.key)
    const linkedTo = (key: string, pool: Set<string>) =>
      graph.edges.some(e => (e.from === key && pool.has(e.to)) || (e.to === key && pool.has(e.from)))
    for (const n of graph.nodes.values()) if (n.role !== 'core' && n.role !== 'far' && linkedTo(n.key, vis)) vis.add(n.key)
    const near = new Set(vis)
    for (const n of graph.nodes.values()) if (n.role === 'far' && linkedTo(n.key, near)) vis.add(n.key)
    return { visible: vis, hiddenUnder: under, hiddenCount: graph.nodes.size - vis.size }
  }, [graph, expanded])

  const centre = orbitCentre && visible.has(orbitCentre) ? orbitCentre : graph.focus
  const anchor = mode === 'orbit' ? centre : graph.focus
  const active = hover ?? pinned

  // Nearly everything points to the patient, so those lines are drawn only
  // for the resource the view is about and the one being looked at.
  // `layoutEdges` never depends on hover, so Orbit doesn't move as you point.
  const layoutEdges = useMemo(
    () => graph.edges.filter(e => visible.has(e.from) && visible.has(e.to) && !hiddenKinds.has(e.kind)
      && (e.kind !== 'patient' || e.from === anchor || e.to === anchor)),
    [graph, visible, hiddenKinds, anchor],
  )
  const edges = useMemo(() => {
    if (!active || hiddenKinds.has('patient')) return layoutEdges
    const extra = graph.edges.filter(e => e.kind === 'patient' && e.from !== anchor && e.to !== anchor
      && (e.from === active || e.to === active) && visible.has(e.from) && visible.has(e.to))
    return extra.length ? [...layoutEdges, ...extra] : layoutEdges
  }, [layoutEdges, active, anchor, graph, visible, hiddenKinds])

  const hot = useMemo(() => {
    const s = new Set<string>()
    if (!active) return s
    s.add(active)
    // Timeline draws every authorisation and issue, collapsed or not.
    const lines = mode === 'timeline' ? graph.edges.filter(e => e.kind !== 'patient') : edges
    for (const e of lines) {
      if (e.from === active) s.add(e.to)
      if (e.to === active) s.add(e.from)
    }
    // A grouped Orbit node is hot when any member is.
    if (mode === 'orbit') {
      for (const k of [...s]) {
        const n = graph.nodes.get(k)
        if (n) for (const ring of ['1', '2']) s.add(`cluster:${ring}:${n.type}`)
      }
    }
    return s
  }, [active, edges, mode, graph])

  const togglePin = useCallback((key: string) => setPinned(p => (p === key ? null : key)), [])
  const interaction: Interaction = {
    active,
    pinned,
    hot,
    bind: (key, label) => ({
      'data-key': key,
      tabIndex: 0,
      role: 'button',
      'aria-label': label,
      'aria-pressed': pinned === key,
      onMouseOver: e => { e.stopPropagation(); setHover(key) },
      onFocus: e => { e.stopPropagation(); setHover(key) },
      onBlur: () => setHover(null),
      onClick: e => { e.stopPropagation(); togglePin(key) },
      onKeyDown: e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); togglePin(key) }
      },
    }),
  }

  const tooManyForOrbit = visible.size > ORBIT_SHOW_ALL_MAX
  const orbitGrouped = !orbitShowAll || tooManyForOrbit
  const toggleExpand = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const expandAll = () => setExpanded(new Set(graph.nodes.keys()).add(graph.tree.key))

  // Portalled to <body> so it isn't clipped by a table cell, and stops
  // events here so clicks don't also toggle the row it was opened from.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1.5 sm:p-3 xl:p-5"
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="gpc-viz bg-surface text-ink rounded-lg shadow-xl w-full max-w-[2400px] h-full flex flex-col overflow-hidden border border-line"
      >
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 sm:px-5 py-3 border-b border-line">
          <div className="min-w-[14rem] flex-1">
            <h2 id={`${uid}-title`} className="text-base font-semibold text-ink truncate">
              {DOMAIN_TITLE[graph.domain]}: {graph.title}
            </h2>
            <p className="text-xs text-muted">
              {[graph.subtitle, `${graph.nodes.size} resources`, `${graph.edges.length} references`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="inline-flex rounded-md border border-line-strong overflow-hidden" role="group" aria-label="View">
            {modesFor(graph.domain).map(m => (
              <button
                key={m.mode}
                type="button"
                title={m.hint}
                aria-pressed={mode === m.mode}
                onClick={() => setMode(m.mode)}
                className={`px-3 py-1.5 text-sm font-medium border-l first:border-l-0 border-line-strong ${
                  mode === m.mode ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-raised'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="px-2.5 py-1.5 text-sm rounded border border-line hover:border-accent text-ink-2" aria-label="Close">
            Close
          </button>
        </header>

        {mode === 'timeline' ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-5 py-2 border-b border-line text-xs text-muted gpc-viz">
            <span className="font-medium">Key:</span>
            <span className="inline-flex items-center gap-1.5"><svg width="26" height="10" aria-hidden><rect className="viz-tl-bar" x="0" y="1" width="26" height="8" rx="3" /></svg>Authorisation, from authored date to end of validity</span>
            <span className="inline-flex items-center gap-1.5"><svg width="26" height="6" aria-hidden><rect className="viz-tl-stmt" x="0" y="0.5" width="26" height="5" rx="2.5" /></svg>Statement's effective period</span>
            <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden><circle className="viz-tl-issue" cx="6" cy="6" r="4.5" /></svg>Issue</span>
            <span className="inline-flex items-center gap-1.5 viz-node early"><svg width="12" height="12" aria-hidden><circle className="viz-tl-issue" cx="6" cy="6" r="4.5" /></svg>Issue timestamped before its authorisation</span>
            <span className="inline-flex items-center gap-1.5"><svg width="26" height="8" aria-hidden><line x1="0" y1="4" x2="26" y2="4" className="viz-edge chain" /></svg>Replaced (priorPrescription)</span>
            <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden><path className="viz-tl-ongoing" d="M1,1 l9,5 l-9,5 z" /></svg>Still active</span>
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-2 border-b border-line text-xs text-muted">
          <span className="font-medium">Lines:</span>
          {KINDS.map(({ kind, label }) => {
            const off = hiddenKinds.has(kind)
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={!off}
                title={off ? 'Show these lines' : 'Hide these lines'}
                onClick={() => setHiddenKinds(prev => {
                  const next = new Set(prev)
                  if (next.has(kind)) next.delete(kind)
                  else next.add(kind)
                  return next
                })}
                className={`inline-flex items-center gap-1.5 hover:text-ink ${off ? 'opacity-40 line-through' : ''}`}
              >
                <svg width="26" height="8" aria-hidden><line x1="0" y1="4" x2="26" y2="4" className={`viz-edge ${kind}`} /></svg>
                {label}
              </button>
            )
          })}
          {hiddenCount > 0 && (
            <span className="ml-auto">
              {hiddenCount} {hiddenCount === 1 ? 'resource is' : 'resources are'} hidden in collapsed boxes.{' '}
              <button type="button" className="text-accent hover:underline" onClick={expandAll}>Show all</button>
            </span>
          )}
        </div>
        )}

        <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_clamp(17rem,22vw,27rem)]">
          <div ref={scrollRef} className="min-h-0 overflow-auto" onMouseOver={() => setHover(null)}>
            {mode === 'orbit' && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-3 text-xs text-muted">
                <span>
                  Centred on <b className="text-ink font-medium">{graph.nodes.get(centre)?.label}</b>. Inner ring: direct links. Outer ring: everything else here.
                </span>
                {centre !== graph.focus && (
                  <button type="button" className="text-accent hover:underline" onClick={() => setOrbitCentre(null)}>Back to the start</button>
                )}
                {tooManyForOrbit ? (
                  <span>Rings with more than {ORBIT_RING_MAX} resources are grouped by type; with {visible.size} resources showing, Orbit can't draw them one by one. Collapse boxes or hide line types to reduce it.</span>
                ) : (
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={!orbitGrouped} onChange={e => setOrbitShowAll(e.target.checked)} />
                    Show every resource (no grouping)
                  </label>
                )}
              </div>
            )}
            {mode === 'nested' && (
              <NestedView graph={graph} visible={visible} edges={edges} hiddenUnder={hiddenUnder} expanded={expanded} onToggleExpand={toggleExpand} i={interaction} uid={uid} />
            )}
            {mode === 'wiring' && (
              <div className="p-3"><WiringView graph={graph} visible={visible} edges={edges} width={paneWidth} i={interaction} uid={uid} /></div>
            )}
            {mode === 'timeline' && (
              <div className="p-3"><TimelineView graph={graph} width={paneWidth} i={interaction} uid={uid} /></div>
            )}
            {mode === 'orbit' && (
              <div className="p-3"><OrbitView graph={graph} visible={visible} edges={edges} layoutEdges={layoutEdges} centre={centre} showAll={!orbitGrouped} width={paneWidth} i={interaction} uid={uid} /></div>
            )}

            <section className="border-t border-line px-5 py-4" onMouseOver={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setStoryOpen(o => !o)}
                aria-expanded={storyOpen}
                className="flex items-center gap-2 text-sm font-semibold text-ink mb-3"
              >
                <svg className={`w-3 h-3 transition-transform ${storyOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Explain in words
              </button>
              {storyOpen && <StoryPanel graph={graph} onHover={setHover} />}
            </section>
          </div>

          <aside className="min-h-0 max-h-[40vh] lg:max-h-none overflow-auto border-t lg:border-t-0 lg:border-l border-line p-4 bg-raised/40" aria-live="polite">
            <Details
              graph={graph}
              record={record}
              keyId={active}
              pinned={!!pinned && active === pinned}
              orbitCentre={mode === 'orbit' ? centre : null}
              onCentre={mode === 'orbit' ? k => { setOrbitCentre(k); setPinned(k) } : undefined}
              onJumpToSource={onJumpToSource}
              onJumpToRecord={onJumpToRecord}
              onClose={onClose}
            />
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  )
}
