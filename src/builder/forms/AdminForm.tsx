import { useState } from 'react'
import type { DraftRecord } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { FormSection } from './shared/FormSection'
import { Field } from './shared/FormField'
import { SelectField } from './shared/SelectField'

// ---------------------------------------------------------------------------
// AdminForm — Patient, Organisation, Practitioners, Locations
// ---------------------------------------------------------------------------

interface Props {
  draft: DraftRecord
  dispatch: React.Dispatch<DraftAction>
  onAutoPopulate: () => void
}

const GENDER_OPTS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
]

function PractitionerCard({
  prac,
  dispatch,
}: {
  prac: DraftRecord['practitioners'][number]
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftRecord['practitioners'][number]>) =>
    dispatch({ type: 'UPDATE_PRACTITIONER', payload: { _tempId: prac._tempId, updates } })

  const label = [prac.prefix, prac.givenName, prac.familyName].filter(Boolean).join(' ') || 'New practitioner'

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
          <span className="text-sm font-medium text-nhs-grey-1">{label}</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_PRACTITIONER', payload: prac._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>
      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Prefix" value={prac.prefix ?? ''} onChange={v => upd({ prefix: v })} placeholder="Dr" />
          <Field label="Given name" value={prac.givenName ?? ''} onChange={v => upd({ givenName: v })} />
          <Field label="Family name" value={prac.familyName ?? ''} onChange={v => upd({ familyName: v })} required />
          <Field label="SDS User ID" value={prac.sdsUserId ?? ''} onChange={v => upd({ sdsUserId: v })} placeholder="G12345" />
          <Field label="SDS Role Profile ID" value={prac.sdsRoleProfileId ?? ''} onChange={v => upd({ sdsRoleProfileId: v })} placeholder="R12345" />
          <SelectField
            label="Gender"
            value={prac.gender ?? ''}
            onChange={v => upd({ gender: v })}
            options={GENDER_OPTS}
            placeholder="— Select —"
          />
        </div>
      )}
    </div>
  )
}

function LocationCard({
  loc,
  dispatch,
}: {
  loc: DraftRecord['locations'][number]
  dispatch: React.Dispatch<DraftAction>
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftRecord['locations'][number]>) =>
    dispatch({ type: 'UPDATE_LOCATION', payload: { _tempId: loc._tempId, updates } })

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
            {loc.name || 'New location'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REMOVE_LOCATION', payload: loc._tempId })}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>
      {open && (
        <div className="p-3 bg-white dark:bg-gray-900 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Name" value={loc.name ?? ''} onChange={v => upd({ name: v })} />
          <Field label="Address" value={loc.address ?? ''} onChange={v => upd({ address: v })} />
        </div>
      )}
    </div>
  )
}

export function AdminForm({ draft, dispatch, onAutoPopulate }: Props) {
  const { patient: p, organisation: o } = draft

  const setPatient = (updates: Partial<DraftRecord['patient']>) =>
    dispatch({ type: 'SET_PATIENT', payload: updates })

  const setOrg = (updates: Partial<DraftRecord['organisation']>) =>
    dispatch({ type: 'SET_ORGANISATION', payload: updates })

  return (
    <div>
      {/* Auto-populate toolbar */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={onAutoPopulate}
          className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Auto-populate with NHS test data
        </button>
      </div>

      {/* Patient Demographics */}
      <FormSection title="Patient Demographics" defaultOpen>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field
            label="NHS Number"
            value={p.nhsNumber ?? ''}
            onChange={v => setPatient({ nhsNumber: v })}
            placeholder="9990000018"
            required
          />
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-nhs-grey-2 dark:text-nhs-grey-4 pb-1">
              <input
                type="checkbox"
                checked={p.nhsNumberVerified ?? false}
                onChange={e => setPatient({ nhsNumberVerified: e.target.checked })}
                className="rounded"
              />
              NHS number verified
            </label>
          </div>
          <div />
          <Field label="Prefix" value={p.prefix ?? ''} onChange={v => setPatient({ prefix: v })} placeholder="Mrs" />
          <Field label="Given name" value={p.givenName ?? ''} onChange={v => setPatient({ givenName: v })} />
          <Field label="Family name" value={p.familyName ?? ''} onChange={v => setPatient({ familyName: v })} required />
          <Field label="Date of birth" type="date" value={p.dateOfBirth ?? ''} onChange={v => setPatient({ dateOfBirth: v })} required />
          <SelectField
            label="Gender"
            value={p.gender ?? ''}
            onChange={v => setPatient({ gender: v as DraftRecord['patient']['gender'] })}
            options={GENDER_OPTS}
            placeholder="— Select —"
          />
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-nhs-grey-2 dark:text-nhs-grey-4 pb-1">
              <input
                type="checkbox"
                checked={p.isActive ?? true}
                onChange={e => setPatient({ isActive: e.target.checked })}
                className="rounded"
              />
              Active registration
            </label>
          </div>
          <Field label="Registration type" value={p.registrationType ?? ''} onChange={v => setPatient({ registrationType: v })} placeholder="Regular" />
          <Field label="Registration start" type="date" value={p.registrationStart ?? ''} onChange={v => setPatient({ registrationStart: v })} />
          <div />
          <Field label="Address" value={p.address ?? ''} onChange={v => setPatient({ address: v })} className="col-span-2 sm:col-span-3" />
          <Field label="Phone" type="tel" value={p.phone ?? ''} onChange={v => setPatient({ phone: v })} />
          <Field label="Email" type="email" value={p.email ?? ''} onChange={v => setPatient({ email: v })} />
        </div>
      </FormSection>

      {/* GP Practice */}
      <FormSection title="GP Practice" defaultOpen>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Practice name" value={o.name ?? ''} onChange={v => setOrg({ name: v })} className="col-span-2" />
          <Field label="ODS code" value={o.odsCode ?? ''} onChange={v => setOrg({ odsCode: v })} placeholder="A81001" />
          <Field label="Phone" type="tel" value={o.phone ?? ''} onChange={v => setOrg({ phone: v })} />
          <Field label="Address" value={o.address ?? ''} onChange={v => setOrg({ address: v })} className="col-span-2 sm:col-span-3" />
        </div>
      </FormSection>

      {/* Practitioners */}
      <FormSection title="Practitioners" count={draft.practitioners.length} defaultOpen>
        {draft.practitioners.length === 0 && (
          <p className="text-sm text-nhs-grey-3 mb-2">No practitioners added yet.</p>
        )}
        {draft.practitioners.map(prac => (
          <PractitionerCard key={prac._tempId} prac={prac} dispatch={dispatch} />
        ))}
        <button
          type="button"
          onClick={() => dispatch({ type: 'ADD_PRACTITIONER' })}
          className="mt-1 border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
        >
          + Add practitioner
        </button>
      </FormSection>

      {/* Locations */}
      <FormSection title="Locations" count={draft.locations.length} defaultOpen={false}>
        {draft.locations.length === 0 && (
          <p className="text-sm text-nhs-grey-3 mb-2">No locations added yet.</p>
        )}
        {draft.locations.map(loc => (
          <LocationCard key={loc._tempId} loc={loc} dispatch={dispatch} />
        ))}
        <button
          type="button"
          onClick={() => dispatch({ type: 'ADD_LOCATION' })}
          className="mt-1 border border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-grey-2 dark:text-nhs-grey-4 px-3 py-1.5 rounded text-sm hover:border-nhs-blue hover:text-nhs-blue transition-colors"
        >
          + Add location
        </button>
      </FormSection>
    </div>
  )
}
