import type React from 'react'

export interface DomainColumn<T> {
  label: string
  className?: string
  render: (item: T) => React.ReactNode
}

const STATUS_CLASSES: Record<string, string> = {
  active:             'bg-green-100 text-green-800 border-green-300',
  confirmed:          'bg-green-100 text-green-800 border-green-300',
  completed:          'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4',
  resolved:           'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4',
  inactive:           'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4',
  cancelled:          'bg-red-100 text-red-800 border-red-300',
  'entered-in-error': 'bg-red-100 text-red-800 border-red-300',
  stat:               'bg-red-100 text-red-800 border-red-300',
  draft:              'bg-blue-100 text-blue-800 border-blue-300',
  intended:           'bg-blue-100 text-blue-800 border-blue-300',
  'not-done':         'bg-yellow-100 text-yellow-800 border-yellow-300',
  'on-hold':          'bg-yellow-100 text-yellow-800 border-yellow-300',
  urgent:             'bg-orange-100 text-orange-800 border-orange-300',
  asap:               'bg-orange-100 text-orange-800 border-orange-300',
}

const FALLBACK_CLASS = 'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4'

export function StatusBadge({ value }: { value: string }) {
  const key = value.toLowerCase()
  const cls = STATUS_CLASSES[key] ?? FALLBACK_CLASS
  const label = value.charAt(0).toUpperCase() + value.slice(1)
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${cls}`}>
      {label}
    </span>
  )
}

export function DomainTable<T extends { id: string }>({
  columns,
  items,
  selectedId,
  onSelect,
  emptyMessage = 'No records found',
}: {
  columns: DomainColumn<T>[]
  items: T[]
  selectedId?: string
  onSelect?: (id: string) => void
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-nhs-grey-3">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="border border-nhs-grey-5 rounded-lg overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-nhs-grey-5 text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
            {columns.map(col => (
              <th key={col.label} className={`py-2 px-3 ${col.className ?? ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const isSelected = item.id === selectedId
            return (
              <tr
                key={item.id}
                onClick={() => onSelect?.(item.id)}
                className={`border-b border-nhs-grey-5 transition-colors ${
                  onSelect ? 'cursor-pointer' : ''
                } ${
                  isSelected
                    ? 'bg-blue-100'
                    : onSelect
                      ? 'hover:bg-blue-50'
                      : ''
                }`}
              >
                {columns.map(col => (
                  <td key={col.label} className={`py-2.5 px-3 text-sm text-nhs-grey-2 ${col.className ?? ''}`}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
