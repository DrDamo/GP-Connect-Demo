/**
 * Tools section — a home for standalone utilities that don't need a loaded
 * bundle. Add new tools to TOOLS below; each renders as a card on the
 * landing list and opens its component when clicked.
 */
import { useState, type ComponentType } from 'react'
import { SnomedCodeChecker } from './codeChecker/SnomedCodeChecker'

interface ToolDefinition {
  id: string
  name: string
  description: string
  component: ComponentType
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'snomed-code-checker',
    name: 'SNOMED CT Code Checker',
    description: 'Paste or import a list of codes to check they exist, whether they’re active or inactive, and which term they match.',
    component: SnomedCodeChecker,
  },
]

export function ToolsView() {
  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  const activeTool = TOOLS.find(t => t.id === activeToolId)

  if (activeTool) {
    const Tool = activeTool.component
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-3">
          <button
            type="button"
            onClick={() => setActiveToolId(null)}
            className="text-sm text-nhs-grey-2 dark:text-muted hover:text-nhs-blue"
          >
            ← All tools
          </button>
          <Tool />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-nhs-grey-1 dark:text-ink">Tools</h2>
          <p className="text-sm text-nhs-grey-3 dark:text-muted mt-1">
            Standalone utilities for working with GP Connect FHIR STU3 data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveToolId(tool.id)}
              className="text-left bg-white dark:bg-canvas rounded-xl border border-nhs-grey-4 dark:border-line p-5 hover:border-nhs-blue transition-colors"
            >
              <h3 className="font-semibold text-nhs-grey-1 dark:text-ink">{tool.name}</h3>
              <p className="text-xs text-nhs-grey-3 dark:text-muted mt-1">{tool.description}</p>
              <p className="text-sm text-nhs-blue mt-3">Open →</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
