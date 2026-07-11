import { EditorView } from '@codemirror/view'

export const editorTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': {
    overflow: 'auto',
    height: '100%',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.75rem',
    lineHeight: '1.5',
  },
  '.cm-content': { padding: '0', caretColor: 'transparent' },
  '.cm-line': { padding: '0 12px 0 4px' },
  '.cm-gutters': {
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #e9ecef',
    color: '#aeb7bd',
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
})
