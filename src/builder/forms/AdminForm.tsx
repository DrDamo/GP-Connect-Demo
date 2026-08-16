import { useState } from 'react'
import type { DraftRecord, DraftOrganisation, DraftPractitioner, DraftLocation, DraftContact } from '../types'
import type { DraftAction } from '../hooks/useDraftRecord'
import { newTempId } from '../hooks/useDraftRecord'
import { FormSection } from './shared/FormSection'
import { Field } from './shared/FormField'
import { DateField } from './shared/DateField'
import { SelectField } from './shared/SelectField'
import { BuilderModal } from '../components/BuilderModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'

// ---------------------------------------------------------------------------
// AdminForm — Patient, Organisation, Organisations, Practitioners, Locations
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

const LANGUAGE_OPTS = [
  'English', 'Polish', 'Urdu', 'Punjabi', 'Bengali', 'Gujarati', 'Arabic',
  'Portuguese', 'Romanian', 'Spanish', 'French', 'Somali', 'Turkish',
  'Chinese (Mandarin)', 'Chinese (Cantonese)',
].map(l => ({ value: l, label: l }))

const PROFICIENCY_OPTS = ['Excellent', 'Good', 'Fair', 'Poor'].map(p => ({ value: p, label: p }))

const COMMUNICATION_MODE_OPTS = [
  'Received spoken', 'Received written', 'Expressed spoken', 'Expressed written',
].map(m => ({ value: m, label: m }))

const PRACTITIONER_ROLE_OPTS = [
  { value: 'General Practitioner', label: 'General Practitioner' },
  { value: 'Practice Nurse', label: 'Practice Nurse' },
  { value: 'Other', label: 'Other' },
]

const RELATIONSHIP_OPTS = [
  'Spouse', 'Partner', 'Parent', 'Son', 'Daughter', 'Sibling', 'Friend',
  'Neighbour', 'Other',
].map(r => ({ value: r, label: r }))

// GPs and doctors in primary care are conventionally always titled "Dr";
// practice nurses (any gender) conventionally use Mr/Mrs/Miss rather than "Nurse".
function defaultPrefixForRole(role: string, gender?: string): string | undefined {
  if (role === 'General Practitioner') return 'Dr'
  if (role === 'Practice Nurse') return gender === 'male' ? 'Mr' : 'Mrs'
  return undefined
}

// ---------------------------------------------------------------------------
// OrganisationCard
// ---------------------------------------------------------------------------

function OrganisationCard({
  org,
  dispatch,
  isModal,
}: {
  org: DraftOrganisation
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftOrganisation>) =>
    dispatch({ type: 'UPDATE_ORGANISATION', payload: { _tempId: org._tempId, updates } })

  const expanded = isModal ? true : open

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      {!isModal && (
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
            <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">
              {org.name || 'New organisation'}
            </span>
            {org.odsCode && (
              <span className="text-xs text-nhs-grey-3">{org.odsCode}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_ORGANISATION', payload: org._tempId })}
            className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
          >
            Remove
          </button>
        </div>
      )}

      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 grid grid-cols-2 gap-2">
          <Field label="Organisation name" value={org.name ?? ''} onChange={v => upd({ name: v })} className="col-span-2" />
          <Field label="ODS code" value={org.odsCode ?? ''} onChange={v => upd({ odsCode: v })} />
          <Field label="Phone" type="tel" value={org.phone ?? ''} onChange={v => upd({ phone: v })} />
          <Field label="Address" value={org.address ?? ''} onChange={v => upd({ address: v })} className="col-span-2" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// OrganisationDisplayRow
// ---------------------------------------------------------------------------

function OrganisationDisplayRow({
  org,
  onEdit,
  onDelete,
}: {
  org: DraftOrganisation
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate block">
          {org.name || 'Unnamed organisation'}
        </span>
        {org.odsCode && (
          <span className="text-xs text-nhs-grey-3">{org.odsCode}</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs text-nhs-blue hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PractitionerCard
// ---------------------------------------------------------------------------

function PractitionerCard({
  prac,
  dispatch,
  isModal,
}: {
  prac: DraftPractitioner
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftPractitioner>) =>
    dispatch({ type: 'UPDATE_PRACTITIONER', payload: { _tempId: prac._tempId, updates } })

  const expanded = isModal ? true : open
  const label = [prac.prefix, prac.givenName, prac.familyName].filter(Boolean).join(' ') || 'New practitioner'

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      {!isModal && (
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
            <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">{label}</span>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_PRACTITIONER', payload: prac._tempId })}
            className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
          >
            Remove
          </button>
        </div>
      )}
      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SelectField
            label="Role"
            value={prac.role ?? ''}
            onChange={v => upd({ role: v || undefined, prefix: defaultPrefixForRole(v, prac.gender) ?? prac.prefix })}
            options={PRACTITIONER_ROLE_OPTS}
            placeholder="Not set"
          />
          <Field label="Prefix" value={prac.prefix ?? ''} onChange={v => upd({ prefix: v })} />
          <Field label="Given name" value={prac.givenName ?? ''} onChange={v => upd({ givenName: v })} />
          <Field label="Family name" value={prac.familyName ?? ''} onChange={v => upd({ familyName: v })} required />
          <Field label="SDS User ID" value={prac.sdsUserId ?? ''} onChange={v => upd({ sdsUserId: v })} />
          <Field label="SDS Role Profile ID" value={prac.sdsRoleProfileId ?? ''} onChange={v => upd({ sdsRoleProfileId: v })} />
          <SelectField
            label="Gender"
            value={prac.gender ?? ''}
            onChange={v => upd({ gender: v })}
            options={GENDER_OPTS}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PractitionerDisplayRow
// ---------------------------------------------------------------------------

function PractitionerDisplayRow({
  prac,
  onEdit,
  onDelete,
}: {
  prac: DraftPractitioner
  onEdit: () => void
  onDelete: () => void
}) {
  const label = [prac.prefix, prac.givenName, prac.familyName].filter(Boolean).join(' ') || 'Unnamed practitioner'
  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate block">
          {label}
        </span>
        {(prac.role || prac.sdsUserId) && (
          <span className="text-xs text-nhs-grey-3">
            {[prac.role, prac.sdsUserId].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs text-nhs-blue hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LocationCard
// ---------------------------------------------------------------------------

function LocationCard({
  loc,
  dispatch,
  isModal,
}: {
  loc: DraftLocation
  dispatch: React.Dispatch<DraftAction>
  isModal?: boolean
}) {
  const [open, setOpen] = useState(true)
  const upd = (updates: Partial<DraftLocation>) =>
    dispatch({ type: 'UPDATE_LOCATION', payload: { _tempId: loc._tempId, updates } })

  const expanded = isModal ? true : open

  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      {!isModal && (
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
            <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">
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
      )}
      {expanded && (
        <div className="p-3 bg-white dark:bg-gray-900 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Name" value={loc.name ?? ''} onChange={v => upd({ name: v })} />
          <Field label="Address" value={loc.address ?? ''} onChange={v => upd({ address: v })} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LocationDisplayRow
// ---------------------------------------------------------------------------

function LocationDisplayRow({
  loc,
  onEdit,
  onDelete,
}: {
  loc: DraftLocation
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-nhs-grey-5 dark:bg-gray-800 border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg mb-2 px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate block">
          {loc.name || 'Unnamed location'}
        </span>
        {loc.address && (
          <span className="text-xs text-nhs-grey-3">{loc.address}</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <button type="button" onClick={onEdit} className="text-xs text-nhs-blue hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-xs text-nhs-red hover:opacity-70">Delete</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContactCard — next of kin / emergency contact
// ---------------------------------------------------------------------------

function ContactCard({
  contact,
  onChange,
  onRemove,
}: {
  contact: DraftContact
  onChange: (updates: Partial<DraftContact>) => void
  onRemove: () => void
}) {
  const label = [contact.prefix, contact.givenName, contact.familyName].filter(Boolean).join(' ') || 'New contact'
  return (
    <div className="border border-nhs-grey-4 dark:border-nhs-grey-2 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center justify-between px-3 py-2 bg-nhs-grey-5 dark:bg-gray-800">
        <span className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-nhs-red hover:opacity-70 transition-opacity ml-2"
        >
          Remove
        </button>
      </div>
      <div className="p-3 bg-white dark:bg-gray-900 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SelectField
          label="Relationship"
          value={contact.relationship ?? ''}
          onChange={v => onChange({ relationship: v || undefined })}
          options={RELATIONSHIP_OPTS}
          placeholder="Not set"
        />
        <Field label="Prefix" value={contact.prefix ?? ''} onChange={v => onChange({ prefix: v })} />
        <div />
        <Field label="Given name" value={contact.givenName ?? ''} onChange={v => onChange({ givenName: v })} />
        <Field label="Family name" value={contact.familyName ?? ''} onChange={v => onChange({ familyName: v })} />
        <SelectField
          label="Gender"
          value={contact.gender ?? ''}
          onChange={v => onChange({ gender: v || undefined })}
          options={GENDER_OPTS}
          placeholder="Not set"
        />
        <Field label="Phone" type="tel" value={contact.phone ?? ''} onChange={v => onChange({ phone: v })} className="col-span-2 sm:col-span-3" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminForm
// ---------------------------------------------------------------------------

export function AdminForm({ draft, dispatch, onAutoPopulate }: Props) {
  const { patient: p, organisation: o } = draft
  const contacts = p.contacts ?? []
  const setPatientContacts = (updated: DraftContact[]) =>
    dispatch({ type: 'SET_PATIENT', payload: { contacts: updated } })
  const handleAddContact = () =>
    setPatientContacts([...contacts, { _tempId: newTempId() }])
  const handleUpdateContact = (tempId: string, updates: Partial<DraftContact>) =>
    setPatientContacts(contacts.map(c => (c._tempId === tempId ? { ...c, ...updates } : c)))
  const handleRemoveContact = (tempId: string) =>
    setPatientContacts(contacts.filter(c => c._tempId !== tempId))

  // Organisations modal state
  const [orgModalState, setOrgModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [orgDeleteTarget, setOrgDeleteTarget] = useState<string | null>(null)

  // Practitioners modal state
  const [pracModalState, setPracModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [pracDeleteTarget, setPracDeleteTarget] = useState<string | null>(null)

  // Locations modal state
  const [locModalState, setLocModalState] = useState<{ tempId: string; snapshot: DraftRecord } | null>(null)
  const [locDeleteTarget, setLocDeleteTarget] = useState<string | null>(null)

  const setPatient = (updates: Partial<DraftRecord['patient']>) =>
    dispatch({ type: 'SET_PATIENT', payload: updates })

  const setOrg = (updates: Partial<DraftRecord['organisation']>) =>
    dispatch({ type: 'SET_ORGANISATION', payload: updates })

  // --- Organisation handlers ---
  const handleAddOrg = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_ORGANISATION_WITH_ID', payload: id })
    setOrgModalState({ tempId: id, snapshot: snap })
  }
  const handleEditOrg = (org: DraftOrganisation) => {
    const snap = structuredClone(draft)
    setOrgModalState({ tempId: org._tempId, snapshot: snap })
  }
  const handleOrgDone = () => setOrgModalState(null)
  const handleOrgCancel = () => {
    if (orgModalState) dispatch({ type: 'LOAD_DRAFT', payload: orgModalState.snapshot })
    setOrgModalState(null)
  }
  const handleOrgDeleteConfirm = () => {
    if (orgDeleteTarget) {
      dispatch({ type: 'REMOVE_ORGANISATION', payload: orgDeleteTarget })
      setOrgDeleteTarget(null)
    }
  }

  // --- Practitioner handlers ---
  const handleAddPrac = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_PRACTITIONER_WITH_ID', payload: id })
    setPracModalState({ tempId: id, snapshot: snap })
  }
  const handleEditPrac = (prac: DraftPractitioner) => {
    const snap = structuredClone(draft)
    setPracModalState({ tempId: prac._tempId, snapshot: snap })
  }
  const handlePracDone = () => setPracModalState(null)
  const handlePracCancel = () => {
    if (pracModalState) dispatch({ type: 'LOAD_DRAFT', payload: pracModalState.snapshot })
    setPracModalState(null)
  }
  const handlePracDeleteConfirm = () => {
    if (pracDeleteTarget) {
      dispatch({ type: 'REMOVE_PRACTITIONER', payload: pracDeleteTarget })
      setPracDeleteTarget(null)
    }
  }

  // --- Location handlers ---
  const handleAddLoc = () => {
    const id = newTempId()
    const snap = structuredClone(draft)
    dispatch({ type: 'ADD_LOCATION_WITH_ID', payload: id })
    setLocModalState({ tempId: id, snapshot: snap })
  }
  const handleEditLoc = (loc: DraftLocation) => {
    const snap = structuredClone(draft)
    setLocModalState({ tempId: loc._tempId, snapshot: snap })
  }
  const handleLocDone = () => setLocModalState(null)
  const handleLocCancel = () => {
    if (locModalState) dispatch({ type: 'LOAD_DRAFT', payload: locModalState.snapshot })
    setLocModalState(null)
  }
  const handleLocDeleteConfirm = () => {
    if (locDeleteTarget) {
      dispatch({ type: 'REMOVE_LOCATION', payload: locDeleteTarget })
      setLocDeleteTarget(null)
    }
  }

  // Active modal items
  const activeOrg = orgModalState
    ? draft.organisations.find(org => org._tempId === orgModalState.tempId) ?? null
    : null
  const deleteOrg = orgDeleteTarget
    ? draft.organisations.find(org => org._tempId === orgDeleteTarget) ?? null
    : null

  const activePrac = pracModalState
    ? draft.practitioners.find(prac => prac._tempId === pracModalState.tempId) ?? null
    : null
  const deletePrac = pracDeleteTarget
    ? draft.practitioners.find(prac => prac._tempId === pracDeleteTarget) ?? null
    : null

  const activeLoc = locModalState
    ? draft.locations.find(loc => loc._tempId === locModalState.tempId) ?? null
    : null
  const deleteLoc = locDeleteTarget
    ? draft.locations.find(loc => loc._tempId === locDeleteTarget) ?? null
    : null

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
            required
          />
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-nhs-grey-2 pb-1">
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
          <Field label="Prefix" value={p.prefix ?? ''} onChange={v => setPatient({ prefix: v })} />
          <Field label="Given name" value={p.givenName ?? ''} onChange={v => setPatient({ givenName: v })} />
          <Field label="Family name" value={p.familyName ?? ''} onChange={v => setPatient({ familyName: v })} required />
          <Field label="Date of birth" type="date" value={p.dateOfBirth ?? ''} onChange={v => setPatient({ dateOfBirth: v })} required />
          <SelectField
            label="Gender"
            value={p.gender ?? ''}
            onChange={v => setPatient({ gender: v as DraftRecord['patient']['gender'] })}
            options={GENDER_OPTS}
          />
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-nhs-grey-2 pb-1">
              <input
                type="checkbox"
                checked={p.isActive ?? true}
                onChange={e => setPatient({ isActive: e.target.checked })}
                className="rounded"
              />
              Active registration
            </label>
          </div>
          <Field label="Registration type" value={p.registrationType ?? ''} onChange={v => setPatient({ registrationType: v })} />
          <DateField label="Registration start" value={p.registrationStart ?? ''} onChange={v => setPatient({ registrationStart: v })} />
          <div />
          <Field label="Address" value={p.address ?? ''} onChange={v => setPatient({ address: v })} className="col-span-2 sm:col-span-3" />
          <Field label="Phone" type="tel" value={p.phone ?? ''} onChange={v => setPatient({ phone: v })} />
          <Field label="Email" type="email" value={p.email ?? ''} onChange={v => setPatient({ email: v })} />
          <SelectField
            label="Registered GP"
            value={p.registeredGpTempId ?? ''}
            onChange={v => setPatient({ registeredGpTempId: v || undefined })}
            options={draft.practitioners.map(prac => ({
              value: prac._tempId,
              label: [prac.prefix, prac.givenName, prac.familyName].filter(Boolean).join(' ') || 'Unnamed practitioner',
            }))}
            placeholder="None"
          />
          <div />
          <div />
          <SelectField
            label="Preferred language"
            value={p.preferredLanguage ?? ''}
            onChange={v => setPatient({ preferredLanguage: v || undefined })}
            options={LANGUAGE_OPTS}
            placeholder="Not recorded"
          />
          <SelectField
            label="Communication proficiency"
            value={p.communicationProficiency ?? ''}
            onChange={v => setPatient({ communicationProficiency: v || undefined })}
            options={PROFICIENCY_OPTS}
            placeholder="Not recorded"
          />
          <SelectField
            label="Mode of communication"
            value={p.modeOfCommunication ?? ''}
            onChange={v => setPatient({ modeOfCommunication: v || undefined })}
            options={COMMUNICATION_MODE_OPTS}
            placeholder="Not recorded"
          />
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-nhs-grey-2 pb-1">
              <input
                type="checkbox"
                checked={p.interpreterRequired ?? false}
                onChange={e => setPatient({ interpreterRequired: e.target.checked })}
                className="rounded"
              />
              Interpreter required
            </label>
          </div>
        </div>
      </FormSection>

      {/* Next of kin */}
      <FormSection title="Next of kin" count={contacts.length} defaultOpen={false}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-nhs-grey-2">Emergency contact / next of kin</span>
          <button
            type="button"
            onClick={handleAddContact}
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add contact
          </button>
        </div>

        {contacts.length === 0 && (
          <p className="text-sm text-nhs-grey-3 mb-2">No next of kin added yet.</p>
        )}

        {contacts.map(c => (
          <ContactCard
            key={c._tempId}
            contact={c}
            onChange={updates => handleUpdateContact(c._tempId, updates)}
            onRemove={() => handleRemoveContact(c._tempId)}
          />
        ))}
      </FormSection>

      {/* GP Practice */}
      <FormSection title="GP Practice" defaultOpen>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Practice name" value={o.name ?? ''} onChange={v => setOrg({ name: v })} className="col-span-2" />
          <Field label="ODS code" value={o.odsCode ?? ''} onChange={v => setOrg({ odsCode: v })} />
          <Field label="Phone" type="tel" value={o.phone ?? ''} onChange={v => setOrg({ phone: v })} />
          <Field label="Address" value={o.address ?? ''} onChange={v => setOrg({ address: v })} className="col-span-2 sm:col-span-3" />
        </div>
      </FormSection>

      {/* Organisations */}
      <FormSection title="Organisations" count={draft.organisations.length} defaultOpen={false}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-nhs-grey-2">Additional organisations</span>
          <button
            type="button"
            onClick={handleAddOrg}
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add organisation
          </button>
        </div>

        {draft.organisations.length === 0 && (
          <p className="text-sm text-nhs-grey-3 mb-2">No additional organisations added yet.</p>
        )}

        {draft.organisations.map(org => (
          <OrganisationDisplayRow
            key={org._tempId}
            org={org}
            onEdit={() => handleEditOrg(org)}
            onDelete={() => setOrgDeleteTarget(org._tempId)}
          />
        ))}
      </FormSection>

      {/* Practitioners */}
      <FormSection title="Practitioners" count={draft.practitioners.length} defaultOpen>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-nhs-grey-2">Practitioners</span>
          <button
            type="button"
            onClick={handleAddPrac}
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add practitioner
          </button>
        </div>

        {draft.practitioners.length === 0 && (
          <p className="text-sm text-nhs-grey-3 mb-2">No practitioners added yet.</p>
        )}

        {draft.practitioners.map(prac => (
          <PractitionerDisplayRow
            key={prac._tempId}
            prac={prac}
            onEdit={() => handleEditPrac(prac)}
            onDelete={() => setPracDeleteTarget(prac._tempId)}
          />
        ))}
      </FormSection>

      {/* Locations */}
      <FormSection title="Locations" count={draft.locations.length} defaultOpen={false}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-nhs-grey-2">Locations</span>
          <button
            type="button"
            onClick={handleAddLoc}
            className="bg-nhs-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add location
          </button>
        </div>

        {draft.locations.length === 0 && (
          <p className="text-sm text-nhs-grey-3 mb-2">No locations added yet.</p>
        )}

        {draft.locations.map(loc => (
          <LocationDisplayRow
            key={loc._tempId}
            loc={loc}
            onEdit={() => handleEditLoc(loc)}
            onDelete={() => setLocDeleteTarget(loc._tempId)}
          />
        ))}
      </FormSection>

      {/* Organisation modal */}
      {orgModalState && activeOrg && (
        <BuilderModal
          title={activeOrg.name ? `Edit: ${activeOrg.name}` : 'Add Organisation'}
          onDone={handleOrgDone}
          onCancel={handleOrgCancel}
        >
          <OrganisationCard org={activeOrg} dispatch={dispatch} isModal />
        </BuilderModal>
      )}

      {orgDeleteTarget && deleteOrg && (
        <DeleteConfirmDialog
          label={deleteOrg.name || 'this organisation'}
          onConfirm={handleOrgDeleteConfirm}
          onCancel={() => setOrgDeleteTarget(null)}
        />
      )}

      {/* Practitioner modal */}
      {pracModalState && activePrac && (
        <BuilderModal
          title={
            [activePrac.prefix, activePrac.givenName, activePrac.familyName].filter(Boolean).join(' ') ||
            'Add Practitioner'
          }
          onDone={handlePracDone}
          onCancel={handlePracCancel}
        >
          <PractitionerCard prac={activePrac} dispatch={dispatch} isModal />
        </BuilderModal>
      )}

      {pracDeleteTarget && deletePrac && (
        <DeleteConfirmDialog
          label={
            [deletePrac.prefix, deletePrac.givenName, deletePrac.familyName].filter(Boolean).join(' ') ||
            'this practitioner'
          }
          onConfirm={handlePracDeleteConfirm}
          onCancel={() => setPracDeleteTarget(null)}
        />
      )}

      {/* Location modal */}
      {locModalState && activeLoc && (
        <BuilderModal
          title={activeLoc.name ? `Edit: ${activeLoc.name}` : 'Add Location'}
          onDone={handleLocDone}
          onCancel={handleLocCancel}
        >
          <LocationCard loc={activeLoc} dispatch={dispatch} isModal />
        </BuilderModal>
      )}

      {locDeleteTarget && deleteLoc && (
        <DeleteConfirmDialog
          label={deleteLoc.name || 'this location'}
          onConfirm={handleLocDeleteConfirm}
          onCancel={() => setLocDeleteTarget(null)}
        />
      )}
    </div>
  )
}
