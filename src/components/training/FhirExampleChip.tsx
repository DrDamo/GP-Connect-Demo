import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Props {
  filename: string
  data: unknown
  onLoad?: (filename: string, data: unknown) => void
}

/** Renders a training-guide reference to a `fhir_examples/*.json` file as an
 *  inline chip backed by a real, bundled example — with a preview and a
 *  one-click "Load into Inspector" action — instead of inert plain text. */
export function FhirExampleChip({ filename, data, onLoad }: Props) {
  const [open, setOpen] = useState(false)
  const json = () => JSON.stringify(data, null, 2)

  return (
    <>
      <span className="inline-flex items-center gap-1 align-middle rounded border border-nhs-grey-4 dark:border-line-strong bg-nhs-grey-5 dark:bg-raised pl-1.5 pr-1 py-0.5 mx-0.5 not-italic">
        <svg className="w-3 h-3 text-nhs-grey-3 dark:text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <code className="font-mono text-xs text-nhs-grey-1 dark:text-ink">{filename}</code>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] font-medium text-nhs-blue dark:text-accent hover:underline px-1"
        >
          View
        </button>
      </span>

      {open && (
        <span
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setOpen(false)}
        >
          <span
            className="flex flex-col bg-white dark:bg-canvas rounded-xl shadow-xl w-full max-w-2xl my-4"
            onClick={e => e.stopPropagation()}
          >
            <span className="flex items-center justify-between px-4 py-3 border-b border-nhs-grey-4 dark:border-line">
              <span className="font-mono text-sm font-semibold text-nhs-grey-1 dark:text-ink">{filename}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-nhs-grey-3 dark:text-muted hover:text-nhs-grey-1 dark:hover:text-ink rounded p-1"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>

            <span className="block max-h-[65vh] overflow-y-auto p-3">
              <SyntaxHighlighter
                style={oneDark}
                language="json"
                PreTag="div"
                customStyle={{ borderRadius: '0.5rem', fontSize: '0.7rem', margin: 0 }}
              >
                {json()}
              </SyntaxHighlighter>
            </span>

            <span className="flex items-center justify-between gap-2 px-4 py-3 border-t border-nhs-grey-4 dark:border-line">
              <span className="text-xs text-nhs-grey-3 dark:text-muted">
                Sample data for training purposes — not necessarily a fully spec-compliant bundle.
              </span>
              <span className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(json())}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-nhs-grey-2 dark:text-ink-2 border border-nhs-grey-4 dark:border-line-strong hover:bg-nhs-grey-5 dark:hover:bg-raised transition-colors"
                >
                  Copy JSON
                </button>
                {onLoad && (
                  <button
                    type="button"
                    onClick={() => { onLoad(filename, data); setOpen(false) }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-nhs-blue hover:bg-nhs-blue-dark transition-colors"
                  >
                    Load into Inspector
                  </button>
                )}
              </span>
            </span>
          </span>
        </span>
      )}
    </>
  )
}
