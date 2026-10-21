import { EditorView } from '@codemirror/view'
import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

// JSON/XML token colours come from CSS variables (see index.css) so one
// style serves both themes: keys teal, strings amber, numbers violet,
// booleans/null red, punctuation muted.
export const fhirHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--json-key)' },
  { tag: tags.string, color: 'var(--json-str)' },
  { tag: tags.number, color: 'var(--json-num)' },
  { tag: [tags.bool, tags.null, tags.atom], color: 'var(--json-bool)' },
  { tag: [tags.punctuation, tags.separator, tags.bracket, tags.squareBracket, tags.brace, tags.angleBracket], color: 'var(--json-punct)' },
  { tag: tags.tagName, color: 'var(--json-key)' },
  { tag: tags.attributeName, color: 'var(--json-num)' },
  { tag: tags.attributeValue, color: 'var(--json-str)' },
  { tag: [tags.comment, tags.processingInstruction], color: 'var(--json-punct)', fontStyle: 'italic' },
])

export const editorTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': {
    overflow: 'auto',
    height: '100%',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    lineHeight: '1.5',
  },
  '.cm-content': { padding: '0', caretColor: 'transparent' },
  '.cm-line': { padding: '0 12px 0 4px' },
  '.cm-gutters': {
    backgroundColor: 'var(--cm-gutter-bg)',
    borderRight: '1px solid var(--cm-gutter-line)',
    color: 'var(--cm-gutter-fg)',
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
  '.cm-selectionBackground': { backgroundColor: 'var(--cm-selection) !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--cm-selection) !important' },
})
