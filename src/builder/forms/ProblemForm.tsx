import { useState } from 'react'
import type { DraftRecord, DraftProblem } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { DateField, isoToDisplay } from './shared/DateField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'
import { ConfidentialityCheckboxes } from './shared/ConfidentialityCheckboxes'
import { TrashIcon } from '../components/Icons'

// ---------------------------------------------------------------------------
// ProblemForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const CLINICAL_STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'recurrence', label: 'Recurrence' },
  { value: 'remission', label: 'Remission' },
  { value: 'resolved', label: 'Resolved' },
]

const SIGNIFICANCE_OPTS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
]

// Fixed SNOMED CT set for the (optional) subjective severity of the problem.
const SEVERITY_OPTS = [
  { value: 'severe', label: 'Severe' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'mild', label: 'Mild' },
]

type ProblemGroup = 'active' | 'major-inactive' | 'minor-inactive' | 'other'

const PROBLEM_GROUP_ORDER: ProblemGroup[] = ['active', 'major-inactive', 'minor-inactive', 'other']

const PROBLEM_GROUP_LABELS: Record<ProblemGroup, string> = {
  active: 'Active',
  'major-inactive': 'Major Inactive',
  'minor-inactive': 'Minor Inactive',
  other: 'Other',
}

// 'resolved' counts as inactive for grouping purposes, same as 'inactive' —
// both need a significance to land in Major/Minor Inactive, otherwise they
// fall into 'other' alongside anything with no clinical status set at all.
// 'recurrence' and 'remission' are still current problems (just with a more
// specific sub-status), so they group alongside 'active'.
function getProblemGroup(problem: DraftProblem): ProblemGroup {
  if (problem.clinicalStatus === 'active' || problem.clinicalStatus === 'recurrence' || problem.clinicalStatus === 'remission') return 'active'
  if (problem.clinicalStatus === 'inactive' || problem.clinicalStatus === 'resolved') {
    if (problem.significance === 'major') return 'major-inactive'
    if (problem.significance === 'minor') return 'minor-inactive'
  }
  return 'other'
}

// EMIS/TPP Group/Combine/Evolve problem-hierarchy relation — see
// src/builder/generate/problems.ts (RelatedProblemHeader extension + note generation) and
// src/components/clinical/ProblemsView.tsx (the collapsed parent/children tree this feeds).
type RelateEventType = 'group' | 'combine' | 'evolve'

const RELATE_EVENT_LABELS: Record<RelateEventType, string> = {
  group: 'Group', combine: 'Combine', evolve: 'Evolve',
}

const RELATE_EVENT_DESCRIPTIONS: Record<RelateEventType, string> = {
  group: 'The other selected problems will be shown nested under the one you choose as parent, as separate problems still filed under one heading.',
  combine: 'The other selected problems will be folded into the one you choose — as if they were re-coded as a single problem.',
  evolve: 'The other selected problems will be recorded as having evolved into the one you choose (e.g. a suspected diagnosis progressing to a confirmed one).',
}

function relatedProblemLabel(eventType: RelateEventType | undefined): string {
  if (eventType === 'group') return 'Grouped'
  if (eventType === 'evolve') return 'Evolved'
  return 'Combined'
}

// Builds parent tempId -> [child DraftProblem] from relatedProblemParentTempId links, ignoring
// a dangling parent reference (parent deleted since the link was made) — mirrors
// buildChildrenByParent in builder/generate/problems.ts, minus the confidential-parent check
// (irrelevant here; this is for in-form display only).
function buildChildrenByParent(problems: DraftProblem[]): Map<string, DraftProblem[]> {
  const byId = new Map(problems.map(p => [p._tempId, p]))
  const map = new Map<string, DraftProblem[]>()
  for (const p of problems) {
    if (!p.relatedProblemParentTempId || !byId.has(p.relatedProblemParentTempId)) continue
    if (!map.has(p.relatedProblemParentTempId)) map.set(p.relatedProblemParentTempId, [])
    map.get(p.relatedProblemParentTempId)!.push(p)
  }
  return map
}

// Walks existing parent pointers up from `tempId`, collecting every ancestor — used to stop a
// relate action from creating a cycle (assigning a problem as a child of its own descendant).
function getAncestorIds(tempId: string, byId: Map<string, DraftProblem>): Set<string> {
  const ancestors = new Set<string>()
  let current = byId.get(tempId)
  while (current?.relatedProblemParentTempId && !ancestors.has(current.relatedProblemParentTempId)) {
    ancestors.add(current.relatedProblemParentTempId)
    current = byId.get(current.relatedProblemParentTempId)
  }
  return ancestors
}

function ProblemCard({
  problem,
  draft,
  dispatch,
  isModal,
}: {
  problem: DraftProblem
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftProblem>) =>
    dispatch({ type: 'UPDATE_PROBLEM', payload: { _tempId: problem._tempId, updates } })

  const expanded = isModal ? true : open

  // A problem that's still current (active, or recurred/in remission but not
  // ended) can't have an end date; an inactive/resolved problem must have one
  // to say when it stopped being current.
  const endDateDisabled = problem.clinicalStatus === 'active' || problem.clinicalStatus === 'recurrence' || problem.clinicalStatus === 'remission'
  const endDateRequired = problem.clinicalStatus === 'inactive' || problem.clinicalStatus === 'resolved'

  // Read-only view of a Group/Combine/Evolve relation set via the Problems list's multi-select
  // action (see ProblemForm below) — shown here so it's visible while editing a single problem,
  // with an Unlink escape hatch if this problem is a child.
  const relatedParent = problem.relatedProblemParentTempId
    ? draft.problems.find(p => p._tempId === problem.relatedProblemParentTempId)
    : undefined
  const relatedChildren = draft.problems.filter(p => p.relatedProblemParentTempId === problem._tempId)
  const relatedSiblings = relatedParent
    ? draft.problems.filter(p => p.relatedProblemParentTempId === relatedParent._tempId && p._tempId !== problem._tempId)
    : []

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
        {isModal ? (
          <span className="text-sm font-medium text-nhs-grey-1 flex-1">
            {problem.problem || 'New problem'}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <svg
              className={`w-3.5 h-3.5 text-nhs-grey-3 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-sm font-medium text-nhs-grey-1">
              {problem.problem || 'New problem'}
            </span>
            {problem.clinicalStatus && (
              <span className="text-xs text-nhs-grey-3">{problem.clinicalStatus}</span>
            )}
          </button>
        )}
        {!isModal && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_PROBLEM', payload: problem._tempId })}
            className="text-nhs-red hover:opacity-70 p-0.5"
            title="Remove"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          <SnomedPicker
            label="Problem description"
            value={problem.problem ?? ''}
            code={problem.snomedCode}
            semanticTag="disorder,finding"
            onChange={({ value, code }) => upd({ problem: value, snomedCode: code })}
            required
          />
          <Field label="Associated text" value={problem.associatedText ?? ''} onChange={v => upd({ associatedText: v })} />

          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="Clinical status"
              value={problem.clinicalStatus ?? ''}
              onChange={v => upd({
                clinicalStatus: v as DraftProblem['clinicalStatus'],
                // Only active/recurrence/remission are still "current" — clear
                // any end date left over from a previous status so it can't
                // be silently submitted against a problem that hasn't ended.
                ...(v === 'active' || v === 'recurrence' || v === 'remission' ? { endDate: '' } : {}),
              })}
              options={CLINICAL_STATUS_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="Significance"
              value={problem.significance ?? ''}
              onChange={v => upd({ significance: v as DraftProblem['significance'] })}
              options={SIGNIFICANCE_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="Severity"
              value={problem.severity ?? ''}
              onChange={v => upd({ severity: v as DraftProblem['severity'] })}
              options={SEVERITY_OPTS}
              placeholder="— Not recorded —"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <DateField label="Start date" value={problem.startDate ?? ''} onChange={v => upd({ startDate: v })} />
            <DateField
              label="End date"
              value={problem.endDate ?? ''}
              onChange={v => upd({ endDate: v })}
              required={endDateRequired}
              disabled={endDateDisabled}
            />
            <DateField label="Asserted date" value={problem.assertedDate ?? ''} onChange={v => upd({ assertedDate: v })} />
          </div>

          <PractitionerSelect
            label="Asserter"
            draft={draft}
            value={problem.asserterTempId}
            onChange={v => upd({ asserterTempId: v })}
            required
          />

          <ConfidentialityCheckboxes
            confidential={problem.confidential}
            notForPfs={problem.notForPfs}
            onChange={upd}
          />

          <LinkSection
            draft={draft}
            linkedProblemTempIds={problem.linkedProblemTempIds ?? []}
            linkedConsultationTempId={problem.linkedConsultationTempId}
            onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
            onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
            excludeProblemTempId={problem._tempId}
          />

          {(relatedParent || relatedChildren.length > 0) && (
            <div className="border-t border-nhs-grey-4 dark:border-gray-700 pt-3 mt-1 space-y-2">
              <p className="text-xs font-semibold text-nhs-grey-2 dark:text-gray-400 uppercase tracking-wide">
                Related Problems (Group / Combine / Evolve)
              </p>
              {relatedParent && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-nhs-grey-2 dark:text-gray-300">
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 font-medium">
                    {relatedProblemLabel(problem.relatedProblemEventType)} into
                  </span>
                  <span>{relatedParent.problem || 'Unnamed problem'}</span>
                  <button
                    type="button"
                    onClick={() => upd({ relatedProblemParentTempId: undefined, relatedProblemEventType: undefined })}
                    className="text-nhs-grey-3 hover:text-nhs-red hover:underline"
                  >
                    Unlink
                  </button>
                </div>
              )}
              {relatedSiblings.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-nhs-grey-2 dark:text-gray-300">
                  <span className="px-1.5 py-0.5 rounded bg-nhs-grey-4 dark:bg-gray-700 font-medium shrink-0">Siblings</span>
                  <span>{relatedSiblings.map(s => s.problem || 'Unnamed problem').join(', ')}</span>
                </div>
              )}
              {relatedChildren.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-nhs-grey-2 dark:text-gray-300">
                  <span className="px-1.5 py-0.5 rounded bg-nhs-grey-4 dark:bg-gray-700 font-medium shrink-0">Children</span>
                  <span>{relatedChildren.map(c => c.problem || 'Unnamed problem').join(', ')}</span>
                </div>
              )}
              <p className="text-[11px] text-nhs-grey-3 dark:text-gray-500">
                Set from the Problems list — select this problem alongside others there and choose Combine/Group/Evolve.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProblemDisplayRow({
  problem,
  onEdit,
  onDelete,
  selectMode,
  selected,
  onToggleSelected,
  parentProblem,
  children,
  onUnlink,
}: {
  problem: DraftProblem
  onEdit: () => void
  onDelete: () => void
  selectMode: boolean
  selected: boolean
  onToggleSelected: () => void
  /** The resolved parent problem, when `problem.relatedProblemParentTempId` points to one still in the draft. */
  parentProblem?: DraftProblem
  /** Other problems grouped/combined/evolved under this one, if any. */
  children: DraftProblem[]
  onUnlink: () => void
}) {
  const status = problem.clinicalStatus ?? ''
  const significance = problem.significance ?? ''

  const statusBadge = (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}>{status || 'no status'}</span>
  )

  const significancePill = significance ? (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
      significance === 'major' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    }`}>{significance}</span>
  ) : null

  const datePart = [
    problem.startDate ? `from ${isoToDisplay(problem.startDate)}` : null,
    problem.endDate ? `to ${isoToDisplay(problem.endDate)}` : null,
  ].filter(Boolean).join(' ')

  return (
    <div className={`bg-nhs-grey-5 dark:bg-gray-800 border rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2 ${
      selected ? 'border-nhs-blue ring-1 ring-nhs-blue' : 'border-nhs-grey-4 dark:border-nhs-grey-2'
    }`}>
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="mt-1 shrink-0 rounded border-nhs-grey-4 dark:border-gray-600"
          aria-label={`Select ${problem.problem || 'this problem'}`}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">
            {problem.problem || 'Unnamed problem'}
          </span>
          {statusBadge}
          {significancePill}
        </div>
        {datePart && (
          <div className="mt-0.5">
            <span className="text-xs text-nhs-grey-3">{datePart}</span>
          </div>
        )}
        {parentProblem && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 font-medium">
              ↳ {relatedProblemLabel(problem.relatedProblemEventType)} into: {parentProblem.problem || 'Unnamed problem'}
            </span>
            {!selectMode && (
              <button
                type="button"
                onClick={onUnlink}
                className="text-[11px] text-nhs-grey-3 hover:text-nhs-red hover:underline"
              >
                Unlink
              </button>
            )}
          </div>
        )}
        {children.length > 0 && (
          <div className="mt-1">
            <span className="text-xs px-1.5 py-0.5 rounded bg-nhs-grey-4 dark:bg-gray-700 text-nhs-grey-2 dark:text-gray-300 font-medium">
              {children.length} related problem{children.length !== 1 ? 's' : ''} grouped underneath
            </span>
          </div>
        )}
      </div>
      {!selectMode && (
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onEdit} className="text-xs border border-nhs-blue text-nhs-blue px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">Edit</button>
          <button type="button" onClick={onDelete} className="text-nhs-red hover:opacity-70 p-0.5" title="Delete">
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// Dialog shown after choosing Group/Combine/Evolve on 2+ selected problems — asks which one
// becomes the parent (the survivor the others are filed/folded/evolved into).
function RelateProblemsDialog({
  eventType,
  problems,
  onConfirm,
  onCancel,
}: {
  eventType: RelateEventType
  problems: DraftProblem[]
  onConfirm: (parentTempId: string) => void
  onCancel: () => void
}) {
  const [parentTempId, setParentTempId] = useState(problems[0]?._tempId ?? '')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{RELATE_EVENT_LABELS[eventType]} problems</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">{RELATE_EVENT_DESCRIPTIONS[eventType]}</p>
          <p className="text-xs font-medium text-nhs-grey-3 dark:text-gray-500 uppercase tracking-wide">Which one is the parent?</p>
          <div className="space-y-1.5">
            {problems.map(p => (
              <label key={p._tempId} className="flex items-center gap-2 text-sm text-nhs-grey-1 dark:text-gray-200 cursor-pointer select-none">
                <input
                  type="radio"
                  name="relate-parent"
                  checked={parentTempId === p._tempId}
                  onChange={() => setParentTempId(p._tempId)}
                  className="border-nhs-grey-4 dark:border-gray-600"
                />
                <span>{p.problem || 'Unnamed problem'}</span>
                {p.clinicalStatus && <span className="text-xs text-nhs-grey-3">({p.clinicalStatus})</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(parentTempId)}
            disabled={!parentTempId}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-nhs-blue hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {RELATE_EVENT_LABELS[eventType]}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProblemForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingEventType, setPendingEventType] = useState<RelateEventType | null>(null)

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_PROBLEM_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  const handleEdit = (problem: DraftProblem) => {
    const snap = structuredClone(draft)
    setModalState({ tempId: problem._tempId, snapshot: snap })
  }

  const handleDone = () => {
    setModalState(null)
  }

  const handleCancel = () => {
    if (modalState) {
      dispatch({ type: 'LOAD_DRAFT', payload: modalState.snapshot })
    }
    setModalState(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_PROBLEM', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelected = (tempId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(tempId)) next.delete(tempId)
      else next.add(tempId)
      return next
    })
  }

  const handleUnlink = (tempId: string) => {
    dispatch({ type: 'UPDATE_PROBLEM', payload: { _tempId: tempId, updates: { relatedProblemParentTempId: undefined, relatedProblemEventType: undefined } } })
  }

  // Confirms a Group/Combine/Evolve: the chosen parent is promoted (any existing parent
  // link of its own is cleared, so it can't end up a child of one of its own new children),
  // and every other selected problem becomes its child — unless doing so would create a
  // cycle (the chosen parent is already, via existing links, an ancestor of that problem).
  const handleConfirmRelate = (parentTempId: string) => {
    if (!pendingEventType) return
    const byId = new Map(draft.problems.map(p => [p._tempId, p]))
    dispatch({ type: 'UPDATE_PROBLEM', payload: { _tempId: parentTempId, updates: { relatedProblemParentTempId: undefined, relatedProblemEventType: undefined } } })
    for (const childTempId of selectedIds) {
      if (childTempId === parentTempId) continue
      if (getAncestorIds(parentTempId, byId).has(childTempId)) continue
      dispatch({
        type: 'UPDATE_PROBLEM',
        payload: { _tempId: childTempId, updates: { relatedProblemParentTempId: parentTempId, relatedProblemEventType: pendingEventType } },
      })
    }
    setPendingEventType(null)
    exitSelectMode()
  }

  const activeProblem = modalState
    ? draft.problems.find(p => p._tempId === modalState.tempId)
    : null

  const deleteTargetProblem = deleteTarget
    ? draft.problems.find(p => p._tempId === deleteTarget)
    : null

  const modalTitle = activeProblem
    ? (activeProblem.problem ? `Edit: ${activeProblem.problem}` : 'Edit Problem')
    : 'Add Problem'

  const byId = new Map(draft.problems.map(p => [p._tempId, p]))
  const childrenByParent = buildChildrenByParent(draft.problems)
  const selectedProblems = draft.problems.filter(p => selectedIds.has(p._tempId))

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-sm font-medium text-nhs-grey-2">Problems</span>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <button
              type="button"
              onClick={exitSelectMode}
              className="text-sm font-medium text-nhs-grey-2 px-3 py-1.5 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 hover:bg-nhs-grey-5 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          ) : (
            <>
              {draft.problems.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  className="text-sm font-medium text-nhs-blue px-3 py-1.5 rounded border border-nhs-blue hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  Combine / Group / Evolve…
                </button>
              )}
              <button
                type="button"
                onClick={handleAdd}
                className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Add problem
              </button>
            </>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-nhs-blue/30 bg-blue-50 dark:bg-blue-900/10 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-nhs-grey-2 dark:text-gray-300">
            {selectedIds.size === 0 && 'Select 2 or more problems below to combine, group or evolve them into one.'}
            {selectedIds.size === 1 && 'Select at least one more problem.'}
            {selectedIds.size >= 2 && `${selectedIds.size} problems selected.`}
          </p>
          <div className="flex items-center gap-1.5">
            {(['group', 'combine', 'evolve'] as RelateEventType[]).map(eventType => (
              <button
                key={eventType}
                type="button"
                disabled={selectedIds.size < 2}
                onClick={() => setPendingEventType(eventType)}
                className="text-xs font-medium text-white bg-nhs-blue px-2.5 py-1 rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {RELATE_EVENT_LABELS[eventType]}
              </button>
            ))}
          </div>
        </div>
      )}

      {draft.problems.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No problems added yet.</p>
      )}

      {PROBLEM_GROUP_ORDER.map(group => {
        const groupProblems = draft.problems.filter(p => getProblemGroup(p) === group)
        if (groupProblems.length === 0) return null
        return (
          <div key={group} className="mb-4">
            <h3 className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide mb-1.5">
              {PROBLEM_GROUP_LABELS[group]}
            </h3>
            {groupProblems.map(problem => (
              <ProblemDisplayRow
                key={problem._tempId}
                problem={problem}
                onEdit={() => handleEdit(problem)}
                onDelete={() => setDeleteTarget(problem._tempId)}
                selectMode={selectMode}
                selected={selectedIds.has(problem._tempId)}
                onToggleSelected={() => toggleSelected(problem._tempId)}
                parentProblem={problem.relatedProblemParentTempId ? byId.get(problem.relatedProblemParentTempId) : undefined}
                children={childrenByParent.get(problem._tempId) ?? []}
                onUnlink={() => handleUnlink(problem._tempId)}
              />
            ))}
          </div>
        )
      })}

      {modalState && activeProblem && (
        <BuilderModal title={modalTitle} onDone={handleDone} onCancel={handleCancel}>
          <ProblemCard
            problem={activeProblem}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && deleteTargetProblem && (
        <DeleteConfirmDialog
          label={deleteTargetProblem.problem || 'this problem'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {pendingEventType && (
        <RelateProblemsDialog
          eventType={pendingEventType}
          problems={selectedProblems}
          onConfirm={handleConfirmRelate}
          onCancel={() => setPendingEventType(null)}
        />
      )}
    </div>
  )
}
