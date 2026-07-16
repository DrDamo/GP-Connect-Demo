import { useState, useEffect } from 'react'
import { MarkdownContent } from '../components/training/MarkdownContent'
import { slugify } from '../components/training/utils'

import overviewContent from '../app-guide-content/overview.md?raw'
import clinicalViewContent from '../app-guide-content/clinical-view.md?raw'
import inspectorContent from '../app-guide-content/inspector.md?raw'
import rawSourceContent from '../app-guide-content/raw-source.md?raw'
import validationContent from '../app-guide-content/validation.md?raw'
import builderContent from '../app-guide-content/builder.md?raw'
import accountContent from '../app-guide-content/account.md?raw'
import sharedPatientsContent from '../app-guide-content/shared-patients.md?raw'

export type GuidePageId =
  | 'overview' | 'clinical-view' | 'inspector' | 'raw-source'
  | 'validation' | 'builder' | 'account' | 'shared-patients'

const GUIDE_PAGES: { id: GuidePageId; label: string; content: string }[] = [
  { id: 'overview', label: 'Overview', content: overviewContent },
  { id: 'clinical-view', label: 'Clinical View', content: clinicalViewContent },
  { id: 'inspector', label: 'Inspector', content: inspectorContent },
  { id: 'raw-source', label: 'Raw Source', content: rawSourceContent },
  { id: 'validation', label: 'Validation', content: validationContent },
  { id: 'builder', label: 'Record Builder', content: builderContent },
  { id: 'account', label: 'Account', content: accountContent },
  { id: 'shared-patients', label: 'Shared Patients', content: sharedPatientsContent },
]

interface Props {
  initialPage?: GuidePageId | null
  initialAnchor?: string | null
}

export function AppGuideView({ initialPage, initialAnchor }: Props) {
  const [pageId, setPageId] = useState<GuidePageId>(initialPage ?? 'overview')

  useEffect(() => {
    if (initialPage) setPageId(initialPage)
  }, [initialPage])

  useEffect(() => {
    if (!initialAnchor) return
    const id = slugify(initialAnchor)
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => clearTimeout(timer)
  }, [initialAnchor, pageId])

  const page = GUIDE_PAGES.find(p => p.id === pageId) ?? GUIDE_PAGES[0]

  return (
    <div className="h-full overflow-hidden flex bg-nhs-grey-5 dark:bg-slate-900">
      <nav className="w-48 shrink-0 border-r border-nhs-grey-4 dark:border-slate-700 overflow-y-auto p-3 space-y-1">
        <p className="text-[10px] font-semibold text-nhs-grey-3 dark:text-slate-500 uppercase tracking-wide mb-2 px-2">
          App Guide
        </p>
        {GUIDE_PAGES.map(p => (
          <button
            key={p.id}
            onClick={() => setPageId(p.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs ${
              pageId === p.id
                ? 'bg-white dark:bg-slate-800 text-nhs-blue font-medium border border-nhs-grey-4 dark:border-slate-600'
                : 'text-nhs-grey-2 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-lg border border-nhs-grey-4 dark:border-slate-600 p-6">
          <MarkdownContent content={page.content} />
        </div>
      </div>
    </div>
  )
}
