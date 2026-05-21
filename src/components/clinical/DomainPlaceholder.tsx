import { DOMAIN_MAP, type DomainId } from './domains'

interface Props {
  domainId: DomainId
}

export function DomainPlaceholder({ domainId }: Props) {
  const domain = DOMAIN_MAP[domainId]

  return (
    <div className="space-y-4">
      {/* Domain header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-grey-1">{domain.label}</h2>
          <p className="text-xs text-nhs-grey-3 mt-0.5">{domain.description}</p>
        </div>
        <span className="px-2 py-1 bg-nhs-grey-4 text-nhs-grey-2 text-xs font-semibold rounded shrink-0">
          Not yet implemented
        </span>
      </div>

      {/* Placeholder table */}
      <div className="border border-nhs-grey-4 rounded-lg overflow-hidden opacity-50">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-nhs-grey-5 text-xs font-semibold text-nhs-grey-2 uppercase tracking-wide">
              {domain.tableColumns.map(col => (
                <th key={col} className="py-2 px-3 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map(row => (
              <tr key={row} className="border-t border-nhs-grey-5">
                {domain.tableColumns.map((col, i) => (
                  <td key={col} className="py-2.5 px-3">
                    <div className={`h-3 rounded bg-nhs-grey-4 ${i === 0 ? 'w-32' : i === 1 ? 'w-20' : 'w-16'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FHIR resource info */}
      <div className="text-xs text-nhs-grey-3 flex items-center gap-2">
        <span className="font-medium text-nhs-grey-2">FHIR resources:</span>
        <div className="flex gap-1.5 flex-wrap">
          {domain.fhirResources.map(r => (
            <span key={r} className="font-mono bg-nhs-grey-5 border border-nhs-grey-4 px-1.5 py-0.5 rounded">
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
