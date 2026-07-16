import { useState } from 'react'
import type {
  DraftRecord,
  DraftConsultation,
  DraftConsultationTopic,
  DraftConsultationCategory,
  DraftConsultationItem,
  DraftConsultationItemType,
  DraftProblem,
} from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'
import { TrashIcon } from '../components/Icons'
import { InfoHint } from '../../onboarding/InfoHint'

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
  { value: 'coded', label: 'Coded observation' },
]

const FIXED_CATEGORY_TITLES = ['History', 'Examination', 'Assessment', 'Plan']

// Compiled from real GP Connect consultation List (Category (EHR)) titles
// seen across a broad sample of vendor-exported bundles, so the "Add
// category" dropdown reflects the full range systems actually use, not
// just the SOAP-note four above.
const ALL_CATEGORY_TITLES = [
  'Additional', 'Administration', 'Allergy', 'Assessment', 'Comment',
  'Diagnosis', 'Document', 'Examination', 'Family History', 'Follow up',
  'History', 'Intervention', 'Investigation', 'Lab Results', 'Medication',
  'Other', 'Patient Medication Review', 'Plan', 'Problem', 'Procedure',
  'Protocols', 'Referral', 'Regime Review', 'Social', 'Template entry',
  'Test Request',
]

const CUSTOM_CATEGORY_OPTION = '__custom__'

const CLINICAL_STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'resolved', label: 'Resolved' },
]

const SIGNIFICANCE_OPTS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
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
    <div className="border border-nhs-grey-5 dark:border-nhs-grey-4 rounded p-2 mb-1.5 bg-white dark:bg-gray-900">
      <div className="flex items-start gap-2 mb-1.5">
        <div className="w-40 shrink-0">
          <SelectField
            label="Type"
            value={item.itemType}
            onChange={v => upd({ itemType: v as DraftConsultationItemType })}
            options={ITEM_TYPE_OPTS}
          />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'REMOVE_CONSULTATION_ITEM',
              payload: { consTempId, topicTempId, catTempId, itemTempId: item._tempId },
            })
          }
          className="shrink-0 text-nhs-red hover:opacity-70 p-0.5 pt-5"
          title="Remove"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {item.itemType === 'note' && (
        <div>
          <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-0.5">
            Narrative text
          </label>
          <textarea
            value={item.narrativeText ?? ''}
            onChange={e => upd({ narrativeText: e.target.value })}
            rows={2}
            className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue resize-none"
          />
        </div>
      )}
      {item.itemType === 'coded' && (
        <div className="space-y-2">
          <SnomedPicker
            label="Description"
            value={item.description ?? ''}
            code={item.snomedCode}
            onChange={({ value, code }) => upd({ description: value, snomedCode: code })}
          />
          <Field label="Associated text" value={item.associatedText ?? ''} onChange={v => upd({ associatedText: v })} />
          <Field label="Value" value={item.value ?? ''} onChange={v => upd({ value: v })} className="max-w-xs" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TopicProblemBox — the single Problem (Condition) belonging to a topic
// ---------------------------------------------------------------------------

function TopicProblemBox({
  topic,
  consTempId,
  draft,
  dispatch,
}: {
  topic: DraftConsultationTopic
  consTempId: string
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  const problem: DraftProblem | undefined = topic.problemTempId
    ? draft.problems.find(p => p._tempId === topic.problemTempId)
    : undefined

  if (!problem) {
    return (
      <div className="border border-dashed border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-nhs-grey-3">No problem linked to this topic.</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'ADD_TOPIC_PROBLEM', payload: { consTempId, topicTempId: topic._tempId } })}
          className="text-xs text-nhs-blue hover:underline"
        >
          + Add problem
        </button>
      </div>
    )
  }

  const upd = (updates: Partial<DraftProblem>) =>
    dispatch({ type: 'UPDATE_PROBLEM', payload: { _tempId: problem._tempId, updates } })

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-nhs-grey-5 dark:bg-gray-800 rounded-t-lg">
        <span className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">Problem</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_TOPIC_PROBLEM', payload: { consTempId, topicTempId: topic._tempId } })}
          className="text-nhs-red hover:opacity-70 p-0.5"
          title="Remove problem"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 bg-white dark:bg-gray-900 space-y-2">
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
            onChange={v => upd({ clinicalStatus: v as DraftProblem['clinicalStatus'] })}
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
          />
        </div>
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
  const isFixed = FIXED_CATEGORY_TITLES.includes(cat.title ?? '')

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded mb-1.5 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 bg-nhs-grey-5 dark:bg-gray-800">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button type="button" onClick={() => setOpen(o => !o)} className="shrink-0 p-0.5">
            <svg
              className={`w-3 h-3 text-nhs-grey-3 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isFixed ? (
            <span className="text-xs font-medium text-nhs-grey-2 shrink-0">{cat.title}</span>
          ) : (
            <input
              type="text"
              value={cat.title ?? ''}
              onChange={e =>
                dispatch({
                  type: 'UPDATE_CONSULTATION_CATEGORY',
                  payload: { consTempId, topicTempId, catTempId: cat._tempId, updates: { title: e.target.value } },
                })
              }
              placeholder="Category title…"
              required
              className="min-w-0 flex-1 text-xs font-medium text-nhs-grey-2 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-1.5 py-0.5 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none"
            />
          )}
          <span className="text-xs text-nhs-grey-3 shrink-0">({cat.items.length} items)</span>
        </div>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'REMOVE_CONSULTATION_CATEGORY',
              payload: { consTempId, topicTempId, catTempId: cat._tempId },
            })
          }
          className="shrink-0 text-nhs-red hover:opacity-70 p-0.5 ml-2"
          title="Remove"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
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
// ConsultationTopic — content panel for the active tab
// ---------------------------------------------------------------------------

function TopicBlock({
  topic,
  consTempId,
  draft,
  dispatch,
}: {
  topic: DraftConsultationTopic
  consTempId: string
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
}) {
  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 border-t-0 rounded-b-lg p-3 bg-white dark:bg-gray-900 space-y-2">
      <Field
        label="Topic title"
        value={topic.title ?? ''}
        onChange={v =>
          dispatch({
            type: 'UPDATE_CONSULTATION_TOPIC',
            payload: { consTempId, topicTempId: topic._tempId, updates: { title: v } },
          })
        }
      />

      <TopicProblemBox topic={topic} consTempId={consTempId} draft={draft} dispatch={dispatch} />

      {/* Categories — one each of History/Examination/Assessment/Plan, unlimited Other */}
      <div>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
          <span className="text-xs font-medium text-nhs-grey-3 uppercase tracking-wide">
            Categories
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {FIXED_CATEGORY_TITLES.filter(title => !topic.categories.some(c => c.title === title)).map(title => (
              <button
                key={title}
                type="button"
                onClick={() =>
                  dispatch({ type: 'ADD_CONSULTATION_CATEGORY', payload: { consTempId, topicTempId: topic._tempId, title } })
                }
                className="text-xs text-nhs-blue hover:underline"
              >
                + {title}
              </button>
            ))}
            <select
              value=""
              onChange={e => {
                const val = e.target.value
                if (!val) return
                const title = val === CUSTOM_CATEGORY_OPTION ? '' : val
                dispatch({ type: 'ADD_CONSULTATION_CATEGORY', payload: { consTempId, topicTempId: topic._tempId, title } })
              }}
              className="text-xs text-nhs-blue border border-nhs-grey-4 dark:border-nhs-grey-2 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 hover:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
            >
              <option value="">+ Add category…</option>
              {ALL_CATEGORY_TITLES
                .filter(t => !FIXED_CATEGORY_TITLES.includes(t) && !topic.categories.some(c => c.title === t))
                .map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              <option value={CUSTOM_CATEGORY_OPTION}>Custom…</option>
            </select>
          </div>
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
  const [activeTopicId, setActiveTopicId] = useState<string | null>(consultation.topics[0]?._tempId ?? null)
  const [prevTopics, setPrevTopics] = useState(consultation.topics)

  // Keep the active tab valid as topics are added/removed — this is the
  // React-recommended "adjust state during render" pattern, not an effect,
  // so a newly added topic becomes active in the same render it appears in.
  if (consultation.topics !== prevTopics) {
    setPrevTopics(consultation.topics)
    if (consultation.topics.length > prevTopics.length) {
      setActiveTopicId(consultation.topics[consultation.topics.length - 1]._tempId)
    } else if (!consultation.topics.some(t => t._tempId === activeTopicId)) {
      setActiveTopicId(consultation.topics[0]?._tempId ?? null)
    }
  }

  const activeTopic = consultation.topics.find(t => t._tempId === activeTopicId) ?? null

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
        />
      </div>

      {/* Topics — one horizontal tab per topic */}
      <div>
        <span className="text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide mb-2 flex items-center gap-1">
          Topics
          <InfoHint topic="builder.topics-categories-items" />
        </span>
        {consultation.topics.length === 0 && (
          <p className="text-xs text-nhs-grey-3 mb-2">No topics yet — add one below.</p>
        )}
        <div className="flex items-end gap-1 overflow-x-auto">
          {consultation.topics.map((topic, idx) => {
            const isActive = topic._tempId === activeTopicId
            return (
              <div
                key={topic._tempId}
                className={
                  'shrink-0 flex items-center gap-1 rounded-t-lg border border-b-0 -mb-px ' +
                  (isActive
                    ? 'bg-white dark:bg-gray-900 border-nhs-grey-4 dark:border-nhs-grey-2'
                    : 'bg-nhs-grey-5 dark:bg-gray-800 border-transparent')
                }
              >
                <button
                  type="button"
                  onClick={() => setActiveTopicId(topic._tempId)}
                  className={
                    'pl-3 pr-1.5 py-1.5 text-sm font-medium truncate max-w-[10rem] ' +
                    (isActive ? 'text-nhs-blue' : 'text-nhs-grey-2 hover:text-nhs-blue')
                  }
                >
                  {topic.title || `Topic ${idx + 1}`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'REMOVE_CONSULTATION_TOPIC', payload: { consTempId: consultation._tempId, topicTempId: topic._tempId } })
                  }
                  className="pr-2 text-nhs-grey-3 hover:text-nhs-red"
                  title="Remove topic"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_CONSULTATION_TOPIC', payload: consultation._tempId })}
            className="shrink-0 px-3 py-1.5 text-sm font-medium text-nhs-blue hover:underline"
          >
            + Topic
          </button>
        </div>
        {activeTopic && (
          <TopicBlock
            topic={activeTopic}
            consTempId={consultation._tempId}
            draft={draft}
            dispatch={dispatch}
          />
        )}
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
        <BuilderModal title={modalTitle} onDone={handleDone} onCancel={handleCancel} size="full">
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
