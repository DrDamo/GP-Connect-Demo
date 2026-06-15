import { useState } from 'react'
import type { DraftRecord, DraftMedication, DraftMedicationIssue } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'
import { DmdPicker } from './shared/DmdPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'

// ---------------------------------------------------------------------------
// MedicationForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const PRESCRIPTION_TYPE_OPTS = [
  { value: 'acute', label: 'Acute' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'repeat-dispensing', label: 'Repeat dispensing' },
]

const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'stopped', label: 'Stopped' },
]

function IssueRow({
  issue,
  medTempId,
  dispatch,
}: {
  issue: DraftMedicationIssue
  medTempId: string
  dispatch: React.Dispatch<DraftAction>
}) {
  const upd = (updates: Partial<DraftMedicationIssue>) =>
    dispatch({ type: 'UPDATE_MEDICATION_ISSUE', payload: { medTempId, issueTempId: issue._tempId, updates } })

  return (
    <tr className="border-b border-nhs-grey-5 dark:border-nhs-grey-4 text-xs">
      <td className="py-1 pr-1">
        <input
          type="date"
          value={issue.issueDate ?? ''}
          onChange={e => upd({ issueDate: e.target.value })}
          className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-1 py-0.5 text-xs text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none"
        />
      </td>
      <td className="py-1 pr-1">
        <div className="flex gap-1">
          <input
            type="number"
            value={issue.quantityValue ?? ''}
            onChange={e => upd({ quantityValue: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="28"
            className="w-16 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-1 py-0.5 text-xs text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none"
          />
          <input
            type="text"
            value={issue.quantityUnit ?? ''}
            onChange={e => upd({ quantityUnit: e.target.value })}
            placeholder="tablet(s)"
            className="w-24 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-1 py-0.5 text-xs text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none"
          />
        </div>
      </td>
      <td className="py-1 pr-1">
        <div className="flex gap-1">
          <input
            type="number"
            value={issue.supplyDurationValue ?? ''}
            onChange={e => upd({ supplyDurationValue: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="28"
            className="w-12 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-1 py-0.5 text-xs text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none"
          />
          <input
            type="text"
            value={issue.supplyDurationUnit ?? ''}
            onChange={e => upd({ supplyDurationUnit: e.target.value })}
            placeholder="days"
            className="w-16 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-1 py-0.5 text-xs text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none"
          />
        </div>
      </td>
      <td className="py-1 text-right">
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_MEDICATION_ISSUE', payload: { medTempId, issueTempId: issue._tempId } })}
          className="text-nhs-red hover:opacity-70 text-xs transition-opacity"
        >
          Remove
        </button>
      </td>
    </tr>
  )
}

function MedicationCard({
  med,
  draft,
  dispatch,
  isModal,
}: {
  med: DraftMedication
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftMedication>) =>
    dispatch({ type: 'UPDATE_MEDICATION', payload: { _tempId: med._tempId, updates } })

  const issues = med.issues ?? []
  const expanded = isModal ? true : open

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
        {isModal ? (
          <span className="text-sm font-medium text-nhs-grey-1 flex-1">
            {med.drugName || 'New medication'}
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
              {med.drugName || 'New medication'}
            </span>
            {med.status && (
              <span className="text-xs text-nhs-grey-3">{med.status}</span>
            )}
          </button>
        )}
        {!isModal && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_MEDICATION', payload: med._tempId })}
            className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
          >
            Remove
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
          {/* Drug name */}
          <Field label="Drug name" value={med.drugName ?? ''} onChange={v => upd({ drugName: v })} required />

          {/* SNOMED picker — clinical code; selecting a concept also fills drug name */}
          <SnomedPicker
            code={med.snomedCode}
            display={med.drugName}
            semanticTag="product"
            onSelect={({ code, display }) => upd({
              snomedCode: code || undefined,
              ...(display ? { drugName: display } : {}),
            })}
          />

          {/* dm+d picker — prescribing code (VMP preferred; AMP for branded) */}
          <DmdPicker
            code={med.dmdCode}
            display={med.dmdDisplay}
            dmdType={med.dmdType ?? 'VMP'}
            onSelect={({ code, display, dmdType }) => upd({
              dmdCode: code || undefined,
              dmdDisplay: display || undefined,
              dmdType: code ? dmdType : undefined,
              ...(display && !med.drugName ? { drugName: display } : {}),
            })}
          />

          {/* Type + status */}
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Prescription type"
              value={med.prescriptionType ?? ''}
              onChange={v => upd({ prescriptionType: v as DraftMedication['prescriptionType'] })}
              options={PRESCRIPTION_TYPE_OPTS}
              placeholder="— Select —"
              required
            />
            <SelectField
              label="Status"
              value={med.status ?? ''}
              onChange={v => upd({ status: v })}
              options={STATUS_OPTS}
              placeholder="— Select —"
              required
            />
          </div>

          {/* Dose / frequency / route */}
          <div className="grid grid-cols-3 gap-2">
            <Field label="Dose" value={med.dose ?? ''} onChange={v => upd({ dose: v })} placeholder="500mg" />
            <Field label="Frequency" value={med.frequency ?? ''} onChange={v => upd({ frequency: v })} placeholder="twice daily" />
            <Field label="Route" value={med.route ?? ''} onChange={v => upd({ route: v })} placeholder="oral" />
          </div>

          {/* Dosage instruction */}
          <Field label="Dosage instruction" value={med.dosageInstruction ?? ''} onChange={v => upd({ dosageInstruction: v })} />

          {/* Quantity + repeats */}
          <div className="grid grid-cols-3 gap-2">
            <Field label="Prescribed qty" type="number" value={med.prescribedQuantityValue ?? ''} onChange={v => upd({ prescribedQuantityValue: v ? Number(v) : undefined })} />
            <Field label="Qty unit" value={med.prescribedQuantityUnit ?? ''} onChange={v => upd({ prescribedQuantityUnit: v })} placeholder="tablet(s)" />
            <Field label="Repeats allowed" type="number" value={med.numberOfRepeatsAllowed ?? ''} onChange={v => upd({ numberOfRepeatsAllowed: v ? Number(v) : undefined })} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start date" type="date" value={med.startDate ?? ''} onChange={v => upd({ startDate: v })} />
            <Field label="End date" type="date" value={med.endDate ?? ''} onChange={v => upd({ endDate: v })} />
          </div>

          {/* Prescriber */}
          <PractitionerSelect
            label="Prescriber"
            draft={draft}
            value={med.prescriberTempId}
            onChange={v => upd({ prescriberTempId: v })}
          />

          {/* Instructions */}
          <Field label="Patient instructions" value={med.patientInstructions ?? ''} onChange={v => upd({ patientInstructions: v })} />
          <Field label="Pharmacy instructions" value={med.pharmacyInstructions ?? ''} onChange={v => upd({ pharmacyInstructions: v })} />
          <Field label="Additional information" value={med.additionalInformation ?? ''} onChange={v => upd({ additionalInformation: v })} />

          {/* Issues sub-section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
                Medication issues ({issues.length})
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'ADD_MEDICATION_ISSUE', payload: med._tempId })}
                className="text-xs text-nhs-blue hover:underline"
              >
                + Add issue
              </button>
            </div>
            {issues.length > 0 && (
              <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-nhs-grey-5 dark:bg-gray-800 text-nhs-grey-2">
                      <th className="py-1.5 px-2 text-left font-medium">Issue date</th>
                      <th className="py-1.5 px-2 text-left font-medium">Quantity</th>
                      <th className="py-1.5 px-2 text-left font-medium">Duration</th>
                      <th className="py-1.5 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nhs-grey-5 dark:divide-nhs-grey-4">
                    {issues.map(issue => (
                      <IssueRow key={issue._tempId} issue={issue} medTempId={med._tempId} dispatch={dispatch} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <LinkSection
            draft={draft}
            linkedProblemTempIds={med.linkedProblemTempIds ?? []}
            linkedConsultationTempId={med.linkedConsultationTempId}
            onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
            onChangeConsultationLink={id => upd({ linkedConsultationTempId: id })}
          />
        </div>
      )}
    </div>
  )
}

function MedicationDisplayRow({
  med,
  onEdit,
  onDelete,
}: {
  med: DraftMedication
  onEdit: () => void
  onDelete: () => void
}) {
  const status = med.status ?? ''
  const prescriptionType = med.prescriptionType ?? ''

  const statusBadge = (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
      status === 'stopped' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}>{status || 'no status'}</span>
  )

  const typePill = prescriptionType ? (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
      prescriptionType === 'acute' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
      prescriptionType === 'repeat' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' :
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    }`}>{prescriptionType}</span>
  ) : null

  const doseParts = [med.dose, med.frequency, med.route].filter(Boolean).join(' · ')

  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">
            {med.drugName || 'Unnamed medication'}
          </span>
          {statusBadge}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {typePill}
          {doseParts && (
            <span className="text-xs text-nhs-grey-3">{doseParts}</span>
          )}
          {med.startDate && (
            <span className="text-xs text-nhs-grey-3">from {med.startDate}</span>
          )}
        </div>
      </div>
      <div className="flex items-center shrink-0">
        <button onClick={onEdit} className="text-xs text-nhs-blue hover:underline mr-3">Edit</button>
        <button onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
      </div>
    </div>
  )
}

export function MedicationForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_MEDICATION_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  const handleEdit = (med: DraftMedication) => {
    const snap = structuredClone(draft)
    setModalState({ tempId: med._tempId, snapshot: snap })
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
      dispatch({ type: 'REMOVE_MEDICATION', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeMed = modalState
    ? draft.medications.find(m => m._tempId === modalState.tempId)
    : null

  const deleteTargetMed = deleteTarget
    ? draft.medications.find(m => m._tempId === deleteTarget)
    : null

  const modalTitle = activeMed
    ? (activeMed.drugName ? `Edit: ${activeMed.drugName}` : 'Edit Medication')
    : 'Add Medication'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Medications</span>
        <button
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add medication
        </button>
      </div>

      {draft.medications.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No medications added yet.</p>
      )}

      {draft.medications.map(med => (
        <MedicationDisplayRow
          key={med._tempId}
          med={med}
          onEdit={() => handleEdit(med)}
          onDelete={() => setDeleteTarget(med._tempId)}
        />
      ))}

      {modalState && activeMed && (
        <BuilderModal title={modalTitle} onDone={handleDone} onCancel={handleCancel} size="xl">
          <MedicationCard
            med={activeMed}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

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
