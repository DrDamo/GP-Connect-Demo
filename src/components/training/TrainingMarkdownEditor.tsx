import { useEffect, useRef } from 'react'
import { EditorView, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'

// Self-contained theme (not layered on top of the shared read-only
// codeMirrorTheme) so there's a single source of truth for caret color —
// two separate EditorView.theme() extensions both targeting .cm-content
// raced each other and the caret never won in either light or dark mode.
const trainingEditorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--cm-editor-bg)', color: 'var(--cm-editor-fg)' },
  '.cm-scroller': {
    overflow: 'auto',
    height: '100%',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.75rem',
    lineHeight: '1.5',
  },
  '.cm-content': { padding: '0', caretColor: 'var(--cm-editor-caret)' },
  '.cm-line': { padding: '0 12px 0 4px' },
  '.cm-gutters': {
    backgroundColor: 'var(--cm-editor-gutter-bg)',
    borderRight: '1px solid var(--cm-editor-gutter-bg)',
    color: 'var(--cm-editor-gutter-fg)',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '2.5rem',
    paddingLeft: '4px',
    paddingRight: '8px',
    fontSize: '0.75rem',
    textAlign: 'right',
  },
  '.cm-focused': { outline: 'none' },
  '.cm-selectionBackground': { backgroundColor: '#b3d4fc !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#b3d4fc !important' },
  '.cm-cursor': { borderLeftColor: 'var(--cm-editor-caret)', borderLeftWidth: '2px' },
})

// Wraps the current selection with `before`/`after` (or inserts a placeholder
// between them if nothing is selected), then selects the inserted text so
// the user can type straight over it.
function wrapSelection(view: EditorView, before: string, after: string, placeholder: string) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const text = selected || placeholder
  view.dispatch({
    changes: { from, to, insert: `${before}${text}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + text.length },
  })
  view.focus()
}

// Prefixes every line touched by the current selection with `prefix`.
function prefixLines(view: EditorView, prefix: string) {
  const { from, to } = view.state.selection.main
  const startLine = view.state.doc.lineAt(from)
  const endLine = view.state.doc.lineAt(to)
  const changes = []
  for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo++) {
    changes.push({ from: view.state.doc.line(lineNo).from, insert: prefix })
  }
  view.dispatch({ changes })
  view.focus()
}

// Inserts a block of text at the cursor (replacing any selection), placing
// the cursor at the end of the inserted text.
function insertSnippet(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

const TABLE_SNIPPET = '\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n'

interface ToolbarButton {
  label: string
  title: string
  action: (view: EditorView) => void
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { label: 'B', title: 'Bold', action: v => wrapSelection(v, '**', '**', 'bold text') },
  { label: 'I', title: 'Italic', action: v => wrapSelection(v, '_', '_', 'italic text') },
  { label: 'H1', title: 'Heading 1', action: v => prefixLines(v, '# ') },
  { label: 'H2', title: 'Heading 2', action: v => prefixLines(v, '## ') },
  { label: 'H3', title: 'Heading 3', action: v => prefixLines(v, '### ') },
  { label: 'Link', title: 'Link', action: v => wrapSelection(v, '[', '](https://)', 'link text') },
  { label: '•', title: 'Bulleted list', action: v => prefixLines(v, '- ') },
  { label: '1.', title: 'Numbered list', action: v => prefixLines(v, '1. ') },
  { label: '"', title: 'Quote', action: v => prefixLines(v, '> ') },
  { label: 'Code', title: 'Inline code', action: v => wrapSelection(v, '`', '`', 'code') },
  { label: 'Code block', title: 'Code block', action: v => wrapSelection(v, '```\n', '\n```', 'code') },
  { label: 'Table', title: 'Table', action: v => insertSnippet(v, TABLE_SNIPPET) },
]

interface Props {
  source: string
  onChange: (value: string) => void
}

export function TrainingMarkdownEditor({ source, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Create editor on mount.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        syntaxHighlighting(defaultHighlightStyle),
        markdown(),
        EditorView.editable.of(true),
        trainingEditorTheme,
        EditorView.updateListener.of(update => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })

    const view = new EditorView({ state, parent: container })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap gap-1 border-b border-nhs-grey-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 shrink-0">
        {TOOLBAR_BUTTONS.map(btn => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            onMouseDown={e => e.preventDefault()}
            onClick={() => { if (viewRef.current) btn.action(viewRef.current) }}
            className="text-xs px-2 py-1 rounded text-nhs-grey-1 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium"
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
