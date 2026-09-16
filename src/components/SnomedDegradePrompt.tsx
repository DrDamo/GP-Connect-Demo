import { createPortal } from 'react-dom'
import type { SnomedCodingRef } from '../fhir/snomedDegrade'
import { extractOriginalTermText } from '../fhir/utils'

interface Props {
  invalidRefs: SnomedCodingRef[]
  onKeepOriginal: () => void
  onTransferDegrade: () => void
}

/**
 * Blocks the workspace on import when the bundle contains SNOMED CT/dm+d
 * codes the terminology server doesn't recognise, asking whether to leave
 * the JSON exactly as uploaded or to transfer-degrade those entries the way
 * a real GP2GP-receiving consumer system would. Locked — no backdrop/Escape
 * dismiss — since the choice determines what gets shown for the rest of the
 * session and there's no sensible default to fall back to.
 */
export function SnomedDegradePrompt({ invalidRefs, onKeepOriginal, onTransferDegrade }: Props) {
  const count = invalidRefs.length
  const preview = invalidRefs.slice(0, 5)

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg border border-nhs-grey-4 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {count} code{count === 1 ? '' : 's'} not recognised by the terminology server
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This bundle contains {count} SNOMED CT / dm+d code{count === 1 ? '' : 's'} that
            didn&rsquo;t resolve against the terminology server. A real consuming system would
            transfer-degrade these entries on receipt — but you can also keep the file exactly
            as uploaded to inspect the original codes.
          </p>

          <div className="rounded border border-nhs-grey-4 dark:border-gray-700 divide-y divide-nhs-grey-4 dark:divide-gray-700 max-h-40 overflow-y-auto">
            {preview.map((ref, i) => {
              const term = extractOriginalTermText(ref.codeableConcept as unknown as fhir3.CodeableConcept)
              return (
                <div key={i} className="px-2.5 py-1.5 text-xs">
                  <span className="font-mono text-nhs-grey-2 dark:text-gray-300">{ref.coding.code}</span>
                  {term && <span className="text-nhs-grey-3 dark:text-gray-500"> — {term}</span>}
                  <div className="text-nhs-grey-3 dark:text-gray-500 truncate">{ref.resourceType}</div>
                </div>
              )
            })}
            {count > preview.length && (
              <div className="px-2.5 py-1.5 text-xs text-nhs-grey-3 dark:text-gray-500 italic">
                …and {count - preview.length} more
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onKeepOriginal}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 border border-nhs-grey-4 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Keep JSON unchanged
          </button>
          <button
            type="button"
            onClick={onTransferDegrade}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-nhs-blue hover:bg-nhs-blue-dark transition-colors"
          >
            Transfer-degrade entries
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
