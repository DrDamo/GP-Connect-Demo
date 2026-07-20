import { useState } from 'react'
import type { GpConnectBundle, GpConnectCodedDataItem } from '../../fhir/types'
import { formatCodedDataValue } from '../../fhir/utils'
import { DomainTable, DegradedTermText, hasDegradeMarker } from './DomainTable'
import type { DomainColumn } from './DomainTable'
import { ReferencedResources } from './ReferencedResources'
import { ReferenceChip } from './ResourceCard'
import { type DomainId } from './domains'
import { InfoHint } from '../../onboarding/InfoHint'
import { SearchFilterBox } from './SearchFilterBox'

function codedDataSearchText(item: GpConnectCodedDataItem): string {
  return [
    item.description, item.category, item.snomedCode, item.date, item.value, item.unit,
    item.performer, item.organisation, item.comment, item.interpretation,
    ...(item.components ?? []).flatMap(c => [c.name, c.value, c.unit, c.referenceRange, c.interpretation]),
  ].filter(Boolean).join(' ').toLowerCase()
}

interface Props {
  bundle: GpConnectBundle
  selectedId?: string
  onSelect?: (id: string) => void
  onJumpToSource?: (id: string) => void
  onJumpToRecord?: (domain: DomainId, id: string) => void
}

const COLUMNS: DomainColumn<GpConnectCodedDataItem>[] = [
  {
    label: 'Date',
    className: 'w-28',
    render: item => item.date ?? 'Unknown',
  },
  {
    label: 'Description',
    render: item => (
      <div>
        <div className="font-medium text-nhs-grey-1">
          <DegradedTermText text={item.description} />
          {item.isTransferDegraded && !hasDegradeMarker(item.description) && (
            <span className="inline-block ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium leading-none align-middle">Degrade</span>
          )}
        </div>
        {item.category && (
          <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-nhs-grey-5 text-nhs-grey-2 border border-nhs-grey-4 font-medium">
            {item.category}
          </span>
        )}
      </div>
    ),
  },
  {
    label: 'Value',
    className: 'w-32',
    render: item => formatCodedDataValue(item) ?? '',
  },
  {
    label: 'Performer',
    render: item => item.performer ?? '—',
  },
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

function CodedDataDetail({ item, bundle, onJumpToSource, onJumpToRecord }: { item: GpConnectCodedDataItem; bundle: GpConnectBundle; onJumpToSource?: (id: string) => void; onJumpToRecord?: (domain: DomainId, id: string) => void }) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenResourceId(prev => prev === id ? null : id)

  const refs = [
    item.performerId    ? { type: 'Practitioner' as const, id: item.performerId,    label: 'Performer'    } : null,
    item.organisationId ? { type: 'Organisation' as const, id: item.organisationId, label: 'Organisation' } : null,
    item.encounterId    ? { type: 'Encounter'    as const, id: item.encounterId,    label: 'Encounter'    } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null)

  const valueText = [item.value, item.unit].filter(Boolean).join(' ') || undefined
  const hasComponents = (item.components?.length ?? 0) > 0
  return (
    <div className="border border-nhs-blue/20 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-nhs-grey-1">{item.description}</h3>
        {item.interpretation && <span className="text-xs font-medium text-amber-700">{item.interpretation}</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {item.category && (
          <DetailRow label="Category" value={item.category} />
        )}
        {item.snomedCode && (
          <DetailRow label="SNOMED code" value={<span className="font-mono">{item.snomedCode}</span>} />
        )}
        <DetailRow label="Date" value={item.date} />
        {valueText && (
          <DetailRow label="Value" value={<span className="font-semibold">{valueText}</span>} />
        )}
        <DetailRow label="Performer" value={
          item.performer
            ? item.performerId
              ? <ReferenceChip label={item.performer} onClick={() => toggle(item.performerId!)} active={openResourceId === item.performerId} />
              : item.performer
            : undefined
        } />
        <DetailRow label="Organisation" value={
          item.organisation
            ? item.organisationId
              ? <ReferenceChip label={item.organisation} onClick={() => toggle(item.organisationId!)} active={openResourceId === item.organisationId} />
              : item.organisation
            : undefined
        } />
      </div>
      {item.comment && (
        <div className="pt-1 border-t border-nhs-blue/20">
          <span className="text-xs text-nhs-grey-3 uppercase tracking-wide">Comment</span>
          <p className="mt-0.5 text-xs text-nhs-grey-1 break-words">{item.comment}</p>
        </div>
      )}
      {hasComponents && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-nhs-blue/20">
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Component</th>
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Value</th>
                <th className="text-left py-1.5 pr-4 text-nhs-grey-3 font-medium">Range</th>
                <th className="text-left py-1.5 text-nhs-grey-3 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {item.components!.map((c, i) => (
                <tr key={i} className="border-b border-nhs-blue/10 last:border-0">
                  <td className="py-1.5 pr-4 text-nhs-grey-1">{c.name}</td>
                  <td className="py-1.5 pr-4 font-medium">{[c.value, c.unit].filter(Boolean).join(' ') || '—'}</td>
                  <td className="py-1.5 pr-4 text-nhs-grey-2">{c.referenceRange ?? '—'}</td>
                  <td className="py-1.5 text-nhs-grey-2">{c.interpretation ?? '—'}</td>
                </tr>
              ))}
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

export function CodedDataView({ bundle, selectedId, onSelect, onJumpToSource, onJumpToRecord }: Props) {
  const count = bundle.codedData.length
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredCodedData = trimmedQuery
    ? bundle.codedData.filter(i => codedDataSearchText(i).includes(trimmedQuery))
    : bundle.codedData
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">Coded Data</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">
            {count} record{count !== 1 ? 's' : ''}
            {onSelect ? ' · click a row to expand' : ''}
          </p>
        </div>
        <span className="px-2 py-1 bg-nhs-blue text-white text-xs font-semibold rounded">GP Connect STU3</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-nhs-grey-5 border border-nhs-grey-4 text-xs text-nhs-grey-2">
        <svg className="w-3.5 h-3.5 shrink-0 text-nhs-grey-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
        Laboratory investigation results are excluded from this view — see the Investigations section.
        <InfoHint topic="clinical.coded-data.scope-note" />
        <InfoHint topic="clinical.coded-data.bp-pairing" />
      </div>
      <SearchFilterBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search coded data…"
        matchCount={filteredCodedData.length}
        totalCount={count}
      />
      <DomainTable
        columns={COLUMNS}
        items={filteredCodedData}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage="No coded data records found in this bundle"
        expandedContent={item => <CodedDataDetail item={item} bundle={bundle} onJumpToSource={onJumpToSource} onJumpToRecord={onJumpToRecord} />}
      />
    </div>
  )
}
