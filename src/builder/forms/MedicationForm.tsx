import { useState } from 'react'
import type { DraftRecord, DraftMedication, DraftMedicationIssue } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { DateField, isoToDisplay } from './shared/DateField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { DmdPicker } from './shared/DmdPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'
import { ConfidentialityCheckboxes } from './shared/ConfidentialityCheckboxes'
import { TrashIcon, PencilIcon } from '../components/Icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROUTE_SUGGESTIONS = ['Oral', 'Topical', 'Rectal', 'Inhaled', 'Sublingual', 'Intramuscular', 'Intravenous', 'Subcutaneous', 'Transdermal', 'Nasal', 'Ocular', 'Otic', 'Vaginal']
const QTY_UNIT_SUGGESTIONS = ['tablet', 'capsule', 'ml', 'g', 'mg', 'patch', 'sachet', 'suppository', 'ampoule', 'vial', 'unit dose', 'drop', 'puff', 'application']
const DURATION_UNIT_SUGGESTIONS = ['day', 'days', 'week', 'weeks', 'month', 'months']
const STOP_REASON_SUGGESTIONS = ['Clinical decision', 'Course completed', 'Side effects', 'Patient request', 'Changed formulation', 'No longer required', 'Duplicate medication', 'Allergy identified']

// ---------------------------------------------------------------------------
// Repeat dispensing date helpers
// ---------------------------------------------------------------------------

function durationToDays(value: number, unit?: string): number {
  const u = (unit ?? 'days').toLowerCase()
  if (u === 'week' || u === 'weeks') return value * 7
  if (u === 'month' || u === 'months') return value * 30
  return value
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

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

function ReadOnlyField({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div>
      <label className="block text-xs font-medium text-nhs-grey-2 dark:text-gray-400 mb-0.5">{label}</label>
      <div className="w-full px-2.5 py-1.5 rounded border border-nhs-grey-4 dark:border-gray-600 bg-nhs-grey-5 dark:bg-gray-800 text-sm text-nhs-grey-2 dark:text-gray-400 min-h-[2rem]">
        {value !== undefined && value !== '' ? String(value) : <span className="text-nhs-grey-3 dark:text-gray-600 italic">—</span>}
      </div>
    </div>
  )
}

function IssueModal({
  issue,
  med,
  medTempId,
  dispatch,
  onDone,
  onCancel,
  title = 'Medication Issue',
}: {
  issue: DraftMedicationIssue
  med: DraftMedication
  medTempId: string
  dispatch: React.Dispatch<DraftAction>
  onDone: () => void
  onCancel: () => void
  title?: string
}) {
  const upd = (updates: Partial<DraftMedicationIssue>) =>
    dispatch({ type: 'UPDATE_MEDICATION_ISSUE', payload: { medTempId, issueTempId: issue._tempId, updates } })

  return (
    <BuilderModal title={title} onDone={onDone} onCancel={onCancel} size="md">
      <div className="space-y-3">
        {med.drugName && (
          <div className="px-3 py-2 rounded bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-gray-600">
            <p className="text-xs text-nhs-grey-3 dark:text-gray-500 uppercase tracking-wide mb-0.5">Drug</p>
            <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">{med.drugName}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <DateField
            label="Asserted date"
            value={issue.issueDate ?? ''}
            onChange={v => upd({ issueDate: v })}
            required
          />
          <DateField
            label="Start date"
            value={issue.startDate ?? ''}
            onChange={v => upd({ startDate: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="Quantity" value={med.prescribedQuantityValue} />
          <ReadOnlyField label="Quantity unit" value={med.prescribedQuantityUnit} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="Supply duration" value={med.supplyDurationValue} />
          <ReadOnlyField label="Duration unit" value={med.supplyDurationUnit} />
        </div>
        <ReadOnlyField label="Dosage instruction" value={med.dosageInstruction} />
        <Field
          label="Patient instructions"
          value={issue.patientInstructions ?? ''}
          onChange={v => upd({ patientInstructions: v })}
        />
        <Field
          label="Pharmacy instructions"
          value={issue.pharmacyInstructions ?? ''}
          onChange={v => upd({ pharmacyInstructions: v })}
        />
      </div>
    </BuilderModal>
  )
}

// ---------------------------------------------------------------------------
// RepeatDispensingIssueModal — collects asserted/start dates + instructions
//   for the whole batch; date cascade is computed on confirm, not per-issue
// ---------------------------------------------------------------------------

function RepeatDispensingIssueModal({
  med,
  onConfirm,
  onCancel,
}: {
  med: DraftMedication
  onConfirm: (assertedDate: string, startDate: string, patientInstructions: string, pharmacyInstructions: string) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [assertedDate, setAssertedDate] = useState(today)
  const [startDate, setStartDate] = useState(today)
  const [patientInstructions, setPatientInstructions] = useState('')
  const [pharmacyInstructions, setPharmacyInstructions] = useState('')
  const count = med.numberOfRepeatsAllowed ?? 0

  return (
    <BuilderModal
      title={`Issue all (${count})`}
      onDone={() => onConfirm(assertedDate, startDate, patientInstructions, pharmacyInstructions)}
      onCancel={onCancel}
      size="md"
    >
      <div className="space-y-3">
        {med.drugName && (
          <div className="px-3 py-2 rounded bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-gray-600">
            <p className="text-xs text-nhs-grey-3 dark:text-gray-500 uppercase tracking-wide mb-0.5">Drug</p>
            <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">{med.drugName}</p>
          </div>
        )}
        <div className="rounded border border-nhs-blue/30 dark:border-blue-700/50 bg-nhs-blue/5 dark:bg-blue-900/20 px-3 py-2 text-xs text-nhs-blue dark:text-blue-300">
          All {count} issues will be created with the dates and instructions below.
          Start dates are calculated automatically — each issue begins where the previous ends.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DateField label="Asserted date" value={assertedDate} onChange={setAssertedDate} required />
          <DateField label="Start date (issue 1)" value={startDate} onChange={setStartDate} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="Quantity" value={med.prescribedQuantityValue} />
          <ReadOnlyField label="Quantity unit" value={med.prescribedQuantityUnit} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="Supply duration" value={med.supplyDurationValue} />
          <ReadOnlyField label="Duration unit" value={med.supplyDurationUnit} />
        </div>
        <ReadOnlyField label="Dosage instruction" value={med.dosageInstruction} />
        <Field label="Patient instructions" value={patientInstructions} onChange={setPatientInstructions} />
        <Field label="Pharmacy instructions" value={pharmacyInstructions} onChange={setPharmacyInstructions} />
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
      <DmdPicker
        label="Drug name"
        value={med.drugName ?? ''}
        code={med.dmdCode}
        dmdType={med.dmdType ?? 'AMP'}
        onChange={({ value, code, dmdType }) => upd({
          drugName: value,
          dmdCode: code || undefined,
          dmdDisplay: code ? value : undefined,
          dmdType: code ? dmdType : undefined,
        })}
        required
      />
      <Field label="Associated text" value={med.associatedText ?? ''} onChange={v => upd({ associatedText: v })} />

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
        <Field label="Route" value={med.route ?? ''} onChange={v => upd({ route: v })} suggestions={ROUTE_SUGGESTIONS} />
      </div>

      <Field label="Dosage instruction" value={med.dosageInstruction ?? ''} onChange={v => upd({ dosageInstruction: v })} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Prescribed qty" type="number" value={med.prescribedQuantityValue ?? ''} onChange={v => upd({ prescribedQuantityValue: v ? Number(v) : undefined })} />
        <Field label="Qty unit" value={med.prescribedQuantityUnit ?? ''} onChange={v => upd({ prescribedQuantityUnit: v })} suggestions={QTY_UNIT_SUGGESTIONS} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Supply duration" type="number" value={med.supplyDurationValue ?? ''} onChange={v => upd({ supplyDurationValue: v ? Number(v) : undefined })} required={med.prescriptionType === 'repeat-dispensing'} />
        <Field label="Duration unit" value={med.supplyDurationUnit ?? ''} onChange={v => upd({ supplyDurationUnit: v })} suggestions={DURATION_UNIT_SUGGESTIONS} required={med.prescriptionType === 'repeat-dispensing'} />
        <div>
          <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">
            Repeats allowed{med.prescriptionType === 'repeat-dispensing' && <span className="text-nhs-red ml-0.5">*</span>}
          </label>
          {med.prescriptionType === 'acute' ? (
            <div className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm bg-nhs-grey-5 dark:bg-gray-800 text-nhs-grey-3 dark:text-gray-600 italic">
              N/A — acute
            </div>
          ) : (
            <input
              type="number"
              value={med.numberOfRepeatsAllowed ?? ''}
              onChange={e => upd({ numberOfRepeatsAllowed: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DateField label="Start date" value={med.startDate ?? ''} onChange={v => upd({ startDate: v })} />
        <DateField label="End date" value={med.endDate ?? ''} onChange={v => upd({ endDate: v })} />
      </div>

      <PractitionerSelect
        label="Prescriber"
        draft={draft}
        value={med.prescriberTempId}
        onChange={v => upd({ prescriberTempId: v })}
      />

      <Field label="Patient instructions" value={med.patientInstructions ?? ''} onChange={v => upd({ patientInstructions: v })} />
      <Field label="Pharmacy instructions" value={med.pharmacyInstructions ?? ''} onChange={v => upd({ pharmacyInstructions: v })} />

      <ConfidentialityCheckboxes
        confidential={med.confidential}
        notForPfs={med.notForPfs}
        onChange={upd}
      />

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
  const [issueModal, setIssueModal] = useState<{ issueTempId: string; snapshot: DraftRecord; mode: 'add' | 'edit' } | null>(null)
  const [showRdModal, setShowRdModal] = useState(false)
  const [confirmReauth, setConfirmReauth] = useState(false)
  const [confirmOverLimit, setConfirmOverLimit] = useState(false)
  const [confirmStop, setConfirmStop] = useState<string | null>(null)
  const [deleteIssueTarget, setDeleteIssueTarget] = useState<{ issueTempId: string; label: string } | null>(null)

  const status = med.status ?? ''
  const issues = med.issues ?? []
  const isStopped = status === 'stopped'
  const isReauthStopped = isStopped && med.stopReason === 'reauthorisation'
  const isRepeat = med.prescriptionType === 'repeat'
  const isRepeatDispensing = med.prescriptionType === 'repeat-dispensing'
  const maxIssues = (isRepeat || isRepeatDispensing) ? med.numberOfRepeatsAllowed : undefined
  const overLimit = isRepeat && maxIssues !== undefined && issues.length >= maxIssues
  const allIssued = isRepeatDispensing && maxIssues !== undefined && issues.length >= maxIssues
  const rdMissingData = isRepeatDispensing && (!med.numberOfRepeatsAllowed || !med.supplyDurationValue)

  const statusBadge = status ? (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
      status === 'stopped' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}>{isReauthStopped ? 'Stopped — Reauthorised' : status}</span>
  ) : null


  const qtyParts = [
    med.prescribedQuantityValue !== undefined ? String(med.prescribedQuantityValue) : null,
    med.prescribedQuantityUnit || null,
  ].filter(Boolean).join(' ')
  const supplyParts = [
    med.supplyDurationValue !== undefined ? String(med.supplyDurationValue) : null,
    med.supplyDurationUnit || null,
  ].filter(Boolean).join(' ')
  const prescriber = med.prescriberTempId
    ? draft.practitioners.find(p => p._tempId === med.prescriberTempId)
    : null
  const prescriberName = prescriber
    ? [prescriber.prefix, prescriber.givenName, prescriber.familyName].filter(Boolean).join(' ')
    : null

  const doAddIssue = () => {
    const issueTempId = newTempId()
    const snapshot = structuredClone(draft)
    const today = new Date().toISOString().split('T')[0]
    dispatch({
      type: 'ADD_MEDICATION_ISSUE_WITH_ID',
      payload: {
        medTempId: med._tempId,
        issueTempId,
        prefill: {
          issueDate: today,
          startDate: today,
          quantityValue: med.prescribedQuantityValue,
          quantityUnit: med.prescribedQuantityUnit,
          supplyDurationValue: med.supplyDurationValue,
          supplyDurationUnit: med.supplyDurationUnit,
          dosageInstruction: med.dosageInstruction,
        },
      },
    })
    setIssueModal({ issueTempId, snapshot, mode: 'add' })
  }

  const handleAddIssue = () => {
    if (overLimit) {
      setConfirmOverLimit(true)
    } else {
      doAddIssue()
    }
  }

  const handleIssueCancel = () => {
    if (issueModal) {
      dispatch({ type: 'LOAD_DRAFT', payload: issueModal.snapshot })
    }
    setIssueModal(null)
  }

  const handleIssueAll = () => setShowRdModal(true)

  const handleRdConfirm = (assertedDate: string, startDate: string, patientInstructions: string, pharmacyInstructions: string) => {
    const count = med.numberOfRepeatsAllowed!
    const durationDays = durationToDays(med.supplyDurationValue!, med.supplyDurationUnit)
    const allIssues: DraftMedicationIssue[] = []
    let start = startDate || assertedDate
    for (let i = 0; i < count; i++) {
      const end = addDays(start, durationDays)
      allIssues.push({
        _tempId: newTempId(),
        issueDate: assertedDate,
        startDate: start,
        endDate: end,
        quantityValue: med.prescribedQuantityValue,
        quantityUnit: med.prescribedQuantityUnit,
        supplyDurationValue: med.supplyDurationValue,
        supplyDurationUnit: med.supplyDurationUnit,
        dosageInstruction: med.dosageInstruction,
        ...(patientInstructions ? { patientInstructions } : {}),
        ...(pharmacyInstructions ? { pharmacyInstructions } : {}),
      })
      start = end
    }
    dispatch({ type: 'ADD_ALL_REPEAT_DISPENSING_ISSUES', payload: { medTempId: med._tempId, issues: allIssues } })
    setShowRdModal(false)
  }

  const handleReauthorise = () => {
    dispatch({ type: 'REAUTHORISE_MEDICATION', payload: { oldTempId: med._tempId, newTempId: newTempId() } })
    setConfirmReauth(false)
  }

  const handleStop = () => {
    if (!confirmStop?.trim()) return
    const today = new Date().toISOString().split('T')[0]
    dispatch({
      type: 'UPDATE_MEDICATION',
      payload: { _tempId: med._tempId, updates: { status: 'stopped', stopReason: confirmStop.trim(), endDate: today } },
    })
    setConfirmStop(null)
  }

  const activeIssue = issueModal
    ? (med.issues ?? []).find(i => i._tempId === issueModal.issueTempId)
    : null

  return (
    <div className={`border rounded-lg mb-2 overflow-hidden border-nhs-grey-4 dark:border-nhs-grey-2 ${isReauthStopped ? 'opacity-75' : ''}`}>
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
          {med.dosageInstruction && (
            <p className="text-xs text-nhs-grey-3 dark:text-gray-400 mt-0.5">
              <span className="opacity-70">Dosage instruction:</span> {med.dosageInstruction}
            </p>
          )}
          {(med.dose || med.frequency || med.route) && (
            <p className="text-xs text-nhs-grey-3 dark:text-gray-400 flex flex-wrap gap-x-3">
              {med.dose && <span><span className="opacity-70">Dose:</span> {med.dose}</span>}
              {med.frequency && <span><span className="opacity-70">Frequency:</span> {med.frequency}</span>}
              {med.route && <span><span className="opacity-70">Route:</span> {med.route}</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {(med.startDate || med.endDate) && (
              <span className="text-xs text-nhs-grey-3 dark:text-gray-400">
                {med.startDate && <><span className="opacity-70">Start:</span> {isoToDisplay(med.startDate)}</>}
                {med.endDate && <><span className="opacity-70 ml-1.5">End:</span> {isoToDisplay(med.endDate)}</>}
              </span>
            )}
            {qtyParts && (
              <span className="text-xs text-nhs-grey-3 dark:text-gray-400">
                <span className="opacity-70">Qty:</span> {qtyParts}
              </span>
            )}
            {supplyParts && (
              <span className="text-xs text-nhs-grey-3 dark:text-gray-400">
                <span className="opacity-70">Supply:</span> {supplyParts}
              </span>
            )}
            {isStopped && med.stopReason && med.stopReason !== 'reauthorisation' && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                <span className="opacity-70">Stopped:</span> {med.stopReason}
              </span>
            )}
            {prescriberName && (
              <span className="text-xs text-nhs-grey-3 dark:text-gray-400">
                <span className="opacity-70">Prescriber:</span> {prescriberName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isStopped && (
            <button
              onClick={() => setConfirmReauth(true)}
              className="text-xs border border-purple-400 dark:border-purple-600 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              Reauthorise
            </button>
          )}
          {!isStopped && (
            <button
              onClick={() => setConfirmStop('')}
              className="text-xs border border-amber-500 dark:border-amber-600 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Stop
            </button>
          )}
          <button
            onClick={onEdit}
            className="text-xs border border-nhs-blue text-nhs-blue px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Edit
          </button>
          <span className="w-px h-4 bg-nhs-grey-4 dark:bg-gray-600 mx-1 shrink-0" />
          <button
            onClick={onDelete}
            className="text-nhs-red hover:opacity-70 p-0.5"
            title="Delete medication"
          >
            <TrashIcon />
          </button>
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

      {/* Stop confirmation */}
      {confirmStop !== null && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 px-3 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-2 font-medium">
            Stop medication — please provide a reason:
          </p>
          <input
            type="text"
            list={`stop-reasons-${med._tempId}`}
            value={confirmStop}
            onChange={e => setConfirmStop(e.target.value)}
            placeholder="Reason for stopping…"
            autoFocus
            className="w-full rounded border border-amber-300 dark:border-amber-700 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-nhs-grey-1 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500 mb-2"
          />
          <datalist id={`stop-reasons-${med._tempId}`}>
            {STOP_REASON_SUGGESTIONS.map(r => <option key={r} value={r} />)}
          </datalist>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStop}
              disabled={!confirmStop.trim()}
              className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded hover:bg-amber-700 disabled:opacity-40"
            >
              Confirm stop
            </button>
            <button
              type="button"
              onClick={() => setConfirmStop(null)}
              className="text-xs text-nhs-grey-2 dark:text-gray-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Issues */}
      <div className="bg-white dark:bg-gray-900 px-3 py-2">
        {/* Issue counter summary */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium ${overLimit ? 'text-amber-600 dark:text-amber-400' : 'text-nhs-grey-3 dark:text-gray-500'}`}>
            {maxIssues !== undefined
              ? `${issues.length} of ${maxIssues} issued${overLimit ? ' — limit reached' : ''}`
              : `${issues.length} issued`}
          </span>
        </div>

        {issues.length > 0 && (
          <div className="mb-2 space-y-1">
            {issues.map((issue, idx) => {
              const isCancelled = issue.status === 'cancelled'
              return (
                <div
                  key={issue._tempId}
                  className={`flex items-center justify-between text-xs rounded px-2 py-1 ${
                    isCancelled
                      ? 'bg-nhs-grey-5 dark:bg-gray-800 text-nhs-grey-3 dark:text-gray-600 opacity-70'
                      : 'bg-nhs-grey-5 dark:bg-gray-800 text-nhs-grey-2 dark:text-gray-400'
                  }`}
                >
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${isCancelled ? 'line-through text-nhs-grey-3 dark:text-gray-600' : 'text-nhs-grey-1 dark:text-gray-300'}`}>
                      #{idx + 1}
                    </span>
                    {issue.issueDate && (
                      <span><span className="opacity-60">Asserted:</span> {isoToDisplay(issue.issueDate)}</span>
                    )}
                    {issue.startDate && (
                      <span><span className="opacity-60">Start:</span> {isoToDisplay(issue.startDate)}</span>
                    )}
                    {issue.endDate && (
                      <span><span className="opacity-60">End:</span> {isoToDisplay(issue.endDate)}</span>
                    )}
                    {isCancelled && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium text-[11px]">
                        Cancelled
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 ml-3 shrink-0">
                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => dispatch({
                          type: 'CANCEL_MEDICATION_ISSUE',
                          payload: { medTempId: med._tempId, issueTempId: issue._tempId, cascade: isRepeatDispensing },
                        })}
                        className="text-amber-600 dark:text-amber-400 hover:opacity-70 text-[11px] font-medium px-1"
                        title={isRepeatDispensing ? 'Cancel this and all subsequent issues' : 'Cancel issue'}
                      >
                        Cancel
                      </button>
                    )}
                    {!isCancelled && !isRepeatDispensing && (
                      <button
                        type="button"
                        onClick={() => {
                          const snapshot = structuredClone(draft)
                          setIssueModal({ issueTempId: issue._tempId, snapshot, mode: 'edit' })
                        }}
                        className="text-nhs-blue hover:opacity-70 p-0.5"
                        title="Edit issue"
                      >
                        <PencilIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteIssueTarget({ issueTempId: issue._tempId, label: `issue #${idx + 1}${med.drugName ? ` of ${med.drugName}` : ''}` })}
                      className="text-nhs-red hover:opacity-70 p-0.5"
                      title="Remove issue"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Over-limit confirmation */}
        {confirmOverLimit && (
          <div className="mb-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
            <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
              Maximum issues reached ({maxIssues}). Add an additional issue anyway?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setConfirmOverLimit(false); doAddIssue() }}
                className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded hover:bg-amber-700"
              >
                Add anyway
              </button>
              <button
                type="button"
                onClick={() => setConfirmOverLimit(false)}
                className="text-xs text-nhs-grey-2 dark:text-gray-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Repeat-dispensing footer */}
        {isRepeatDispensing && !isStopped && (
          allIssued ? (
            <p className="text-xs text-nhs-grey-3 dark:text-gray-500 italic">
              All {maxIssues} issues dispensed — reauthorise to issue again.
            </p>
          ) : rdMissingData ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Set number of issues and supply duration before issuing.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleIssueAll}
              className="text-xs bg-nhs-blue text-white px-2.5 py-1 rounded hover:opacity-90"
            >
              Issue all ({med.numberOfRepeatsAllowed})
            </button>
          )
        )}

        {/* Regular / acute / prescribed-elsewhere footer */}
        {!isRepeatDispensing && !isStopped && !confirmOverLimit && (
          <button
            type="button"
            onClick={handleAddIssue}
            className="text-xs text-nhs-blue hover:underline"
          >
            + Add issue
          </button>
        )}
      </div>

      {/* Issue modal (acute / repeat / prescribed-elsewhere — add or edit) */}
      {issueModal && activeIssue && (
        <IssueModal
          issue={activeIssue}
          med={med}
          medTempId={med._tempId}
          dispatch={dispatch}
          onDone={() => setIssueModal(null)}
          onCancel={handleIssueCancel}
          title={issueModal.mode === 'edit' ? 'Edit Issue' : 'Add Issue'}
        />
      )}

      {/* Repeat-dispensing batch issue modal */}
      {showRdModal && (
        <RepeatDispensingIssueModal
          med={med}
          onConfirm={handleRdConfirm}
          onCancel={() => setShowRdModal(false)}
        />
      )}

      {/* Issue delete confirmation */}
      {deleteIssueTarget && (
        <DeleteConfirmDialog
          label={deleteIssueTarget.label}
          onConfirm={() => {
            dispatch({ type: 'REMOVE_MEDICATION_ISSUE', payload: { medTempId: med._tempId, issueTempId: deleteIssueTarget.issueTempId } })
            setDeleteIssueTarget(null)
          }}
          onCancel={() => setDeleteIssueTarget(null)}
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
