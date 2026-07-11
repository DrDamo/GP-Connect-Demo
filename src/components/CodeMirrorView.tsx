import { useEffect, useRef, useImperativeHandle, forwardRef, memo } from 'react'
import { EditorView, Decoration, lineNumbers, ViewPlugin } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { EditorState, StateEffect, StateField, RangeSetBuilder, Compartment } from '@codemirror/state'
import type { Text } from '@codemirror/state'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { json as jsonLang } from '@codemirror/lang-json'
import { xml as xmlLang } from '@codemirror/lang-xml'
import { editorTheme } from './codeMirrorTheme'

export interface CodeMirrorViewHandle {
  scrollToLine(line: number): void
}

interface Props {
  source: string
  language: 'json' | 'xml'
  highlightedLines: Set<number>
  searchMatchLines: number[]
  currentSearchMatch: number // 1-based line number, or -1 if none
  indentGuides?: boolean
}

interface HighlightSpec {
  highlighted: Set<number>
  searchMatches: Set<number>
  currentMatch: number
}

const setHighlightsEffect = StateEffect.define<HighlightSpec>()

const INDENT_SIZE = 2

function buildIndentDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos)
      const text = line.text
      let spaces = 0
      while (spaces < text.length && text[spaces] === ' ') spaces++
      let level = 0
      for (let i = 0; i < spaces; i += INDENT_SIZE) {
        const end = Math.min(i + INDENT_SIZE, spaces)
        builder.add(
          line.from + i,
          line.from + end,
          Decoration.mark({ class: `cm-indent-level-${level % 5}` })
        )
        level++
      }
      if (line.to >= to) break
      pos = line.to + 1
    }
  }
  return builder.finish()
}

const indentGuidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildIndentDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildIndentDecorations(update.view)
      }
    }
  },
  { decorations: (v: { decorations: DecorationSet }) => v.decorations }
)

function buildDecorations(doc: Text, spec: HighlightSpec): DecorationSet {
  const { highlighted, searchMatches, currentMatch } = spec
  const builder = new RangeSetBuilder<Decoration>()

  // Collect all line numbers that need a background, sorted ascending.
  const allNums = new Set<number>()
  highlighted.forEach(n => allNums.add(n))
  searchMatches.forEach(n => allNums.add(n))
  if (currentMatch > 0) allNums.add(currentMatch)

  for (const lineNum of [...allNums].sort((a, b) => a - b)) {
    if (lineNum < 1 || lineNum > doc.lines) continue
    const isCurrent = lineNum === currentMatch
    const isSearch = searchMatches.has(lineNum)
    const bg = isCurrent ? 'var(--cm-current-match)' : isSearch ? 'var(--cm-search-match)' : 'var(--cm-highlight)'
    const line = doc.line(lineNum)
    builder.add(line.from, line.from, Decoration.line({ attributes: { style: `background-color:${bg}` } }))
  }
  return builder.finish()
}

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightsEffect)) return buildDecorations(tr.state.doc, effect.value)
    }
    return tr.docChanged ? deco.map(tr.changes) : deco
  },
  provide: f => EditorView.decorations.from(f),
})

export const CodeMirrorView = memo(forwardRef<CodeMirrorViewHandle, Props>(function CodeMirrorView(
  { source, language, highlightedLines, searchMatchLines, currentSearchMatch, indentGuides },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langCompartmentRef = useRef<Compartment | null>(null)
  const indentCompartmentRef = useRef<Compartment | null>(null)
  const skipFirstSourceRef = useRef(true)

  // Create editor on mount.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const compartment = new Compartment()
    langCompartmentRef.current = compartment
    const langExt = language === 'xml' ? xmlLang() : jsonLang()

    const indentCompartment = new Compartment()
    indentCompartmentRef.current = indentCompartment

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        syntaxHighlighting(defaultHighlightStyle),
        compartment.of(langExt),
        EditorView.editable.of(false),
        highlightField,
        indentCompartment.of([]),
        editorTheme,
      ],
    })

    const view = new EditorView({ state, parent: container })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
      langCompartmentRef.current = null
      indentCompartmentRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Replace document when source changes (skip the initial mount run).
  useEffect(() => {
    if (skipFirstSourceRef.current) { skipFirstSourceRef.current = false; return }
    const view = viewRef.current
    if (!view) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } })
  }, [source])

  // Reconfigure language extension.
  useEffect(() => {
    const view = viewRef.current
    const compartment = langCompartmentRef.current
    if (!view || !compartment) return
    const langExt = language === 'xml' ? xmlLang() : jsonLang()
    view.dispatch({ effects: compartment.reconfigure(langExt) })
  }, [language])

  // Toggle indent guide plugin.
  useEffect(() => {
    const view = viewRef.current
    const comp = indentCompartmentRef.current
    if (!view || !comp) return
    view.dispatch({ effects: comp.reconfigure(indentGuides ? indentGuidePlugin : []) })
  }, [indentGuides])

  // Push highlight decorations.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: setHighlightsEffect.of({
        highlighted: highlightedLines,
        searchMatches: new Set(searchMatchLines),
        currentMatch: currentSearchMatch,
      }),
    })
  }, [highlightedLines, searchMatchLines, currentSearchMatch])

  useImperativeHandle(ref, () => ({
    scrollToLine(line: number) {
      const view = viewRef.current
      if (!view) return
      try {
        const lineInfo = view.state.doc.line(line)
        view.dispatch({
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'start', yMargin: 40 }),
        })
      } catch {
        // line out of range — ignore
      }
    },
  }), [])

  return <div ref={containerRef} style={{ height: '100%' }} />
}))
