import { useState } from 'react'
import type { DraftRecord, DraftMedication, DraftMedicationIssue } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { DmdPicker } from './shared/DmdPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESCRIPTION_TYPE_OPTS = [
  { value: 'acute', label: 'Acute' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'repeat-dispensing', label: 'Repeat dispensing' },
  { value: 'prescribed-elsewhere', label: 'Prescribed elsewhere' },
]

const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'stopped', label: 'Stopped' },
]

const SECTIONS: { key: DraftMedication['prescriptionType']; label: string }[] = [
  { key: 'acute', label: 'Acute' },
  { key: 'repeat', label: 'Repeat' },
  { key: 'repeat-dispensing', label: 'Repeat Dispensing' },
  { key: 'prescribed-elsewhere', label: 'Prescribed Elsewhere' },
]

// ---------------------------------------------------------------------------
// IssueModal — small modal for adding / editing a single medication issue
// ---------------------------------------------------------------------------

function IssueModal({
  issue,
  medTempId,
  dispatch,
  onDone,
  onCancel,
}: {
  issue: DraftMedicationIssue
  medTempId: string
  dispatch: React.Dispatch<DraftAction>
  onDone: () => void
  onCancel: () => void
}) {
  const upd = (updates: Partial<DraftMedicationIssue>) =>
    dispatch({ type: 'UPDATE_MEDICATION_ISSUE', payload: { medTempId, issueTempId: issue._tempId, updates } })

  return (
    <BuilderModal title="Medication Issue" onDone={onDone} onCancel={onCancel} size="md">
      <div className="space-y-3">
        <Field
          label="Issue date"
          type="date"
          value={issue.issueDate ?? ''}
          onChange={v => upd({ issueDate: v })}
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Quantity"
            type="number"
            value={issue.quantityValue ?? ''}
            onChange={v => upd({ quantityValue: v ? Number(v) : undefined })}
          />
          <Field
            label="Quantity unit"
            value={issue.quantityUnit ?? ''}
            onChange={v => upd({ quantityUnit: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Supply duration"
            type="number"
            value={issue.supplyDurationValue ?? ''}
            onChange={v => upd({ supplyDurationValue: v ? Number(v) : undefined })}
          />
          <Field
            label="Duration unit"
            value={issue.supplyDurationUnit ?? ''}
            onChange={v => upd({ supplyDurationUnit: v })}
          />
        </div>
        <Field
          label="Dosage instruction (override)"
          value={issue.dosageInstruction ?? ''}
          onChange={v => upd({ dosageInstruction: v })}
        />
      </div>
    </BuilderModal>
  )
}

// ---------------------------------------------------------------------------
// MedicationCard — drug details only (no issues), used inside the add/edit modal
// ---------------------------------------------------------------------------

function MedicationCard({
  med,
  draft,
  dispatch,
}: {
  med: DraftMedication
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const upd = (updates: Partial<DraftMedication>) =>
    dispatch({ type: 'UPDATE_MEDICATION', payload: { _tempId: med._tempId, updates } })

  return (
    <div className="space-y-3">
      <Field label="Drug name" value={med.drugName ?? ''} onChange={v => upd({ drugName: v })} required />

      <DmdPicker
        code={med.dmdCode}
        display={med.dmdDisplay}
        dmdType={med.dmdType ?? 'AMP'}
        onSelect={({ code, display, dmdType }) => upd({
          dmdCode: code || undefined,
          dmdDisplay: display || undefined,
          dmdType: code ? dmdType : undefined,
          ...(display && !med.drugName ? { drugName: display } : {}),
        })}
      />

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Prescription type"
          value={med.prescriptionType ?? ''}
          onChange={v => upd({ prescriptionType: v as DraftMedication['prescriptionType'] })}
          options={PRESCRIPTION_TYPE_OPTS}
          required
        />
        <SelectField
          label="Status"
          value={med.status ?? ''}
          onChange={v => upd({ status: v })}
          options={STATUS_OPTS}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Dose" value={med.dose ?? ''} onChange={v => upd({ dose: v })} />
        <Field label="Frequency" value={med.frequency ?? ''} onChange={v => upd({ frequency: v })} />
        <Field label="Route" value={med.route ?? ''} onChange={v => upd({ route: v })} />
      </div>

      <Field label="Dosage instruction" value={med.dosageInstruction ?? ''} onChange={v => upd({ dosageInstruction: v })} />

      <div className="grid grid-cols-3 gap-2">
        <Field label="Prescribed qty" type="number" value={med.prescribedQuantityValue ?? ''} onChange={v => upd({ prescribedQuantityValue: v ? Number(v) : undefined })} />
        <Field label="Qty unit" value={med.prescribedQuantityUnit ?? ''} onChange={v => upd({ prescribedQuantityUnit: v })} />
        <Field label="Repeats allowed" type="number" value={med.numberOfRepeatsAllowed ?? ''} onChange={v => upd({ numberOfRepeatsAllowed: v ? Number(v) : undefined })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Start date" type="date" value={med.startDate ?? ''} onChange={v => upd({ startDate: v })} />
        <Field label="End date" type="date" value={med.endDate ?? ''} onChange={v => upd({ endDate: v })} />
      </div>

      <PractitionerSelect
        label="Prescriber"
        draft={draft}
        value={med.prescriberTempId}
        onChange={v => upd({ prescriberTempId: v })}
      />

      <Field label="Patient instructions" value={med.patientInstructions ?? ''} onChange={v => upd({ patientInstructions: v })} />
      <Field label="Pharmacy instructions" value={med.pharmacyInstructions ?? ''} onChange={v => upd({ pharmacyInstructions: v })} />
      <Field label="Additional information" value={med.additionalInformation ?? ''} onChange={v => upd({ additionalInformation: v })} />

      <LinkSection
        draft={draft}
        linkedProblemTempIds={med.linkedProblemTempIds ?? []}
        linkedConsultationTempId={med.linkedConsultationTempId}
        onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
        onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MedicationDisplayRow — medication row with issues list and Add Issue button
// ---------------------------------------------------------------------------

function MedicationDisplayRow({
  med,
  draft,
  dispatch,
  onEdit,
  onDelete,
}: {
  med: DraftMedication
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  onEdit: () => void
  onDelete: () => void
}) {
  const [issueModal, setIssueModal] = useState<{ issueTempId: string; snapshot: DraftRecord } | null>(null)
  const [confirmReauth, setConfirmReauth] = useState(false)

  const status = med.status ?? ''
  const issues = med.issues ?? []
  const isStopped = status === 'stopped'
  const isReauthStopped = isStopped && med.stopReason === 'reauthorisation'

  const statusBadge = status ? (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
      status === 'stopped' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}>{isReauthStopped ? 'Stopped — Reauthorised' : status}</span>
  ) : null

  const doseParts = [med.dose, med.frequency, med.route].filter(Boolean).join(' · ')

  const handleAddIssue = () => {
    const issueTempId = newTempId()
    const snapshot = structuredClone(draft)
    dispatch({ type: 'ADD_MEDICATION_ISSUE_WITH_ID', payload: { medTempId: med._tempId, issueTempId } })
    setIssueModal({ issueTempId, snapshot })
  }

  const handleIssueCancel = () => {
    if (issueModal) {
      dispatch({ type: 'LOAD_DRAFT', payload: issueModal.snapshot })
    }
    setIssueModal(null)
  }

  const handleReauthorise = () => {
    dispatch({ type: 'REAUTHORISE_MEDICATION', payload: { oldTempId: med._tempId, newTempId: newTempId() } })
    setConfirmReauth(false)
  }

  const activeIssue = issueModal
    ? (med.issues ?? []).find(i => i._tempId === issueModal.issueTempId)
    : null

  return (
    <div className={`border rounded-lg mb-2 overflow-hidden ${isReauthStopped ? 'border-amber-200 dark:border-amber-800 opacity-75' : 'border-nhs-grey-4 dark:border-nhs-grey-2'}`}>
      {/* Medication header row */}
      <div className="bg-nhs-grey-5 dark:bg-gray-800 px-3 py-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">
              {med.drugName || 'Unnamed medication'}
            </span>
            {statusBadge}
            {med.reauthorisedFromTempId && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                ↑ Reauthorisation
              </span>
            )}
          </div>
          {doseParts && (
            <p className="text-xs text-nhs-grey-3 dark:text-gray-400 mt-0.5">{doseParts}</p>
          )}
          {med.startDate && (
            <p className="text-xs text-nhs-grey-3 dark:text-gray-400">from {med.startDate}{med.endDate ? ` to ${med.endDate}` : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!isStopped && (
            <button onClick={() => setConfirmReauth(true)} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">
              Reauthorise
            </button>
          )}
          <button onClick={onEdit} className="text-xs text-nhs-blue hover:underline">Edit</button>
          <button onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
        </div>
      </div>

      {/* Reauthorise confirmation */}
      {confirmReauth && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border-t border-purple-200 dark:border-purple-800 px-3 py-2 flex items-center justify-between gap-2">
          <p className="text-xs text-purple-800 dark:text-purple-200">
            This will stop the current authorisation and create a new one from today. Continue?
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReauthorise}
              className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded hover:bg-purple-700"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmReauth(false)}
              className="text-xs text-nhs-grey-2 dark:text-gray-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Issues */}
      <div className="bg-white dark:bg-gray-900 px-3 py-2">
        {issues.length > 0 && (
          <div className="mb-2 space-y-1">
            {issues.map(issue => (
              <div
                key={issue._tempId}
                className="flex items-center justify-between text-xs text-nhs-grey-2 dark:text-gray-400 bg-nhs-grey-5 dark:bg-gray-800 rounded px-2 py-1"
              >
                <span>
                  {issue.issueDate ?? 'No date'}
                  {issue.quantityValue ? ` · ${issue.quantityValue} ${issue.quantityUnit ?? ''}`.trimEnd() : ''}
                  {issue.supplyDurationValue ? ` · ${issue.supplyDurationValue} ${issue.supplyDurationUnit ?? ''}`.trimEnd() : ''}
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'REMOVE_MEDICATION_ISSUE', payload: { medTempId: med._tempId, issueTempId: issue._tempId } })}
                  className="text-nhs-red hover:opacity-70 ml-3"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={handleAddIssue}
          className="text-xs text-nhs-blue hover:underline"
        >
          + Add issue
        </button>
        {issues.length > 0 && (
          <span className="text-xs text-nhs-grey-3 dark:text-gray-500 ml-2">
            ({issues.length} issue{issues.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* Issue modal */}
      {issueModal && activeIssue && (
        <IssueModal
          issue={activeIssue}
          medTempId={med._tempId}
          dispatch={dispatch}
          onDone={() => setIssueModal(null)}
          onCancel={handleIssueCancel}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MedicationSection — always-visible section for one prescription type
// ---------------------------------------------------------------------------

function MedicationSection({
  label,
  meds,
  draft,
  dispatch,
  onEdit,
  onDelete,
}: {
  label: string
  meds: DraftMedication[]
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  onEdit: (med: DraftMedication) => void
  onDelete: (medTempId: string) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-xs font-semibold text-nhs-grey-2 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </h4>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-nhs-grey-4 dark:bg-gray-700 text-nhs-grey-2 dark:text-gray-400">
          {meds.length}
        </span>
      </div>
      {meds.length === 0 ? (
        <p className="text-xs text-nhs-grey-3 dark:text-gray-500 italic pl-1">No {label.toLowerCase()} medications</p>
      ) : (
        meds.map(med => (
          <MedicationDisplayRow
            key={med._tempId}
            med={med}
            draft={draft}
            dispatch={dispatch}
            onEdit={() => onEdit(med)}
            onDelete={() => onDelete(med._tempId)}
          />
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MedicationForm — main exported component
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const PAST_STATUSES = new Set(['stopped', 'completed'])
const isActive = (m: DraftMedication) => !PAST_STATUSES.has(m.status ?? '')
const isPast = (m: DraftMedication) => PAST_STATUSES.has(m.status ?? '')

export function MedicationForm({ draft, dispatch }: Props) {
  const [tab, setTab] = useState<'active' | 'past'>('active')
  const [drugModal, setDrugModal] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const tabFilter = tab === 'active' ? isActive : isPast

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_MEDICATION_WITH_ID', payload: id })
    setDrugModal({ tempId: id, snapshot: snap })
  }

  const handleEdit = (med: DraftMedication) => {
    const snap = structuredClone(draft)
    setDrugModal({ tempId: med._tempId, snapshot: snap })
  }

  const handleDrugCancel = () => {
    if (drugModal) {
      dispatch({ type: 'LOAD_DRAFT', payload: drugModal.snapshot })
    }
    setDrugModal(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      dispatch({ type: 'REMOVE_MEDICATION', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeMed = drugModal
    ? draft.medications.find(m => m._tempId === drugModal.tempId)
    : null

  const deleteTargetMed = deleteTarget
    ? draft.medications.find(m => m._tempId === deleteTarget)
    : null

  const modalTitle = activeMed
    ? (activeMed.drugName ? `Edit: ${activeMed.drugName}` : 'Edit Medication')
    : 'Add Medication'

  const activeCount = draft.medications.filter(isActive).length
  const pastCount = draft.medications.filter(isPast).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Medications</span>
        {tab === 'active' && (
          <button
            onClick={handleAdd}
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add medication
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-nhs-grey-4 dark:border-gray-700 mb-4">
        {(['active', 'past'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-nhs-blue text-nhs-blue dark:text-blue-300 dark:border-blue-300'
                : 'border-transparent text-nhs-grey-2 dark:text-gray-400 hover:text-nhs-grey-1 dark:hover:text-gray-200'
            }`}
          >
            {t === 'active' ? 'Active' : 'Past'}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t
                ? 'bg-nhs-blue/10 dark:bg-blue-900/30 text-nhs-blue dark:text-blue-300'
                : 'bg-nhs-grey-4 dark:bg-gray-700 text-nhs-grey-3 dark:text-gray-500'
            }`}>
              {t === 'active' ? activeCount : pastCount}
            </span>
          </button>
        ))}
      </div>

      {/* Sections filtered by tab */}
      {SECTIONS.map(({ key, label }) => (
        <MedicationSection
          key={key}
          label={label}
          meds={draft.medications.filter(m => m.prescriptionType === key && tabFilter(m))}
          draft={draft}
          dispatch={dispatch}
          onEdit={handleEdit}
          onDelete={id => setDeleteTarget(id)}
        />
      ))}

      {/* Unclassified — only shown when there are some in this tab */}
      {draft.medications.some(m => !m.prescriptionType && tabFilter(m)) && (
        <MedicationSection
          key="unclassified"
          label="Unclassified"
          meds={draft.medications.filter(m => !m.prescriptionType && tabFilter(m))}
          draft={draft}
          dispatch={dispatch}
          onEdit={handleEdit}
          onDelete={id => setDeleteTarget(id)}
        />
      )}

      {/* Drug detail modal */}
      {drugModal && activeMed && (
        <BuilderModal title={modalTitle} onDone={() => setDrugModal(null)} onCancel={handleDrugCancel} size="xl">
          <MedicationCard med={activeMed} draft={draft} dispatch={dispatch} />
        </BuilderModal>
      )}

      {/* Delete confirmation */}
      {deleteTarget && deleteTargetMed && (
        <DeleteConfirmDialog
          label={deleteTargetMed.drugName || 'this medication'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
