import { isValidElement, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { slugify } from './utils'
import { getFhirExample } from './fhirExamples'
import { FhirExampleChip } from './FhirExampleChip'

function childrenToText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (isValidElement(children)) {
    return childrenToText((children.props as { children?: ReactNode }).children)
  }
  return ''
}

interface Props {
  content: string
  /** When provided, `fhir_examples/*.json` references get a "Load into Inspector" action. */
  onLoadExample?: (filename: string, data: unknown) => void
}

export function MarkdownContent({ content, onLoadExample }: Props) {
  return (
    <div className="text-sm">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => {
            const id = slugify(childrenToText(children))
            return (
              <h1 id={id} className="text-xl font-bold text-nhs-grey-1 dark:text-slate-100 mt-6 mb-3 pb-2 border-b border-nhs-grey-4 dark:border-slate-700 first:mt-0">
                {children}
              </h1>
            )
          },
          h2: ({ children }) => {
            const id = slugify(childrenToText(children))
            return <h2 id={id} className="text-base font-bold text-nhs-grey-1 dark:text-slate-100 mt-5 mb-2">{children}</h2>
          },
          h3: ({ children }) => {
            const id = slugify(childrenToText(children))
            return <h3 id={id} className="text-sm font-semibold text-nhs-grey-1 dark:text-slate-100 mt-4 mb-1.5">{children}</h3>
          },
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-nhs-grey-2 dark:text-slate-300 mt-3 mb-1">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-nhs-grey-2 dark:text-slate-300 leading-relaxed mb-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 mb-3 text-nhs-grey-2 dark:text-slate-300">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 mb-3 text-nhs-grey-2 dark:text-slate-300">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-amber-400 dark:border-amber-600 pl-4 my-3 bg-amber-50 dark:bg-amber-950 py-2 rounded-r-md text-amber-900 dark:text-amber-200 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-nhs-grey-4 dark:border-slate-600 my-6" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-nhs-grey-1 dark:text-slate-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-nhs-grey-2 dark:text-slate-300">{children}</em>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '')
            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ borderRadius: '0.5rem', fontSize: '0.75rem', margin: '0.75rem 0' }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )
            }
            const inlineText = childrenToText(children)
            const exampleData = /^[\w.-]+\.json$/i.test(inlineText) ? getFhirExample(inlineText) : undefined
            if (exampleData !== undefined) {
              return <FhirExampleChip filename={inlineText} data={exampleData} onLoad={onLoadExample} />
            }
            const isBlock = String(children).includes('\n')
            if (isBlock) {
              return (
                <pre className="bg-slate-800 dark:bg-slate-900 rounded-lg p-4 overflow-x-auto my-3">
                  <code className="text-xs text-slate-200 font-mono">{children}</code>
                </pre>
              )
            }
            return (
              <code className="bg-nhs-grey-5 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-xs text-nhs-grey-1 dark:text-slate-200">
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="text-xs w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-nhs-grey-5 dark:bg-slate-700">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-nhs-grey-4 dark:border-slate-600 even:bg-nhs-grey-5/40 dark:even:bg-slate-800/40">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-nhs-grey-1 dark:text-slate-100 border border-nhs-grey-4 dark:border-slate-600">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-nhs-grey-2 dark:text-slate-300 border border-nhs-grey-4 dark:border-slate-600 align-top">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
