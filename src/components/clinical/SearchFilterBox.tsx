import { InfoHint } from '../../onboarding/InfoHint'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  matchCount?: number
  totalCount?: number
}

export function SearchFilterBox({ value, onChange, placeholder = 'Search this section…', matchCount, totalCount }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-xs">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nhs-grey-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-7 pr-7 py-1.5 text-xs rounded border border-nhs-grey-4 dark:border-gray-600 bg-white dark:bg-gray-800 text-nhs-grey-1 dark:text-gray-100 placeholder-nhs-grey-3 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-nhs-grey-3 hover:text-nhs-grey-1 text-xs leading-none"
          >
            ✕
          </button>
        )}
      </div>
      {value && matchCount !== undefined && totalCount !== undefined && (
        <span className="text-xs text-nhs-grey-3 dark:text-gray-500 whitespace-nowrap">
          {matchCount} of {totalCount} match{matchCount !== 1 ? 'es' : ''}
        </span>
      )}
      <InfoHint topic="clinical.search-filter" />
    </div>
  )
}
