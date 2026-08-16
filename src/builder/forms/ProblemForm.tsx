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
  { value: 'resolved', label: 'Resolved' },
]

const SIGNIFICANCE_OPTS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
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
function getProblemGroup(problem: DraftProblem): ProblemGroup {
  if (problem.clinicalStatus === 'active') return 'active'
  if (problem.clinicalStatus === 'inactive' || problem.clinicalStatus === 'resolved') {
    if (problem.significance === 'major') return 'major-inactive'
    if (problem.significance === 'minor') return 'minor-inactive'
  }
  return 'other'
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

  // An active problem hasn't ended, so no end date can be recorded; an
  // inactive/resolved problem must have one to say when it stopped being current.
  const endDateDisabled = problem.clinicalStatus === 'active'
  const endDateRequired = problem.clinicalStatus === 'inactive' || problem.clinicalStatus === 'resolved'

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

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Clinical status"
              value={problem.clinicalStatus ?? ''}
              onChange={v => upd({
                clinicalStatus: v as DraftProblem['clinicalStatus'],
                // Active problems have no end date — clear any value left over
                // from a previous status so it can't be silently submitted.
                ...(v === 'active' ? { endDate: '' } : {}),
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
        </div>
      )}
    </div>
  )
}

function ProblemDisplayRow({
  problem,
  onEdit,
  onDelete,
}: {
  problem: DraftProblem
  onEdit: () => void
  onDelete: () => void
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
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
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
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onEdit} className="text-xs border border-nhs-blue text-nhs-blue px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">Edit</button>
        <button type="button" onClick={onDelete} className="text-nhs-red hover:opacity-70 p-0.5" title="Delete">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

export function ProblemForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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

  const activeProblem = modalState
    ? draft.problems.find(p => p._tempId === modalState.tempId)
    : null

  const deleteTargetProblem = deleteTarget
    ? draft.problems.find(p => p._tempId === deleteTarget)
    : null

  const modalTitle = activeProblem
    ? (activeProblem.problem ? `Edit: ${activeProblem.problem}` : 'Edit Problem')
    : 'Add Problem'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Problems</span>
        <button
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add problem
        </button>
      </div>

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
    </div>
  )
}
