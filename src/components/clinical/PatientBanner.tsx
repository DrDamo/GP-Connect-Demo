import type { GpConnectPatient } from '../../fhir/types'

interface Props {
  patient?: GpConnectPatient
  practiceOrganisation?: string
}

export function PatientBanner({ patient, practiceOrganisation }: Props) {
  if (!patient) return null

  const fullName =
    [patient.givenName, patient.familyName].filter(Boolean).join(' ') || 'Unknown patient'

  const genderDisplay = patient.gender
    ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
    : null

  return (
    <div className="bg-nhs-blue rounded-lg px-4 py-3 text-white">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold">{fullName}</span>
        <span className="text-sm opacity-80">
          {patient.dateOfBirth && `DOB: ${patient.dateOfBirth}`}
          {genderDisplay && ` · ${genderDisplay}`}
        </span>
      </div>
      <div className="flex gap-4 mt-1 text-sm opacity-80">
        {patient.nhsNumber && (
          <span>
            NHS No: <span className="font-mono font-semibold">{patient.nhsNumber}</span>
          </span>
        )}
        {practiceOrganisation && <span>{practiceOrganisation}</span>}
      </div>
    </div>
  )
}
