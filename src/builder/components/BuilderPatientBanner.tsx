import { useState } from 'react'
import type { DraftPatient } from '../types'

function formatNhsNumber(nhs: string): string {
  if (nhs.length !== 10) return nhs
  return `${nhs.slice(0, 3)} ${nhs.slice(3, 6)} ${nhs.slice(6)}`
}

interface Props {
  patient: DraftPatient
}

export function BuilderPatientBanner({ patient }: Props) {
  const [expanded, setExpanded] = useState(false)

  const fullName = [patient.prefix, patient.givenName, patient.familyName].filter(Boolean).join(' ')
  const hasBasicInfo = !!(fullName || patient.nhsNumber || patient.dateOfBirth)
  if (!hasBasicInfo) return null

  const genderDisplay = patient.gender
    ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
    : null

  const hasExpandable = !!(patient.address || patient.phone || patient.email)

  return (
    <div
      className={`shrink-0 bg-nhs-blue px-4 py-2.5 text-white ${hasExpandable ? 'cursor-pointer select-none' : ''}`}
      onClick={hasExpandable ? () => setExpanded(e => !e) : undefined}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          {/* Name + active badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-tight">{fullName || 'Unnamed patient'}</span>
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

          {/* Secondary info */}
          <div className="flex items-center gap-3 flex-wrap text-xs opacity-90">
            {patient.dateOfBirth && <span>DOB: {patient.dateOfBirth}</span>}
            {genderDisplay && <span>{genderDisplay}</span>}
            {patient.nhsNumber && (
              <span className="flex items-center gap-1">
                <span>NHS:</span>
                <span className="font-mono font-semibold">{formatNhsNumber(patient.nhsNumber)}</span>
                {patient.nhsNumberVerified !== undefined && (
                  patient.nhsNumberVerified
                    ? <span title="Number present and verified" className="text-green-300 text-sm leading-none">&#10003;</span>
                    : <span title="Not verified" className="text-yellow-300 text-sm leading-none">&#9888;</span>
                )}
              </span>
            )}
          </div>
        </div>

        {hasExpandable && (
          <span className="text-white/60 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && hasExpandable && (
        <div className="mt-2 pt-2 border-t border-white/20 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {patient.address && (
            <>
              <span className="opacity-60">Address</span>
              <span className="opacity-90">{patient.address}</span>
            </>
          )}
          {patient.phone && (
            <>
              <span className="opacity-60">Phone</span>
              <span className="opacity-90">{patient.phone}</span>
            </>
          )}
          {patient.email && (
            <>
              <span className="opacity-60">Email</span>
              <span className="opacity-90">{patient.email}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
