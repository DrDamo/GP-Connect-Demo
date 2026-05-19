import { useState } from 'react'
import type { GpConnectMedication, GpConnectMedicationsRecord } from '../../fhir/types'

interface Props {
  record: GpConnectMedicationsRecord
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800 border-green-300' },
  completed: { label: 'Completed', className: 'bg-nhs-grey-5 text-nhs-grey-2 border-nhs-grey-4' },
  stopped: { label: 'Stopped', className: 'bg-red-100 text-red-800 border-red-300' },
  'on-hold': { label: 'On Hold', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  intended: { label: 'Intended', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  'entered-in-error': { label: 'Entered in Error', className: 'bg-red-100 text-red-800 border-red-300' },
  unknown: { label: 'Unknown', className: 'bg-nhs-grey-5 text-nhs-grey-3 border-nhs-grey-4' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.unknown
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function MedicationRow({ med }: { med: GpConnectMedication }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-nhs-grey-5 hover:bg-blue-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="py-2.5 px-3">
          <div className="font-medium text-nhs-grey-1 text-sm">{med.drugName}</div>
          {med.snomedCode && (
            <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{med.snomedCode}</div>
          )}
        </td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">
          {med.dosageInstruction ?? [med.dose, med.frequency].filter(Boolean).join(' · ') ?? '—'}
        </td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.route ?? '—'}</td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.startDate ?? '—'}</td>
        <td className="py-2.5 px-3 text-sm text-nhs-grey-2">{med.lastIssuedDate ?? '—'}</td>
        <td className="py-2.5 px-3">
          <StatusBadge status={med.status} />
        </td>
        <td className="py-2.5 px-3 text-nhs-grey-3 text-sm">
          {expanded ? '▲' : '▼'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-blue-50 border-b border-nhs-grey-5">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
              <Detail label="Drug name" value={med.drugName} />
              {med.snomedCode && <Detail label="DM+D / SNOMED code" value={med.snomedCode} mono />}
              {med.dosageInstruction && <Detail label="Dosage instruction" value={med.dosageInstruction} />}
              {med.dose && <Detail label="Dose" value={med.dose} />}
              {med.frequency && <Detail label="Frequency" value={med.frequency} />}
              {med.route && <Detail label="Route" value={med.route} />}
              {med.prescribedQuantity && <Detail label="Quantity" value={med.prescribedQuantity} />}
              {med.numberOfRepeatsAllowed !== undefined && (
                <Detail label="Repeats allowed" value={String(med.numberOfRepeatsAllowed)} />
              )}
              {med.prescriptionType && <Detail label="Prescription type" value={med.prescriptionType} />}
              {med.startDate && <Detail label="Start date" value={med.startDate} />}
              {med.endDate && <Detail label="End date" value={med.endDate} />}
              {med.lastIssuedDate && <Detail label="Last issued" value={med.lastIssuedDate} />}
              {med.prescriber && <Detail label="Prescriber" value={med.prescriber} />}
              {med.prescriberOrganisation && <Detail label="Practice" value={med.prescriberOrganisation} />}
              {med.additionalInformation && (
                <div className="col-span-2 mt-1">
                  <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">Additional information</span>
                  <p className="mt-0.5 text-nhs-grey-1 italic">{med.additionalInformation}</p>
                </div>
              )}
              <Detail label="FHIR ID" value={med.medicationStatementId} mono />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-nhs-grey-3 text-xs uppercase tracking-wide">{label}</span>
      <p className={`mt-0.5 text-nhs-grey-1 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}

function MedicationsTable({ medications, title, subtitle }: { medications: GpConnectMedication[]; title: string; subtitle?: string }) {
  if (medications.length === 0) return null
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2 px-3">
        <h3 className="text-sm font-semibold text-nhs-grey-2 uppercase tracking-wide">{title}</h3>
        {subtitle && <span className="text-xs text-nhs-grey-3">{subtitle}</span>}
      </div>
      <div className="border border-nhs-grey-5 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-nhs-grey-5 text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
              <th className="py-2 px-3">Drug</th>
              <th className="py-2 px-3">Dose / Frequency</th>
              <th className="py-2 px-3">Route</th>
              <th className="py-2 px-3">Start date</th>
              <th className="py-2 px-3">Last issued</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {medications.map(med => (
              <MedicationRow key={med.id} med={med} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type PrescriptionCategory = 'acute' | 'repeat' | 'repeat-dispensing' | 'prescribed-elsewhere' | 'other'

function getPrescriptionCategory(med: GpConnectMedication): PrescriptionCategory {
  const pt = med.prescriptionType?.toLowerCase() ?? ''
  if (pt.includes('elsewhere')) return 'prescribed-elsewhere'
  if (pt.includes('dispensing')) return 'repeat-dispensing'
  if (pt === 'repeat') return 'repeat'
  if (pt === 'acute') return 'acute'
  return 'other'
}

const categoryConfig: Record<PrescriptionCategory, { label: string; description: string }> = {
  'acute':                { label: 'Acute',                description: 'One-off prescriptions' },
  'repeat':               { label: 'Repeat',               description: 'Regular repeat prescriptions' },
  'repeat-dispensing':    { label: 'Repeat Dispensing',    description: 'Dispensed multiple times without reauthorisation' },
  'prescribed-elsewhere': { label: 'Prescribed Elsewhere', description: 'Prescribed outside this GP practice' },
  'other':                { label: 'Other / Unclassified', description: 'Prescription type not specified' },
}

export function MedicationsView({ record }: Props) {
  const isPast = (m: GpConnectMedication) => ['completed', 'stopped', 'entered-in-error'].includes(m.status)
  const isCurrent = (m: GpConnectMedication) => !isPast(m)

  const currentByCategory = (cat: PrescriptionCategory) =>
    record.medications.filter(m => isCurrent(m) && getPrescriptionCategory(m) === cat)

  const past = record.medications.filter(isPast)

  const currentCategories: PrescriptionCategory[] = ['acute', 'repeat', 'repeat-dispensing', 'prescribed-elsewhere', 'other']

  return (
    <div className="space-y-5">
      {/* Patient header */}
      {record.patient && (
        <div className="bg-nhs-blue rounded-lg px-4 py-3 text-white">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold">
              {[record.patient.givenName, record.patient.familyName].filter(Boolean).join(' ') || 'Unknown patient'}
            </span>
            <span className="text-sm opacity-80">
              {record.patient.dateOfBirth && `DOB: ${record.patient.dateOfBirth}`}
              {record.patient.gender && ` · ${record.patient.gender.charAt(0).toUpperCase() + record.patient.gender.slice(1)}`}
            </span>
          </div>
          <div className="flex gap-4 mt-1 text-sm opacity-80">
            {record.patient.nhsNumber && (
              <span>NHS No: <span className="font-mono font-semibold">{record.patient.nhsNumber}</span></span>
            )}
            {record.practiceOrganisation && <span>{record.practiceOrganisation}</span>}
          </div>
        </div>
      )}

      {/* Domain header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Medications &amp; Medical Devices</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {record.medications.length} medication{record.medications.length !== 1 ? 's' : ''} · click a row to expand
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>

      {currentCategories.map(cat => {
        const meds = currentByCategory(cat)
        if (meds.length === 0) return null
        const cfg = categoryConfig[cat]
        return (
          <MedicationsTable
            key={cat}
            medications={meds}
            title={`${cfg.label} (${meds.length})`}
            subtitle={cfg.description}
          />
        )
      })}

      <MedicationsTable medications={past} title={`Past medications (${past.length})`} />

      {record.medications.length === 0 && (
        <div className="text-center py-8 text-nhs-grey-3">
          <p className="text-sm">No medications found in this Bundle</p>
        </div>
      )}
    </div>
  )
}
