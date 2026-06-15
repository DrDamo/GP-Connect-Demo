import { useState } from 'react'
import type { DraftRecord, DraftImmunisation } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { NotesList } from './shared/NotesList'
import { SnomedPicker } from './shared/SnomedPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'

// ---------------------------------------------------------------------------
// ImmunisationForm
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const STATUS_OPTS = [
  { value: 'completed', label: 'Completed' },
  { value: 'entered-in-error', label: 'Entered in error' },
  { value: 'not-done', label: 'Not done' },
]

const SELECT_CLS =
  'w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
  'text-nhs-grey-1 dark:bg-gray-800 ' +
  'focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'

// ---------------------------------------------------------------------------
// ImmunisationCard
// ---------------------------------------------------------------------------

function ImmunisationCard({
  imm,
  draft,
  dispatch,
  isModal,
}: {
  imm: DraftImmunisation
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftImmunisation>) =>
    dispatch({ type: 'UPDATE_IMMUNISATION', payload: { _tempId: imm._tempId, updates } })

  const locationOptions = [
    { value: '', label: '— None —' },
    ...draft.locations.map(l => ({ value: l._tempId, label: l.name || 'Unnamed location' })),
  ]

  const body = (
    <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
      <Field label="Vaccine name" value={imm.vaccineName ?? ''} onChange={v => upd({ vaccineName: v })} required />
      <SnomedPicker
        code={imm.snomedCode}
        display={imm.vaccineName}
        semanticTag="product"
        onSelect={({ code, display }) => upd({
          snomedCode: code || undefined,
          ...(display ? { vaccineName: display } : {}),
        })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Vaccination procedure code" value={imm.vaccinationProcedureCode ?? ''} onChange={v => upd({ vaccinationProcedureCode: v })} />
        <Field label="Vaccination procedure display" value={imm.vaccinationProcedureDisplay ?? ''} onChange={v => upd({ vaccinationProcedureDisplay: v })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Date given" type="date" value={imm.dateGiven ?? ''} onChange={v => upd({ dateGiven: v })} required />
        <Field label="Date recorded" type="date" value={imm.dateRecorded ?? ''} onChange={v => upd({ dateRecorded: v })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Status"
          value={imm.status ?? ''}
          onChange={v => upd({ status: v })}
          options={STATUS_OPTS}
          placeholder="— Select —"
          required
        />
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-1.5 text-xs text-nhs-grey-2">
            <input
              type="checkbox"
              checked={imm.notGiven ?? false}
              onChange={e => upd({ notGiven: e.target.checked })}
              className="rounded"
            />
            Not given
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Site" value={imm.site ?? ''} onChange={v => upd({ site: v })} placeholder="Left arm" />
        <Field label="Route" value={imm.route ?? ''} onChange={v => upd({ route: v })} placeholder="Subcutaneous" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Batch number" value={imm.batchNumber ?? ''} onChange={v => upd({ batchNumber: v })} />
        <Field label="Expiration date" type="date" value={imm.expirationDate ?? ''} onChange={v => upd({ expirationDate: v })} />
      </div>

      <PractitionerSelect
        label="Administering practitioner"
        draft={draft}
        value={imm.administeringPractitionerTempId}
        onChange={v => upd({ administeringPractitionerTempId: v })}
      />

      <PractitionerSelect
        label="Entering practitioner"
        draft={draft}
        value={imm.enteringPractitionerTempId}
        onChange={v => upd({ enteringPractitionerTempId: v })}
      />

      <div>
        <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">
          Location
        </label>
        <select
          value={imm.locationTempId ?? ''}
          onChange={e => upd({ locationTempId: e.target.value || undefined })}
          className={SELECT_CLS}
        >
          {locationOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <NotesList
        notes={imm.notes ?? []}
        onChange={notes => upd({ notes })}
      />
      <LinkSection
        draft={draft}
        linkedProblemTempIds={imm.linkedProblemTempIds ?? []}
        linkedConsultationTempId={imm.linkedConsultationTempId}
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
            {imm.vaccineName || 'New immunisation'}
          </span>
          {imm.dateGiven && (
            <span className="text-xs text-nhs-grey-3">{imm.dateGiven}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_IMMUNISATION', payload: imm._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && body}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImmunisationDisplayRow
// ---------------------------------------------------------------------------

function statusBadge(status: string | undefined) {
  if (!status) return null
  const cfg =
    status === 'completed'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  const label = STATUS_OPTS.find(o => o.value === status)?.label ?? status
  return (
    <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${cfg}`}>
      {label}
    </span>
  )
}

function ImmunisationDisplayRow({
  imm,
  onEdit,
  onDelete,
}: {
  imm: DraftImmunisation
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = [imm.dateGiven, [imm.site, imm.route].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')

  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">
            {imm.vaccineName || 'New immunisation'}
          </p>
          {statusBadge(imm.status)}
        </div>
        {meta && <p className="text-xs text-nhs-grey-3 mt-0.5">{meta}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs text-nhs-blue hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImmunisationForm
// ---------------------------------------------------------------------------

export function ImmunisationForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  function handleAdd() {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_IMMUNISATION_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  function handleEdit(imm: DraftImmunisation) {
    const snap = structuredClone(draft)
    setModalState({ tempId: imm._tempId, snapshot: snap })
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
      dispatch({ type: 'REMOVE_IMMUNISATION', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeImm = modalState
    ? draft.immunisations.find(i => i._tempId === modalState.tempId)
    : null

  const deleteImm = deleteTarget
    ? draft.immunisations.find(i => i._tempId === deleteTarget)
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Immunisations</span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add immunisation
        </button>
      </div>

      {draft.immunisations.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No immunisations added yet.</p>
      )}

      {draft.immunisations.map(imm => (
        <ImmunisationDisplayRow
          key={imm._tempId}
          imm={imm}
          onEdit={() => handleEdit(imm)}
          onDelete={() => setDeleteTarget(imm._tempId)}
        />
      ))}

      {modalState && activeImm && (
        <BuilderModal
          title={activeImm.vaccineName || 'Add Immunisation'}
          onDone={handleDone}
          onCancel={handleCancel}
          size="lg"
        >
          <ImmunisationCard
            imm={activeImm}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteImm?.vaccineName || 'this immunisation'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
