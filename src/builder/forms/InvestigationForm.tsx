import { useState } from 'react'
import type { DraftRecord, DraftInvestigation, DraftTestGroup, DraftInvestigationResult } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { DateField, isoToDisplay } from './shared/DateField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'
import { FormSection } from './shared/FormSection'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'
import { ConfidentialityCheckboxes } from './shared/ConfidentialityCheckboxes'
import { TrashIcon } from '../components/Icons'

// ---------------------------------------------------------------------------
// InvestigationForm
//
// Mirrors the GP Connect Investigations model: a Test Report (with an
// optional linked Specimen and Test Request) contains one or more Test
// Groups, each holding one or more Test Results. A comment can be added at
// any of the three levels — report, group, or result.
// https://simplifier.net/guide/gp-connect-access-record-structured/Home/Design/Investigations-guidance
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const DIAG_STATUS_OPTS = [
  { value: 'final', label: 'Final' },
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'registered', label: 'Registered' },
  { value: 'partial', label: 'Partial' },
  { value: 'amended', label: 'Amended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'entered-in-error', label: 'Entered in error' },
]

const INTERPRETATION_OPTS = [
  { value: 'normal', label: 'Normal' },
  { value: 'abnormal', label: 'Abnormal' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'critical', label: 'Critical' },
]

const SPECIMEN_STATUS_OPTS = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'unsatisfactory', label: 'Unsatisfactory' },
  { value: 'entered-in-error', label: 'Entered in error' },
]

const REQUEST_STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const REQUEST_INTENT_OPTS = [
  { value: 'order', label: 'Order' },
  { value: 'plan', label: 'Plan' },
  { value: 'proposal', label: 'Proposal' },
]

// ---------------------------------------------------------------------------
// ResultRow — a single Test Result, nested inside a Test Group
// ---------------------------------------------------------------------------

function ResultRow({
  result,
  invTempId,
  groupTempId,
  dispatch,
}: {
  result: DraftInvestigationResult
  invTempId: string
  groupTempId: string
  dispatch: React.Dispatch<DraftAction>
}) {
  const upd = (updates: Partial<DraftInvestigationResult>) =>
    dispatch({
      type: 'UPDATE_TEST_RESULT',
      payload: { invTempId, groupTempId, resultTempId: result._tempId, updates },
    })

  return (
    <div className="border border-nhs-grey-5 dark:border-nhs-grey-4 rounded p-2 mb-1.5 bg-white dark:bg-gray-900">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-2">
        <SnomedPicker
          label="Result name"
          value={result.name ?? ''}
          code={result.snomedCode}
          semanticTag="observable entity"
          onChange={({ value, code }) => upd({ name: value, snomedCode: code })}
          required
        />
        <Field label="Comment" value={result.comment ?? ''} onChange={v => upd({ comment: v })} />
        <div className="flex gap-1">
          <Field label="Value" value={result.value ?? ''} onChange={v => upd({ value: v })} className="flex-1" />
          <Field label="Unit" value={result.unit ?? ''} onChange={v => upd({ unit: v })} className="w-20" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Ref range low" value={result.referenceRangeLow ?? ''} onChange={v => upd({ referenceRangeLow: v })} />
        <Field label="Ref range high" value={result.referenceRangeHigh ?? ''} onChange={v => upd({ referenceRangeHigh: v })} />
        <SelectField
          label="Interpretation"
          value={result.interpretation ?? ''}
          onChange={v => upd({ interpretation: v })}
          options={INTERPRETATION_OPTS}
          placeholder="— Select —"
        />
      </div>
      <div className="flex justify-end mt-1">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'REMOVE_TEST_RESULT',
              payload: { invTempId, groupTempId, resultTempId: result._tempId },
            })
          }
          className="text-nhs-red hover:opacity-70 p-0.5"
          title="Remove result"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TestGroupCard — a panel/battery of tests, holding one or more results
// ---------------------------------------------------------------------------

function TestGroupCard({
  group,
  invTempId,
  dispatch,
}: {
  group: DraftTestGroup
  invTempId: string
  dispatch: React.Dispatch<DraftAction>
}) {
  const upd = (updates: Partial<DraftTestGroup>) =>
    dispatch({ type: 'UPDATE_TEST_GROUP', payload: { invTempId, groupTempId: group._tempId, updates } })

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 overflow-hidden">
      <div className="p-3 bg-nhs-grey-5 dark:bg-gray-800 space-y-2">
        <div className="flex items-start gap-2">
          <SnomedPicker
            label="Test group name"
            value={group.name ?? ''}
            code={group.snomedCode}
            semanticTag="observable entity,procedure"
            onChange={({ value, code }) => upd({ name: value, snomedCode: code })}
            required
          />
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_TEST_GROUP', payload: { invTempId, groupTempId: group._tempId } })}
            className="text-nhs-red hover:opacity-70 p-1.5 mt-4 shrink-0"
            title="Remove test group"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <Field label="Comment" value={group.comment ?? ''} onChange={v => upd({ comment: v })} />
      </div>

      <div className="p-3 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
            Results ({group.results.length})
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_TEST_RESULT', payload: { invTempId, groupTempId: group._tempId } })}
            className="text-xs text-nhs-blue hover:underline"
          >
            + Add result
          </button>
        </div>
        {group.results.map(result => (
          <ResultRow
            key={result._tempId}
            result={result}
            invTempId={invTempId}
            groupTempId={group._tempId}
            dispatch={dispatch}
          />
        ))}
        {group.results.length === 0 && (
          <p className="text-xs text-nhs-grey-3">No results added yet.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InvestigationCard — the Test Report itself
// ---------------------------------------------------------------------------

export function InvestigationCard({
  inv,
  draft,
  dispatch,
  isModal,
}: {
  inv: DraftInvestigation
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftInvestigation>) =>
    dispatch({ type: 'UPDATE_INVESTIGATION', payload: { _tempId: inv._tempId, updates } })

  const resultCount = inv.testGroups.reduce((n, g) => n + g.results.length, 0)

  const body = (
    <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
      {/* No Associated Text here: DiagnosticReport has no free-text field for it in STU3 */}
      <SnomedPicker
        label="Report name"
        value={inv.name ?? ''}
        code={inv.snomedCode}
        semanticTag="observable entity"
        onChange={({ value, code }) => upd({ name: value, snomedCode: code })}
        required
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SelectField
          label="Status"
          value={inv.status ?? ''}
          onChange={v => upd({ status: v })}
          options={DIAG_STATUS_OPTS}
          placeholder="— Select —"
          required
        />
        <DateField label="Date" value={inv.date ?? ''} onChange={v => upd({ date: v })} required />
        <PractitionerSelect
          label="Performer"
          draft={draft}
          value={inv.performerTempId}
          onChange={v => upd({ performerTempId: v })}
          required
        />
      </div>

      <Field label="Comment" value={inv.comment ?? ''} onChange={v => upd({ comment: v })} />

      <FormSection title="Specimen" defaultOpen={false}>
        <div className="space-y-2">
          <SnomedPicker
            label="Specimen type"
            value={inv.specimenType ?? ''}
            code={inv.specimenSnomedCode}
            semanticTag="specimen"
            onChange={({ value, code }) => upd({ specimenType: value, specimenSnomedCode: code })}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DateField label="Collected" value={inv.specimenCollectedDate ?? ''} onChange={v => upd({ specimenCollectedDate: v })} />
            <DateField label="Received" value={inv.specimenReceivedDate ?? ''} onChange={v => upd({ specimenReceivedDate: v })} />
            <SelectField
              label="Status"
              value={inv.specimenStatus ?? ''}
              onChange={v => upd({ specimenStatus: v })}
              options={SPECIMEN_STATUS_OPTS}
              placeholder="— Select —"
            />
          </div>
          <Field label="Note" value={inv.specimenNote ?? ''} onChange={v => upd({ specimenNote: v })} />
        </div>
      </FormSection>

      <FormSection title="Test Request" defaultOpen={false}>
        <div className="space-y-2">
          <SnomedPicker
            label="Test requested"
            value={inv.testRequestName ?? ''}
            code={inv.testRequestSnomedCode}
            semanticTag="procedure,observable entity"
            onChange={({ value, code }) => upd({ testRequestName: value, testRequestSnomedCode: code })}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Status"
              value={inv.testRequestStatus ?? ''}
              onChange={v => upd({ testRequestStatus: v })}
              options={REQUEST_STATUS_OPTS}
              placeholder="— Select —"
            />
            <SelectField
              label="Intent"
              value={inv.testRequestIntent ?? ''}
              onChange={v => upd({ testRequestIntent: v })}
              options={REQUEST_INTENT_OPTS}
              placeholder="— Select —"
            />
          </div>
          <PractitionerSelect
            label="Requester"
            draft={draft}
            value={inv.testRequestRequesterTempId}
            onChange={v => upd({ testRequestRequesterTempId: v })}
          />
        </div>
      </FormSection>

      {/* Test groups */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
            Test groups ({inv.testGroups.length})
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_TEST_GROUP', payload: inv._tempId })}
            className="text-xs text-nhs-blue hover:underline"
          >
            + Add test group
          </button>
        </div>
        {inv.testGroups.map(group => (
          <TestGroupCard key={group._tempId} group={group} invTempId={inv._tempId} dispatch={dispatch} />
        ))}
        {inv.testGroups.length === 0 && (
          <p className="text-xs text-nhs-grey-3">No test groups added yet.</p>
        )}
      </div>

      <ConfidentialityCheckboxes
        confidential={inv.confidential}
        notForPfs={inv.notForPfs}
        onChange={upd}
      />

      <LinkSection
        draft={draft}
        linkedProblemTempIds={inv.linkedProblemTempIds ?? []}
        linkedConsultationTempId={inv.linkedConsultationTempId}
        onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
        onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
      />
    </div>
  )

  if (isModal) {
    return body
  }

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
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
            {inv.name || 'New investigation'}
          </span>
          {inv.date && <span className="text-xs text-nhs-grey-3">{isoToDisplay(inv.date)}</span>}
          <span className="text-xs text-nhs-grey-3">({resultCount} results)</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_INVESTIGATION', payload: inv._tempId })}
          className="text-nhs-red hover:opacity-70 p-0.5"
          title="Remove"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && body}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InvestigationDisplayRow
// ---------------------------------------------------------------------------

function invStatusBadge(status: string | undefined) {
  if (!status) return null
  const cfg =
    status === 'final'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : status === 'preliminary'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      : status === 'cancelled' || status === 'entered-in-error'
      ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
      : status === 'amended'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  const label = DIAG_STATUS_OPTS.find(o => o.value === status)?.label ?? status
  return (
    <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${cfg}`}>
      {label}
    </span>
  )
}

export function InvestigationDisplayRow({
  inv,
  onEdit,
  onDelete,
}: {
  inv: DraftInvestigation
  onEdit: () => void
  onDelete: () => void
}) {
  const resultCount = inv.testGroups.reduce((n, g) => n + g.results.length, 0)
  const meta = [
    inv.date,
    `${inv.testGroups.length} ${inv.testGroups.length === 1 ? 'group' : 'groups'}`,
    `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">
            {inv.name || 'New investigation'}
          </p>
          {invStatusBadge(inv.status)}
        </div>
        {meta && <p className="text-xs text-nhs-grey-3 mt-0.5">{meta}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs border border-nhs-blue text-nhs-blue px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">Edit</button>
        <button type="button" onClick={onDelete} className="text-nhs-red hover:opacity-70 p-0.5" title="Delete">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InvestigationForm
// ---------------------------------------------------------------------------

export function InvestigationForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  function handleAdd() {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_INVESTIGATION_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  function handleEdit(inv: DraftInvestigation) {
    const snap = structuredClone(draft)
    setModalState({ tempId: inv._tempId, snapshot: snap })
  }

  function handleDone() {
    setModalState(null)
  }

  function handleCancel() {
    if (modalState) {
      dispatch({ type: 'LOAD_DRAFT', payload: modalState.snapshot })
    }
    setModalState(null)
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_INVESTIGATION', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeInv = modalState
    ? draft.investigations.find(i => i._tempId === modalState.tempId)
    : null

  const deleteInv = deleteTarget
    ? draft.investigations.find(i => i._tempId === deleteTarget)
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Investigations</span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add investigation
        </button>
      </div>

      {draft.investigations.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No investigations added yet.</p>
      )}

      {draft.investigations.map(inv => (
        <InvestigationDisplayRow
          key={inv._tempId}
          inv={inv}
          onEdit={() => handleEdit(inv)}
          onDelete={() => setDeleteTarget(inv._tempId)}
        />
      ))}

      {modalState && activeInv && (
        <BuilderModal
          title={activeInv.name || 'Add Investigation'}
          onDone={handleDone}
          onCancel={handleCancel}
          size="lg"
        >
          <InvestigationCard
            inv={activeInv}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteInv?.name || 'this investigation'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
