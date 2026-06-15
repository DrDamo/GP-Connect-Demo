import type { DraftRecord } from '../types'

// ---------------------------------------------------------------------------
// BuilderDomainNav — left sidebar navigation for the Record Builder
// ---------------------------------------------------------------------------

export type BuilderDomain =
  | 'admin'
  | 'medications'
  | 'allergies'
  | 'problems'
  | 'consultations'
  | 'immunisations'
  | 'investigations'
  | 'referrals'
  | 'diaryEntries'
  | 'codedData'
  | 'documents'
  | 'lists'

export interface BuilderDomainNavProps {
  active: BuilderDomain
  draft: DraftRecord
  onChange: (domain: BuilderDomain) => void
}

interface DomainDef {
  id: BuilderDomain
  label: string
  count?: (draft: DraftRecord) => number
  readOnly?: boolean
  dividerBefore?: boolean
}

const DOMAINS: DomainDef[] = [
  {
    id: 'admin',
    label: 'Admin',
    count: d => d.practitioners.length + d.locations.length + d.organisations.length,
  },
  { id: 'medications', label: 'Medications', count: d => d.medications.length },
  { id: 'allergies', label: 'Allergies', count: d => d.allergies.length },
  { id: 'problems', label: 'Problems', count: d => d.problems.length },
  { id: 'consultations', label: 'Consultations', count: d => d.consultations.length },
  { id: 'immunisations', label: 'Immunisations', count: d => d.immunisations.length },
  { id: 'investigations', label: 'Investigations', count: d => d.investigations.length },
  { id: 'referrals', label: 'Referrals', count: d => d.referrals.length },
  { id: 'diaryEntries', label: 'Diary Entries', count: d => d.diaryEntries.length },
  { id: 'codedData', label: 'Coded Data', count: d => d.codedData.length },
  { id: 'documents', label: 'Documents', count: d => d.documents.length },
  { id: 'lists', label: 'Lists', readOnly: true, dividerBefore: true },
]

export function BuilderDomainNav({ active, draft, onChange }: BuilderDomainNavProps) {
  return (
    <div className="w-48 shrink-0 flex flex-col border-r border-nhs-grey-4 dark:border-nhs-grey-2 bg-nhs-grey-5 dark:bg-gray-900 overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-nhs-grey-4 dark:border-nhs-grey-2">
        <span className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
          Record sections
        </span>
      </div>
      <nav className="flex-1 py-1">
        {DOMAINS.map(domain => {
          const isActive = domain.id === active
          const count = domain.count?.(draft)
          return (
            <div key={domain.id}>
              {domain.dividerBefore && (
                <div className="my-1 border-t border-nhs-grey-4 dark:border-nhs-grey-2" />
              )}
              <button
                onClick={() => onChange(domain.id)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-gray-800 border-l-4 border-nhs-blue text-nhs-blue font-medium pl-2'
                    : 'border-l-4 border-transparent text-nhs-grey-2 hover:bg-white dark:hover:bg-gray-800 hover:text-nhs-grey-1 pl-2'
                }`}
              >
                <span className="text-sm truncate">{domain.label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {domain.readOnly && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-nhs-grey-4 dark:bg-gray-700 text-nhs-grey-3 dark:text-gray-500">
                      R/O
                    </span>
                  )}
                  {count !== undefined && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-nhs-blue text-white' : 'bg-nhs-grey-4 dark:bg-gray-700 text-nhs-grey-2'
                    }`}>
                      {count}
                    </span>
                  )}
                </div>
              </button>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
