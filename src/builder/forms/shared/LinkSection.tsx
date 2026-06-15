import type { DraftRecord } from '../../types'

interface Props {
  draft: DraftRecord
  linkedProblemTempIds: string[]
  linkedConsultationTempId?: string
  onChangeProblemLinks: (ids: string[]) => void
  onChangeConsultationLink?: (id: string | undefined) => void
  excludeProblemTempId?: string
}

export function LinkSection({
  draft,
  linkedProblemTempIds,
  linkedConsultationTempId,
  onChangeProblemLinks,
  onChangeConsultationLink,
  excludeProblemTempId,
}: Props) {
  const problems = draft.problems.filter(p => p._tempId !== excludeProblemTempId)
  const consultations = draft.consultations

  if (problems.length === 0 && (!onChangeConsultationLink || consultations.length === 0)) {
    return null
  }

  const toggle = (id: string, on: boolean) =>
    onChangeProblemLinks(
      on ? [...linkedProblemTempIds, id] : linkedProblemTempIds.filter(x => x !== id)
    )

  return (
    <div className="border-t border-nhs-grey-4 dark:border-gray-700 pt-3 mt-1 space-y-3">
      <p className="text-xs font-semibold text-nhs-grey-2 dark:text-gray-400 uppercase tracking-wide">
        GP Connect Linkage
      </p>

      {problems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-nhs-grey-3 dark:text-gray-500 mb-1.5">
            Related problems
          </p>
          <div className="space-y-1.5">
            {problems.map(p => (
              <label
                key={p._tempId}
                className="flex items-center gap-2 text-xs text-nhs-grey-2 dark:text-gray-300 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={linkedProblemTempIds.includes(p._tempId)}
                  onChange={e => toggle(p._tempId, e.target.checked)}
                  className="rounded border-nhs-grey-4 dark:border-gray-600"
                />
                <span>{p.problem || 'Unnamed problem'}</span>
                {p.clinicalStatus && (
                  <span className="text-nhs-grey-3 dark:text-gray-500">({p.clinicalStatus})</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {onChangeConsultationLink && consultations.length > 0 && (
        <div>
          <p className="text-xs font-medium text-nhs-grey-3 dark:text-gray-500 mb-1">
            Recorded in consultation
          </p>
          <select
            value={linkedConsultationTempId ?? ''}
            onChange={e => onChangeConsultationLink(e.target.value || undefined)}
            className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-xs text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
          >
            <option value="">— None —</option>
            {consultations.map(c => (
              <option key={c._tempId} value={c._tempId}>
                {[c.date, c.typeDisplay].filter(Boolean).join(' — ') || 'Unnamed consultation'}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
