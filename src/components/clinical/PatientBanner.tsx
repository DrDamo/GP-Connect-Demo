import { useState } from 'react'
import type { GpConnectPatient } from '../../fhir/types'

interface Props {
  patient?: GpConnectPatient
  practiceOrganisation?: string
  patientId?: string
  onJumpToSource?: (id: string) => void
}

function formatNhsNumber(nhs: string): string {
  if (nhs.length !== 10) return nhs
  return `${nhs.slice(0, 3)} ${nhs.slice(3, 6)} ${nhs.slice(6)}`
}

export function PatientBanner({ patient, practiceOrganisation, patientId, onJumpToSource }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!patient) return null

  const fullName =
    [patient.prefix, patient.givenName, patient.familyName].filter(Boolean).join(' ') || 'Unknown patient'

  const genderDisplay = patient.gender
    ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
    : null

  const hasExpandable = !!(patient.address || patient.phone || patient.email || patient.registeredGpName)

  return (
    <div
      className={`bg-nhs-blue rounded-lg px-4 py-3 text-white flex-shrink-0 ${hasExpandable ? 'cursor-pointer select-none' : ''}`}
      onClick={hasExpandable ? () => setExpanded(e => !e) : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: name + active + registration type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold leading-tight">{fullName}</span>
            {patient.isActive !== undefined && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                patient.isActive
                  ? 'bg-green-400/30 text-green-100 border border-green-300/50'
                  : 'bg-red-400/30 text-red-100 border border-red-300/50'
              }`}>
                {patient.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
            {patient.registrationType && (
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-white/15 text-white/90 border border-white/25">
                {patient.registrationType}
              </span>
            )}
          </div>

          {/* Row 2: DOB · gender · NHS number with verification */}
          <div className="flex items-center gap-3 flex-wrap text-xs opacity-90">
            {patient.dateOfBirth && <span>DOB: {patient.dateOfBirth}</span>}
            {genderDisplay && <span>{genderDisplay}</span>}
            {patient.nhsNumber && (
              <span className="flex items-center gap-1">
                <span>NHS:</span>
                <span className="font-mono font-semibold">{formatNhsNumber(patient.nhsNumber)}</span>
                {patient.nhsNumberVerified !== undefined && (
                  patient.nhsNumberVerified
                    ? <span title={patient.nhsNumberVerificationDisplay ?? 'Number present and verified'} className="text-green-300 cursor-help text-sm leading-none">&#10003;</span>
                    : <span title={patient.nhsNumberVerificationDisplay ?? 'Not verified'} className="text-yellow-300 cursor-help text-sm leading-none">&#9888;</span>
                )}
              </span>
            )}
          </div>

          {/* Row 3: registration + main surgery + branch */}
          <div className="flex items-center gap-3 flex-wrap text-xs opacity-80">
            {patient.registrationStart && <span>Registered: {patient.registrationStart}</span>}
            {practiceOrganisation && <span>Main: {practiceOrganisation}</span>}
            {patient.preferredBranchSurgery && <span>Branch: {patient.preferredBranchSurgery}</span>}
          </div>
        </div>

        {/* Right column: expand chevron + FHIR link */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {hasExpandable && (
            <span className="text-white/60 text-xs leading-none" aria-hidden>
              {expanded ? '▲' : '▼'}
            </span>
          )}
          {onJumpToSource && patientId && (
            <button
              onClick={e => { e.stopPropagation(); onJumpToSource(`Patient/${patientId}`) }}
              className="text-[11px] text-white/70 hover:text-white hover:underline"
            >
              View FHIR &#8599;
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail rows */}
      {expanded && hasExpandable && (
        <div className="mt-2 pt-2 border-t border-white/20 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {patient.address && (
            <>
              <span className="opacity-60 whitespace-nowrap">Address</span>
              <span className="opacity-90">{patient.address}</span>
            </>
          )}
          {patient.phone && (
            <>
              <span className="opacity-60 whitespace-nowrap">Phone</span>
              <span className="opacity-90">{patient.phone}</span>
            </>
          )}
          {patient.email && (
            <>
              <span className="opacity-60 whitespace-nowrap">Email</span>
              <span className="opacity-90">{patient.email}</span>
            </>
          )}
          {patient.registeredGpName && (
            <>
              <span className="opacity-60 whitespace-nowrap">Registered GP</span>
              <span className="opacity-90">{patient.registeredGpName}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
