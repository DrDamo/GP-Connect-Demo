import { useState } from 'react'
import type { GpConnectBundle, GpConnectInvestigation } from '../../fhir/types'
import { DomainTable, StatusBadge } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const COLUMNS: DomainColumn<GpConnectInvestigation>[] = [
  { label: 'Date', render: item => item.date ?? 'Unknown' },
  {
    label: 'Investigation',
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">{item.name}</div>
        {item.snomedCode && (
          <div className="text-xs text-nhs-grey-3 font-mono mt-0.5">{item.snomedCode}</div>
        )}
      </div>
    ),
  },
  {
    label: 'Result',
    render: item => {
      const parts = [item.result, item.unit].filter(Boolean)
      return parts.length > 0 ? parts.join(' ') : '—'
    },
  },
  { label: 'Reference range', render: item => item.referenceRange ?? '—' },
  { label: 'Interpretation',  render: item => item.interpretation ?? '—' },
  { label: 'Performer',       render: item => item.performer ?? '—' },
]

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex gap-2 min-w-0">
      <span className="text-xs text-nhs-grey-3 shrink-0 w-36">{label}</span>
      <span className="text-xs text-nhs-grey-1 min-w-0">{value}</span>
    </div>
  )
}

function interpretationClass(value?: string): string {
  if (!value) return ''
  const v = value.toLowerCase()
  if (v === 'high' || v === 'h' || v === 'hh' || v === 'critically high') return 'text-red-700 font-semibold'
  if (v === 'low' || v === 'l' || v === 'll' || v === 'critically low') return 'text-blue-700 font-semibold'
  if (v === 'normal' || v === 'n') return 'text-green-700'
  return ''
}

function InvestigationDetail({ investigation, bundle, onJumpToSource, onJumpToRecord }: { investigation: GpConnectInvestigation; bundle: GpConnectBundle; onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void }) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const refs = [
    investigation.performerId  ? { type: 'Practitioner' as const, id: investigation.performerId,  label: 'Performer' } : null,
    investigation.encounterId  ? { type: 'Encounter'    as const, id: investigation.encounterId,  label: 'Encounter' } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  const hasResults = investigation.results.length > 0
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{investigation.name}</h3>
        {investigation.interpretation && <StatusBadge value={investigation.interpretation} />}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {investigation.snomedCode && (
          <DetailRow label="SNOMED code" value={<span className="font-mono">{investigation.snomedCode}</span>} />
        )}
        <DetailRow label="Date" value={investigation.date} />
        <DetailRow label="Performer" value={
          investigation.performer
            ? investigation.performerId
              ? <ReferenceChip label={investigation.performer} onClick={() => toggle(investigation.performerId!)} active={openResourceId === investigation.performerId} />
              : investigation.performer
            : undefined
        } />
      </div>
      {hasResults && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-nhs-blue/20">
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Result</th>
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Value</th>
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Range</th>
                <th className="text-left py-1.5 text-nhs-grey-3 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {investigation.results.map(r => {
                const valueText = [r.value, r.unit].filter(Boolean).join(' ') || '—'
                const intClass = interpretationClass(r.interpretation)
                return (
                  <>
                    <tr key={r.id} className="border-b border-nhs-blue/10 last:border-0">
                      <td className="py-1.5 pr-4 text-nhs-grey-1">
                        <div>
                          {r.name}
                          {r.snomedCode && (
                            <span className="ml-1.5 font-mono text-nhs-grey-3">{r.snomedCode}</span>
                          )}
                        </div>
                        <div className="flex gap-3 mt-0.5">
                          {onJumpToRecord && (
                            <button
                              onClick={() => onJumpToRecord('investigations', r.reportId)}
                              className="text-[11px] text-nhs-blue hover:underline"
                            >
                              Go to investigation →
                            </button>
                          )}
                          {onJumpToSource && (
                            <button
                              onClick={() => onJumpToSource(r.id)}
                              className="text-[11px] text-nhs-grey-3 hover:text-nhs-grey-1 hover:underline"
                            >
                              View FHIR ↗
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={`py-1.5 pr-4 font-medium ${intClass}`}>{valueText}</td>
                      <td className="py-1.5 pr-4 text-nhs-grey-2">{r.referenceRange ?? '—'}</td>
                      <td className={`py-1.5 ${intClass}`}>{r.interpretation ?? '—'}</td>
                    </tr>
                    {r.components?.map((c, ci) => (
                      <tr key={`${r.id}-c${ci}`} className="border-b border-nhs-blue/10 last:border-0 bg-white/40">
                        <td className="py-1 pr-4 pl-4 text-nhs-grey-2 italic">{c.name}</td>
                        <td className={`py-1 pr-4 ${interpretationClass(c.interpretation)}`}>
                          {[c.value, c.unit].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="py-1 pr-4 text-nhs-grey-3">{c.referenceRange ?? '—'}</td>
                        <td className={`py-1 ${interpretationClass(c.interpretation)}`}>{c.interpretation ?? '—'}</td>
                      </tr>
                    ))}
                    {r.comment && (
                      <tr key={`${r.id}-note`} className="border-b border-nhs-blue/10 last:border-0">
                        <td colSpan={4} className="py-1 pr-4 text-nhs-grey-3 italic">{r.comment}</td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ReferencedResources
        refs={refs}
        practitioners={bundle.practitioners}
        organisations={bundle.organisations}
        healthcareServices={bundle.healthcareServices}
        consultations={bundle.consultations}
        highlightedId={openResourceId ?? undefined}
        onJumpToSource={onJumpToSource}
        onJumpToRecord={onJumpToRecord}
      />
    </div>
  )
}

export function InvestigationsView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const count = bundle.investigations.length
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Investigations</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <DomainTable
        columns={COLUMNS}
        items={bundle.investigations}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No investigation records found in this bundle"
        expandedContent={investigation => <InvestigationDetail investigation={investigation} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}
