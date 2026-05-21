import { DOMAINS, type DomainId } from './domains'

interface Props {
  active: DomainId
  onSelect: (id: DomainId) => void
  counts: Partial<Record<DomainId, number>>
}

export function DomainNav({ active, onSelect, counts }: Props) {
  return (
    <div className="w-48 shrink-0 flex flex-col border-r border-nhs-grey-4 bg-nhs-grey-5 overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-nhs-grey-4">
        <span className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">Clinical areas</span>
      </div>
      <nav className="flex-1 py-1">
        {DOMAINS.map(domain => {
          const isActive = domain.id === active
          const count = counts[domain.id]
          return (
            <button
              key={domain.id}
              onClick={() => onSelect(domain.id)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                isActive
                  ? 'bg-white border-l-4 border-nhs-blue text-nhs-blue font-medium pl-2'
                  : 'border-l-4 border-transparent text-nhs-grey-2 hover:bg-white hover:text-nhs-grey-1 pl-2'
              }`}
            >
              <span className="text-sm truncate">{domain.label}</span>
              {domain.implemented && count !== undefined ? (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                  isActive ? 'bg-nhs-blue text-white' : 'bg-nhs-grey-4 text-nhs-grey-2'
                }`}>
                  {count}
                </span>
              ) : !domain.implemented ? (
                <span className="text-xs text-nhs-grey-3 shrink-0">—</span>
              ) : null}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
