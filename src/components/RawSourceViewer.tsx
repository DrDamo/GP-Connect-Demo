import { useState } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs'

SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('xml', xml)

interface Props {
  source: string
  format: 'json' | 'xml'
  filename: string
}

const MAX_DISPLAY_LINES = 3000

export function RawSourceViewer({ source, format, filename }: Props) {
  const [copied, setCopied] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(source)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allLines = source.split('\n')
  const lineCount = allLines.length
  const isTruncated = !showAll && lineCount > MAX_DISPLAY_LINES
  const displaySource = isTruncated ? allLines.slice(0, MAX_DISPLAY_LINES).join('\n') : source

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 border-b border-nhs-grey-4 rounded-t-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-nhs-grey-2 truncate max-w-48">{filename}</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-nhs-grey-4 text-nhs-grey-1 uppercase">{format}</span>
          <span className="text-xs text-nhs-grey-3">{lineCount.toLocaleString()} lines</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-nhs-grey-2 hover:text-nhs-blue transition-colors px-2 py-1 rounded hover:bg-white"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {isTruncated && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700">
            Large file — showing first {MAX_DISPLAY_LINES.toLocaleString()} of {lineCount.toLocaleString()} lines.
          </p>
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-amber-800 font-medium underline whitespace-nowrap hover:no-underline"
          >
            Show all {lineCount.toLocaleString()} lines
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto rounded-b-lg">
        {showAll && lineCount > MAX_DISPLAY_LINES ? (
          /* Plain <pre> avoids the DOM cost of per-token spans for very large files */
          <pre className="text-xs font-mono leading-relaxed p-3 m-0 whitespace-pre bg-white min-h-full text-nhs-grey-1">
            {source}
          </pre>
        ) : (
          <SyntaxHighlighter
            language={format}
            style={githubGist}
            showLineNumbers
            lineNumberStyle={{ color: '#aeb7bd', fontSize: '0.75rem', minWidth: '2.5rem' }}
            customStyle={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.5', background: '#fff', height: '100%' }}
            wrapLines={false}
          >
            {displaySource}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  )
}
