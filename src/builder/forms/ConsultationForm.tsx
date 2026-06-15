import { useState } from 'react'
import type {
  DraftRecord,
  DraftConsultation,
  DraftConsultationTopic,
  DraftConsultationCategory,
  DraftConsultationItem,
  DraftConsultationItemType,
} from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'

// ---------------------------------------------------------------------------
// ConsultationForm — three-level nested structure
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}

const ENCOUNTER_CLASS_OPTS = [
  { value: 'AMB', label: 'Ambulatory (AMB)' },
  { value: 'HH', label: 'Home health (HH)' },
  { value: 'IMP', label: 'Inpatient (IMP)' },
]

const ITEM_TYPE_OPTS = [
  { value: 'note', label: 'Note' },
  { value: 'linked', label: 'Linked item' },
  { value: 'coded', label: 'Coded observation' },
]

const CATEGORY_TITLE_OPTS = [
  { value: 'History', label: 'History' },
  { value: 'Examination', label: 'Examination' },
  { value: 'Assessment', label: 'Assessment' },
  { value: 'Plan', label: 'Plan' },
  { value: 'Other', label: 'Other' },
]

// ---------------------------------------------------------------------------
// ConsultationItem
// ---------------------------------------------------------------------------

function ConsultationItemRow({
  item,
  consTempId,
  topicTempId,
  catTempId,
  dispatch,
}: {
  item: DraftConsultationItem
  consTempId: string
  topicTempId: string
  catTempId?: string
  dispatch: React.Dispatch<DraftAction>
}) {
  const upd = (updates: Partial<DraftConsultationItem>) =>
    dispatch({
      type: 'UPDATE_CONSULTATION_ITEM',
      payload: { consTempId, topicTempId, catTempId, itemTempId: item._tempId, updates },
    })

  return (
    <div className="border border-nhs-grey-5 dark:border-nhs-grey-4 rounded p-2 mb-1 bg-white dark:bg-gray-900">
      <div className="flex items-start gap-2">
        <div className="w-36 shrink-0">
          <SelectField
            label="Type"
            value={item.itemType}
            onChange={v => upd({ itemType: v as DraftConsultationItemType })}
            options={ITEM_TYPE_OPTS}
          />
        </div>
        <div className="flex-1 space-y-1">
          {item.itemType === 'note' && (
            <div>
              <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">
                Narrative text
              </label>
              <textarea
                value={item.narrativeText ?? ''}
                onChange={e => upd({ narrativeText: e.target.value })}
                rows={2}
                placeholder="Enter clinical narrative…"
                className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue resize-none"
              />
            </div>
          )}
          {item.itemType === 'linked' && (
            <Field
              label="Linked resource type"
              value={item.linkedResourceType ?? ''}
              onChange={v => upd({ linkedResourceType: v })}
              placeholder="MedicationStatement"
            />
          )}
          {item.itemType === 'coded' && (
            <div className="grid grid-cols-3 gap-1">
              <Field label="SNOMED code" value={item.snomedCode ?? ''} onChange={v => upd({ snomedCode: v })} placeholder="386661006" />
              <Field label="Description" value={item.description ?? ''} onChange={v => upd({ description: v })} />
              <Field label="Value" value={item.value ?? ''} onChange={v => upd({ value: v })} placeholder="37.5" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'REMOVE_CONSULTATION_ITEM',
              payload: { consTempId, topicTempId, catTempId, itemTempId: item._tempId },
            })
          }
          className="shrink-0 text-nhs-red hover:opacity-70 text-xs transition-opacity pt-5"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConsultationCategory
// ---------------------------------------------------------------------------

function CategoryBlock({
  cat,
  consTempId,
  topicTempId,
  dispatch,
}: {
  cat: DraftConsultationCategory
  consTempId: string
  topicTempId: string
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded mb-1.5 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 bg-nhs-grey-5 dark:bg-gray-800">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 flex-1 text-left">
          <svg
            className={`w-3 h-3 text-nhs-grey-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-xs font-medium text-nhs-grey-2">
            {cat.title || 'Category'}
          </span>
          <span className="text-xs text-nhs-grey-3">({cat.items.length} items)</span>
        </button>
        <div className="flex items-center gap-2">
          <select
            value={cat.title ?? ''}
            onChange={e =>
              dispatch({
                type: 'UPDATE_CONSULTATION_CATEGORY',
                payload: { consTempId, topicTempId, catTempId: cat._tempId, updates: { title: e.target.value } },
              })
            }
            className="text-xs text-nhs-grey-1 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-1 py-0.5 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none"
          >
            <option value="">— Category —</option>
            {CATEGORY_TITLE_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'REMOVE_CONSULTATION_CATEGORY',
                payload: { consTempId, topicTempId, catTempId: cat._tempId },
              })
            }
            className="text-nhs-red text-xs hover:opacity-70 transition-opacity"
          >
            Remove
          </button>
        </div>
      </div>

      {open && (
        <div className="p-2 bg-white dark:bg-gray-900">
          {cat.items.map(item => (
            <ConsultationItemRow
              key={item._tempId}
              item={item}
              consTempId={consTempId}
              topicTempId={topicTempId}
              catTempId={cat._tempId}
              dispatch={dispatch}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'ADD_CONSULTATION_ITEM',
                payload: { consTempId, topicTempId, catTempId: cat._tempId },
              })
            }
            className="text-xs text-nhs-blue hover:underline mt-0.5"
          >
            + Add item
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConsultationTopic
// ---------------------------------------------------------------------------

function TopicBlock({
  topic,
  consTempId,
  dispatch,
}: {
  topic: DraftConsultationTopic
  consTempId: string
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 text-left">
          <svg
            className={`w-3.5 h-3.5 text-nhs-grey-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-medium text-nhs-grey-1">
            {topic.title || 'Topic'}
          </span>
          <span className="text-xs text-nhs-grey-3">
            ({topic.categories.length} categories, {topic.items.length} direct items)
          </span>
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({ type: 'REMOVE_CONSULTATION_TOPIC', payload: { consTempId, topicTempId: topic._tempId } })
          }
          className="text-nhs-red text-xs hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 space-y-2">
          <Field
            label="Topic title"
            value={topic.title ?? ''}
            onChange={v =>
              dispatch({
                type: 'UPDATE_CONSULTATION_TOPIC',
                payload: { consTempId, topicTempId: topic._tempId, updates: { title: v } },
              })
            }
            placeholder="e.g. Type 2 diabetes review"
          />

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
                Categories
              </span>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: 'ADD_CONSULTATION_CATEGORY', payload: { consTempId, topicTempId: topic._tempId } })
                }
                className="text-xs text-nhs-blue hover:underline"
              >
                + Add category
              </button>
            </div>
            {topic.categories.map(cat => (
              <CategoryBlock
                key={cat._tempId}
                cat={cat}
                consTempId={consTempId}
                topicTempId={topic._tempId}
                dispatch={dispatch}
              />
            ))}
          </div>

          {/* Direct topic items (no category) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
                Topic-level items
              </span>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: 'ADD_CONSULTATION_ITEM', payload: { consTempId, topicTempId: topic._tempId } })
                }
                className="text-xs text-nhs-blue hover:underline"
              >
                + Add item
              </button>
            </div>
            {topic.items.map(item => (
              <ConsultationItemRow
                key={item._tempId}
                item={item}
                consTempId={consTempId}
                topicTempId={topic._tempId}
                dispatch={dispatch}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConsultationCard
// ---------------------------------------------------------------------------

function ConsultationCard({
  consultation,
  draft,
  dispatch,
  isModal,
}: {
  consultation: DraftConsultation
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftConsultation>) =>
    dispatch({ type: 'UPDATE_CONSULTATION', payload: { _tempId: consultation._tempId, updates } })

  const label = consultation.date
    ? `${consultation.date}${consultation.typeDisplay ? ' — ' + consultation.typeDisplay : ''}`
    : consultation.typeDisplay || 'New consultation'

  const body = (
    <div className="p-3 bg-white dark:bg-gray-900 space-y-3">
      {/* Header fields */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Date" type="date" value={consultation.date ?? ''} onChange={v => upd({ date: v })} required />
        <Field label="End date" type="date" value={consultation.endDate ?? ''} onChange={v => upd({ endDate: v })} />
        <Field
          label="Type"
          value={consultation.typeDisplay ?? ''}
          onChange={v => upd({ typeDisplay: v })}
          placeholder="Face to face consultation"
          className="col-span-2"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PractitionerSelect
          label="Clinician"
          draft={draft}
          value={consultation.clinicianTempId}
          onChange={v => upd({ clinicianTempId: v })}
        />
        <SelectField
          label="Encounter class"
          value={consultation.encounterClass ?? ''}
          onChange={v => upd({ encounterClass: v })}
          options={ENCOUNTER_CLASS_OPTS}
          placeholder="— Select —"
        />
      </div>

      {/* Topics */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
            Topics
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_CONSULTATION_TOPIC', payload: consultation._tempId })}
            className="text-xs text-nhs-blue hover:underline"
          >
            + Add topic
          </button>
        </div>
        {consultation.topics.length === 0 && (
          <p className="text-xs text-nhs-grey-3">No topics yet — add one above.</p>
        )}
        {consultation.topics.map(topic => (
          <TopicBlock
            key={topic._tempId}
            topic={topic}
            consTempId={consultation._tempId}
            dispatch={dispatch}
          />
        ))}
      </div>
      <LinkSection
        draft={draft}
        linkedProblemTempIds={consultation.linkedProblemTempIds ?? []}
        onChangeProblemLinks={ids => upd({ linkedProblemTempIds: ids })}
      />
    </div>
  )

  if (isModal) {
    return body
  }

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-3">
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 text-left">
          <svg
            className={`w-3.5 h-3.5 text-nhs-grey-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-medium text-nhs-grey-1">{label}</span>
          <span className="text-xs text-nhs-grey-3">({consultation.topics.length} topics)</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_CONSULTATION', payload: consultation._tempId })}
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
// ConsultationDisplayRow
// ---------------------------------------------------------------------------

function ConsultationDisplayRow({
  consultation,
  draft,
  onEdit,
  onDelete,
}: {
  consultation: DraftConsultation
  draft: DraftRecord
  onEdit: () => void
  onDelete: () => void
}) {
  const practitioner = draft.practitioners.find(p => p._tempId === consultation.clinicianTempId)
  const clinicianName = practitioner
    ? [practitioner.prefix, practitioner.givenName, practitioner.familyName].filter(Boolean).join(' ')
    : null

  const title = consultation.date
    ? `${consultation.date}${consultation.typeDisplay ? ' — ' + consultation.typeDisplay : ''}`
    : consultation.typeDisplay || 'New consultation'

  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">{title}</p>
        <p className="text-xs text-nhs-grey-3 mt-0.5">
          {clinicianName && <span>{clinicianName} · </span>}
          {consultation.topics.length} {consultation.topics.length === 1 ? 'topic' : 'topics'}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs text-nhs-blue hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConsultationForm
// ---------------------------------------------------------------------------

export function ConsultationForm({ draft, dispatch }: Props) {
  const [modalState, setModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  function handleAdd() {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_CONSULTATION_WITH_ID', payload: id })
    setModalState({ tempId: id, snapshot: snap })
  }

  function handleEdit(consultation: DraftConsultation) {
    const snap = structuredClone(draft)
    setModalState({ tempId: consultation._tempId, snapshot: snap })
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
      dispatch({ type: 'REMOVE_CONSULTATION', payload: deleteTarget })
      setDeleteTarget(null)
    }
  }

  const activeConsultation = modalState
    ? draft.consultations.find(c => c._tempId === modalState.tempId)
    : null

  const deleteConsultation = deleteTarget
    ? draft.consultations.find(c => c._tempId === deleteTarget)
    : null

  const modalTitle = activeConsultation
    ? (activeConsultation.date
        ? `${activeConsultation.date}${activeConsultation.typeDisplay ? ' — ' + activeConsultation.typeDisplay : ''}`
        : 'Add Consultation')
    : 'Add Consultation'

  const deleteLabel = deleteConsultation
    ? (deleteConsultation.date
        ? `${deleteConsultation.date}${deleteConsultation.typeDisplay ? ' — ' + deleteConsultation.typeDisplay : ''}`
        : 'this consultation')
    : 'this consultation'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-nhs-grey-2">Consultations</span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add consultation
        </button>
      </div>

      {draft.consultations.length === 0 && (
        <p className="text-sm text-nhs-grey-3 mb-3">No consultations added yet.</p>
      )}

      {draft.consultations.map(consultation => (
        <ConsultationDisplayRow
          key={consultation._tempId}
          consultation={consultation}
          draft={draft}
          onEdit={() => handleEdit(consultation)}
          onDelete={() => setDeleteTarget(consultation._tempId)}
        />
      ))}

      {modalState && activeConsultation && (
        <BuilderModal title={modalTitle} onDone={handleDone} onCancel={handleCancel} size="xl">
          <ConsultationCard
            consultation={activeConsultation}
            draft={draft}
            dispatch={dispatch}
            isModal
          />
        </BuilderModal>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteLabel}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
