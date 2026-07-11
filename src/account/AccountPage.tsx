import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-nhs-grey-4 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100">{title}</h3>
      {description && <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mt-0.5 mb-4">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputClass = 'w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'

export function AccountPage() {
  const { profile, organisation, updateProfile, updateOrganisationName, changePassword } = useAuth()

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? '')
  const [address, setAddress] = useState(profile?.address ?? '')
  const [profileStatus, setProfileStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  const [orgName, setOrgName] = useState(organisation?.name ?? '')
  const [orgStatus, setOrgStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [orgSaving, setOrgSaving] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const isAdmin = profile?.role === 'admin'

  if (!profile) return null

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileStatus(null)
    const result = await updateProfile({
      display_name: displayName.trim() || null,
      job_title: jobTitle.trim() || null,
      date_of_birth: dateOfBirth || null,
      address: address.trim() || null,
    })
    setProfileSaving(false)
    setProfileStatus(result.error ? { kind: 'error', message: result.error } : { kind: 'ok', message: 'Saved.' })
  }

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrgSaving(true)
    setOrgStatus(null)
    const result = await updateOrganisationName(orgName.trim())
    setOrgSaving(false)
    setOrgStatus(result.error ? { kind: 'error', message: result.error } : { kind: 'ok', message: 'Saved.' })
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordStatus(null)
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ kind: 'error', message: 'Passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ kind: 'error', message: 'Password must be at least 8 characters.' })
      return
    }
    setPasswordSaving(true)
    const result = await changePassword(newPassword)
    setPasswordSaving(false)
    if (result.error) {
      setPasswordStatus({ kind: 'error', message: result.error })
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordStatus({ kind: 'ok', message: 'Password updated.' })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <SectionCard title="Personal details" description="Visible to other members of your organisation.">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Field label="Full name">
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Job title">
              <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Practice Manager" className={inputClass} />
            </Field>
            <Field label="Date of birth">
              <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Address">
              <textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
            </Field>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={profileSaving} className="bg-nhs-blue text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {profileSaving ? 'Saving…' : 'Save details'}
              </button>
              {profileStatus && (
                <span className={`text-sm ${profileStatus.kind === 'ok' ? 'text-nhs-green' : 'text-nhs-red'}`}>{profileStatus.message}</span>
              )}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Organisation">
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <Field label="Organisation name">
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                disabled={!isAdmin}
                className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
              />
            </Field>
            {!isAdmin && (
              <p className="text-xs text-nhs-grey-3 dark:text-gray-500">Only an organisation admin can rename your organisation.</p>
            )}
            {isAdmin && (
              <div className="flex items-center gap-3">
                <button type="submit" disabled={orgSaving} className="bg-nhs-blue text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                  {orgSaving ? 'Saving…' : 'Save organisation'}
                </button>
                {orgStatus && (
                  <span className={`text-sm ${orgStatus.kind === 'ok' ? 'text-nhs-green' : 'text-nhs-red'}`}>{orgStatus.message}</span>
                )}
              </div>
            )}
          </form>
        </SectionCard>

        <SectionCard title="Security" description="Change your account password.">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Field label="New password">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} className={inputClass} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} className={inputClass} />
            </Field>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="bg-nhs-blue text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {passwordSaving ? 'Updating…' : 'Update password'}
              </button>
              {passwordStatus && (
                <span className={`text-sm ${passwordStatus.kind === 'ok' ? 'text-nhs-green' : 'text-nhs-red'}`}>{passwordStatus.message}</span>
              )}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Billing" description="Manage your plan and view payment history.">
          <div className="flex items-center justify-between bg-nhs-grey-5 dark:bg-gray-800 rounded-lg p-4">
            <div>
              <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100">Free plan</p>
              <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mt-0.5">No payment method on file · Payment history will appear here</p>
            </div>
            <button
              disabled
              title="Coming soon"
              className="text-sm font-medium px-3 py-1.5 rounded border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-3 dark:text-gray-500 opacity-60 cursor-not-allowed"
            >
              Upgrade — coming soon
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
