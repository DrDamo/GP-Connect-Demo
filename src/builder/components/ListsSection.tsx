import { useState } from 'react'
import type { DraftRecord } from '../types'
import { InfoHint } from '../../onboarding/InfoHint'

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

interface ListDef {
  name: string
  entries: string[]
  secondary?: boolean
}

function buildPrimaryLists(draft: DraftRecord): ListDef[] {
  const activeAllergies = draft.allergies.filter((a) => a.status !== 'resolved')
  const endedAllergies = draft.allergies.filter((a) => a.status === 'resolved')

  return [
    {
      name: 'Medications',
      entries: draft.medications.map((med) => med.drugName || 'Unnamed medication'),
    },
    {
      name: 'Active Allergies',
      entries: activeAllergies.map((a) => a.causativeAgent || 'Unnamed allergy'),
    },
    {
      name: 'Ended Allergies',
      entries: endedAllergies.map((a) => a.causativeAgent || 'Unnamed allergy'),
    },
    {
      name: 'Problems',
      entries: draft.problems.map((p) => p.problem || 'Unnamed problem'),
    },
    {
      name: 'Consultations',
      entries: draft.consultations.map((c) => {
        const parts = [c.date, c.typeDisplay].filter(Boolean)
        return parts.join(' — ') || 'Unnamed consultation'
      }),
    },
    {
      name: 'Immunisations',
      entries: draft.immunisations.map((imm) => imm.vaccineName || 'Unnamed immunisation'),
    },
    {
      name: 'Investigations',
      entries: draft.investigations.map((inv) => inv.name || 'Unnamed investigation'),
    },
    {
      name: 'Referrals',
      entries: draft.referrals.map((ref) => ref.recipientName || 'Unnamed referral'),
    },
    {
      name: 'Diary Entries',
      entries: draft.diaryEntries.map((entry) => entry.description || 'Unnamed diary entry'),
    },
    {
      name: 'Coded Data',
      entries: draft.codedData.map((item) => item.description || 'Unnamed coded item'),
    },
    {
      name: 'Documents',
      entries: draft.documents.map((doc) => doc.type || doc.description || 'Unnamed document'),
    },
  ]
}

// Derive secondary lists from draft linkage fields
function buildSecondaryLists(draft: DraftRecord): ListDef[] {
  const lists: ListDef[] = []

  // Consultation-grouped lists
  for (const cons of draft.consultations) {
    const label = [cons.date, cons.typeDisplay].filter(Boolean).join(' — ') || 'Unnamed consultation'

    const groups: [string, string[]][] = [
      ['Medications', draft.medications.filter(m => m.linkedConsultationTempId === cons._tempId).map(m => m.drugName || 'Unnamed medication')],
      ['Allergies', draft.allergies.filter(a => a.linkedConsultationTempId === cons._tempId).map(a => a.causativeAgent || 'Unnamed allergy')],
      ['Problems', draft.problems.filter(p => p.linkedConsultationTempId === cons._tempId).map(p => p.problem || 'Unnamed problem')],
      ['Immunisations', draft.immunisations.filter(i => i.linkedConsultationTempId === cons._tempId).map(i => i.vaccineName || 'Unnamed immunisation')],
      ['Investigations', draft.investigations.filter(i => i.linkedConsultationTempId === cons._tempId).map(i => i.name || 'Unnamed investigation')],
      ['Referrals', draft.referrals.filter(r => r.linkedConsultationTempId === cons._tempId).map(r => r.recipientName || 'Unnamed referral')],
      ['Diary Entries', draft.diaryEntries.filter(d => d.linkedConsultationTempId === cons._tempId).map(d => d.description || 'Unnamed diary entry')],
      ['Coded Data', draft.codedData.filter(c => c.linkedConsultationTempId === cons._tempId).map(c => c.description || 'Unnamed coded data')],
      ['Documents', draft.documents.filter(d => d.linkedConsultationTempId === cons._tempId).map(d => d.type || d.description || 'Unnamed document')],
    ]

    for (const [domain, entries] of groups) {
      if (entries.length > 0) {
        lists.push({ name: `${domain} — in: ${label}`, entries, secondary: true })
      }
    }
  }

  // Problem-grouped lists
  for (const prob of draft.problems) {
    const label = prob.problem || 'Unnamed problem'

    const groups: [string, string[]][] = [
      ['Medications', draft.medications.filter(m => m.linkedProblemTempIds?.includes(prob._tempId)).map(m => m.drugName || 'Unnamed medication')],
      ['Allergies', draft.allergies.filter(a => a.linkedProblemTempIds?.includes(prob._tempId)).map(a => a.causativeAgent || 'Unnamed allergy')],
      ['Immunisations', draft.immunisations.filter(i => i.linkedProblemTempIds?.includes(prob._tempId)).map(i => i.vaccineName || 'Unnamed immunisation')],
      ['Investigations', draft.investigations.filter(i => i.linkedProblemTempIds?.includes(prob._tempId)).map(i => i.name || 'Unnamed investigation')],
      ['Referrals', draft.referrals.filter(r => r.linkedProblemTempIds?.includes(prob._tempId)).map(r => r.recipientName || 'Unnamed referral')],
      ['Diary Entries', draft.diaryEntries.filter(d => d.linkedProblemTempIds?.includes(prob._tempId)).map(d => d.description || 'Unnamed diary entry')],
      ['Coded Data', draft.codedData.filter(c => c.linkedProblemTempIds?.includes(prob._tempId)).map(c => c.description || 'Unnamed coded data')],
      ['Documents', draft.documents.filter(d => d.linkedProblemTempIds?.includes(prob._tempId)).map(d => d.type || d.description || 'Unnamed document')],
      ['Consultations', draft.consultations.filter(c => c.linkedProblemTempIds?.includes(prob._tempId)).map(c => [c.date, c.typeDisplay].filter(Boolean).join(' — ') || 'Unnamed consultation')],
      ['Linked Problems', draft.problems.filter(p => p._tempId !== prob._tempId && p.linkedProblemTempIds?.includes(prob._tempId)).map(p => p.problem || 'Unnamed problem')],
    ]

    for (const [domain, entries] of groups) {
      if (entries.length > 0) {
        lists.push({ name: `${domain} — re: ${label}`, entries, secondary: true })
      }
    }
  }

  return lists
}

interface ListCardProps {
  list: ListDef
}

function ListCard({ list }: ListCardProps) {
  const [open, setOpen] = useState(false)
  const count = list.entries.length

  return (
    <div className={`border ${list.secondary ? 'border-purple-200 dark:border-purple-900 border-l-4 border-l-purple-400 dark:border-l-purple-600' : 'border-nhs-grey-4 dark:border-gray-700 border-l-4 border-l-nhs-grey-3 dark:border-l-gray-500'} rounded-md overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800 hover:bg-nhs-grey-4 dark:hover:bg-gray-700 transition-colors text-left"
        aria-expanded={open}
      >
        <ChevronRight
          className={`h-4 w-4 flex-shrink-0 text-nhs-grey-2 dark:text-gray-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 text-sm font-medium text-nhs-grey-1 dark:text-gray-200">
          {list.name}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            count === 0
              ? 'bg-nhs-grey-4 dark:bg-gray-700 text-nhs-grey-3 dark:text-gray-500'
              : list.secondary
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'bg-nhs-blue/10 dark:bg-blue-900/30 text-nhs-blue dark:text-blue-300'
          }`}
        >
          {count === 1 ? '1 entry' : `${count} entries`}
        </span>
      </button>

      {open && (
        <div className="px-3 py-2 bg-white dark:bg-gray-900">
          {count === 0 ? (
            <p className="text-xs text-nhs-grey-3 dark:text-gray-500 italic py-1">No entries</p>
          ) : (
            <ul className="space-y-1">
              {list.entries.map((label, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-nhs-grey-2 dark:text-gray-400">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-nhs-grey-3 dark:bg-gray-600" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function ListsSection({ draft }: { draft: DraftRecord }) {
  const primaryLists = buildPrimaryLists(draft)
  const secondaryLists = buildSecondaryLists(draft)

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-nhs-grey-2 dark:text-gray-300">
          Auto-generated Lists
        </h3>
        <span className="text-xs px-2 py-0.5 bg-nhs-grey-4 dark:bg-gray-700 text-nhs-grey-2 dark:text-gray-400 rounded-full">
          Read only
        </span>
        <InfoHint topic="builder.lists-readonly" />
      </div>
      <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mb-4">
        These FHIR Lists are generated automatically as you build the record. They cannot be edited
        directly.
      </p>

      <div className="mb-4">
        <p className="text-xs font-semibold text-nhs-grey-2 dark:text-gray-400 uppercase tracking-wide mb-2">
          Primary Lists
        </p>
        <div className="space-y-2">
          {primaryLists.map((list) => (
            <ListCard key={list.name} list={list} />
          ))}
        </div>
      </div>

      {secondaryLists.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-nhs-grey-2 dark:text-gray-400 uppercase tracking-wide mb-1">
            Secondary Lists
          </p>
          <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mb-2">
            Generated from problem and consultation linkage set in each item's form.
          </p>
          <div className="space-y-2">
            {secondaryLists.map((list) => (
              <ListCard key={list.name} list={list} />
            ))}
          </div>
        </div>
      )}

      {secondaryLists.length === 0 && (draft.problems.length > 0 || draft.consultations.length > 0) && (
        <p className="text-xs text-nhs-grey-3 dark:text-gray-500 italic">
          No secondary lists yet — link clinical items to problems or consultations using the "GP Connect Linkage" section in each item's edit form.
        </p>
      )}
    </div>
  )
}
