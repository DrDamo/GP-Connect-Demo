export function SnomedCheckingBanner() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-nhs-blue/30 bg-blue-50 px-3 py-2 text-sm text-nhs-blue dark:border-nhs-blue/40 dark:bg-blue-950/40 dark:text-blue-300">
      <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      Checking all SNOMED CT codes…
    </div>
  )
}
