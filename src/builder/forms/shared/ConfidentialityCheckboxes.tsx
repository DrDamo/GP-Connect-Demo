export interface ConfidentialityUpdates {
  confidential?: boolean
  notForPfs?: boolean
}

export interface ConfidentialityCheckboxesProps {
  confidential?: boolean
  notForPfs?: boolean
  onChange: (updates: ConfidentialityUpdates) => void
}

// Shown on every top-level clinical item across the Record Builder.
// "Confidential" items are visible here but excluded entirely from the
// generated JSON (a confidential-items warning is added to that domain's
// List instead). "Not for PFS" items are still output, but carry a NOPAT
// security label so patient-facing services withhold them.
export function ConfidentialityCheckboxes({ confidential, notForPfs, onChange }: ConfidentialityCheckboxesProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <label className="flex items-center gap-1.5 cursor-pointer" title="Shown here in the builder, but never output in the generated JSON — a confidential-items warning is added to this domain's List instead.">
        <input
          type="checkbox"
          checked={confidential ?? false}
          onChange={e => onChange({ confidential: e.target.checked })}
          className="rounded border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-blue focus:ring-nhs-blue"
        />
        <span className="text-nhs-grey-2 dark:text-gray-300">Confidential</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer" title="Output as normal, but tagged with a NOPAT security label so patient-facing services withhold it.">
        <input
          type="checkbox"
          checked={notForPfs ?? false}
          onChange={e => onChange({ notForPfs: e.target.checked })}
          className="rounded border-nhs-grey-4 dark:border-nhs-grey-2 text-nhs-blue focus:ring-nhs-blue"
        />
        <span className="text-nhs-grey-2 dark:text-gray-300">Not for PFS</span>
      </label>
    </div>
  )
}
