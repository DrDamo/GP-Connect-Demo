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
import { Field, FormField } from './shared/FormField'
import { DateField } from './shared/DateField'
import { SelectField } from './shared/SelectField'
import { PractitionerSelect } from './shared/PractitionerSelect'
import { SnomedPicker } from './shared/SnomedPicker'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { LinkSection } from './shared/LinkSection'
import { ConfidentialityCheckboxes } from './shared/ConfidentialityCheckboxes'
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

// SNOMED CT consultation/encounter type concepts — the set GP Connect vendors
// actually use for Encounter.type, per NHS Digital's Category (EHR) guidance.
const CONSULTATION_TYPE_OPTS: { code: string; display: string }[] = [
  { code: '1258986006', display: 'Face-to-face encounter' },
  { code: '1269515004', display: 'Face to face consultation with patient' },
  { code: '1237136005', display: 'Consultation with patient' },
  { code: '185387006', display: 'New patient consultation' },
  { code: '448337001', display: 'Telemedicine consultation with patient' },
  { code: '185317003', display: 'Telephone encounter' },
  { code: '1068881000000101', display: 'eConsultation via online application' },
  { code: '325871000000103', display: 'Remote consultation encounter type' },
  { code: '401271004', display: 'Email sent to patient' },
  { code: '270424005', display: 'Letter encounter from patient' },
  { code: '185321005', display: 'Letter encounter to patient' },
  { code: '439708006', display: 'Home visit' },
  { code: '225929007', display: 'Joint home visit' },
  { code: '185463005', display: 'Visit out of hours' },
  { code: '37351000000107', display: 'Administration note' },
  { code: '38651000000103', display: 'Other note' },
  { code: '823691000000103', display: 'Clinical Letter' },
  { code: '24751000000101', display: 'Nursing home visit note' },
  { code: '25671000000102', display: 'Surgery Consultation Note' },
  { code: '25741000000100', display: 'Third Party Consultation' },
  { code: '24731000000108', display: 'Clinic Note' },
]

const FREE_TEXT_TYPE_OPTION = '__free_text_type__'

// Type — dropdown of the fixed SNOMED consultation-type list above, with a
// "Free text…" escape hatch for anything not covered (matches this file's
// existing Custom-category pattern for the same reason: real vendor bundles
// occasionally use terms outside any fixed list).
function ConsultationTypeField({
  typeDisplay,
  typeCode,
  onChange,
}: {
  typeDisplay?: string
  typeCode?: string
  onChange: (updates: { typeDisplay?: string; typeCode?: string }) => void
}) {
  const matched = CONSULTATION_TYPE_OPTS.some(o => o.code === typeCode)
  const [freeText, setFreeText] = useState(!matched && Boolean(typeDisplay))

  return (
    <FormField label="Type" required className="col-span-2">
      {freeText ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={typeDisplay ?? ''}
            onChange={e => onChange({ typeDisplay: e.target.value, typeCode: undefined })}
            required
            className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
          />
          <button type="button" onClick={() => setFreeText(false)} className="shrink-0 text-xs text-nhs-blue hover:underline">
            Use list
          </button>
        </div>
      ) : (
        <select
          value={typeCode ?? ''}
          onChange={e => {
            const val = e.target.value
            if (val === FREE_TEXT_TYPE_OPTION) {
              setFreeText(true)
              onChange({ typeDisplay, typeCode: undefined })
              return
            }
            const opt = CONSULTATION_TYPE_OPTS.find(o => o.code === val)
            onChange({ typeDisplay: opt?.display, typeCode: opt?.code })
          }}
          required
          className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
        >
          <option value="" disabled>— Select —</option>
          {CONSULTATION_TYPE_OPTS.map(o => (
            <option key={o.code} value={o.code}>{o.display}</option>
          ))}
          <option value={FREE_TEXT_TYPE_OPTION}>Free text…</option>
        </select>
      )}
    </FormField>
  )
}

const ITEM_TYPE_OPTS = [
  { value: 'note', label: 'Note' },
  { value: 'coded', label: 'Coded Entry' },
]

const INTERPRETATION_OPTS = [
  { value: 'normal', label: 'Normal' },
  { value: 'abnormal', label: 'Abnormal' },
  { value: 'potentially-abnormal', label: 'Potentially Abnormal' },
]

const OBSERVABLE_ENTITY_TAG = 'observable entity'

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
        <div className="w-40 shrink-0">
          <DateField label="Date" value={item.date ?? ''} onChange={v => upd({ date: v })} />
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
            className="w-full rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm text-nhs-grey-1 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue resize-y"
          />
        </div>
      )}
      {item.itemType === 'coded' && (
        <div className="space-y-2">
          <SnomedPicker
            label="Description"
            value={item.description ?? ''}
            code={item.snomedCode}
            onChange={({ value, code, semanticTag }) => upd({ description: value, snomedCode: code, semanticTag })}
          />
          <Field label="Associated text" value={item.associatedText ?? ''} onChange={v => upd({ associatedText: v })} />
          {item.semanticTag === OBSERVABLE_ENTITY_TAG && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="Value" value={item.value ?? ''} onChange={v => upd({ value: v })} />
              <Field label="Units" value={item.unit ?? ''} onChange={v => upd({ unit: v })} />
              <SelectField
                label="Interpretation"
                value={item.interpretation ?? ''}
                onChange={v => upd({ interpretation: (v || undefined) as DraftConsultationItem['interpretation'] })}
                options={INTERPRETATION_OPTS}
                placeholder="— None —"
              />
              <Field label="Minimum" value={item.minRange ?? ''} onChange={v => upd({ minRange: v })} />
              <Field label="Maximum" value={item.maxRange ?? ''} onChange={v => upd({ maxRange: v })} />
            </div>
          )}
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
          onChange={({ value, code }) => {
            upd({ problem: value, snomedCode: code })
            // Give the topic a sensible default title matching the problem —
            // still just a normal editable field afterwards.
            if (code) {
              dispatch({
                type: 'UPDATE_CONSULTATION_TOPIC',
                payload: { consTempId, topicTempId: topic._tempId, updates: { title: value } },
              })
            }
          }}
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

// "+ Add category" dropdown — shown both above and below the category list so
// it's still within reach once a topic has several categories.
function AddCategorySelect({
  topic,
  consTempId,
  dispatch,
}: {
  topic: DraftConsultationTopic
  consTempId: string
  dispatch: React.Dispatch<DraftAction>
}) {
  return (
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
            <AddCategorySelect topic={topic} consTempId={consTempId} dispatch={dispatch} />
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
        {topic.categories.length > 0 && (
          <div className="flex justify-end mt-1">
            <AddCategorySelect topic={topic} consTempId={consTempId} dispatch={dispatch} />
          </div>
        )}
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
        <DateField label="Date" value={consultation.date ?? ''} onChange={v => upd({ date: v })} required />
        <DateField label="End date" value={consultation.endDate ?? ''} onChange={v => upd({ endDate: v })} />
        <ConsultationTypeField
          typeDisplay={consultation.typeDisplay}
          typeCode={consultation.typeCode}
          onChange={upd}
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

      <ConfidentialityCheckboxes
        confidential={consultation.confidential}
        notForPfs={consultation.notForPfs}
        onChange={upd}
      />

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
