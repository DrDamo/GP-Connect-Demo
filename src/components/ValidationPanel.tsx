import type { ValidationResult } from '../fhir/types'

interface Props {
  result: ValidationResult
  onCleanRefs?: () => void
}

const severityConfig = {
  error: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', icon: '✕', badge: 'bg-nhs-red text-white' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', icon: '⚠', badge: 'bg-nhs-yellow text-nhs-grey-1' },
  info: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', icon: 'ℹ', badge: 'bg-nhs-blue-light text-white' },
}

export function ValidationPanel({ result, onCleanRefs }: Props) {
  const errors = result.issues.filter(i => i.severity === 'error')
  const warnings = result.issues.filter(i => i.severity === 'warning')
  const danglingCount = warnings.filter(i => i.message.includes('does not resolve')).length

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${result.valid ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
        <span className={`text-lg font-bold ${result.valid ? 'text-nhs-green' : 'text-nhs-red'}`}>
          {result.valid ? '✓' : '✕'}
        </span>
        <div className="flex-1">
          <span className={`font-semibold text-sm ${result.valid ? 'text-nhs-green' : 'text-nhs-red'}`}>
            {result.valid ? 'Bundle is structurally valid' : 'Validation errors found'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {errors.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-nhs-red text-white">
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-nhs-yellow text-nhs-grey-1">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
          {result.issues.length === 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-nhs-green text-white">No issues</span>
          )}
          {danglingCount > 0 && onCleanRefs && (
            <button
              onClick={onCleanRefs}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-nhs-blue text-white hover:bg-nhs-blue/80 transition-colors"
            >
              Remove {danglingCount} dangling ref{danglingCount !== 1 ? 's' : ''} →
            </button>
          )}
        </div>
      </div>

      {/* Resource counts */}
      {Object.keys(result.resourceCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(result.resourceCounts).map(([rt, count]) => (
            <span key={rt} className="px-2 py-1 rounded text-xs bg-nhs-grey-5 text-nhs-grey-2 font-mono">
              {rt}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Issues */}
      {result.issues.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {result.issues.map((issue, i) => {
            const cfg = severityConfig[issue.severity]
            return (
              <div key={i} className={`flex gap-2 p-2 rounded border text-xs ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                <span className="font-bold shrink-0">{cfg.icon}</span>
                <div>
                  <span className="font-medium">{issue.message}</span>
                  {issue.path && <span className="ml-2 font-mono opacity-70">{issue.path}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
