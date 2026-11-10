// Text this app writes into a CodeableConcept when it transfer-degrades a
// SNOMED CT code: "<original term> (degraded from SNOMED CT <code>)".
export const DEGRADED_TEXT_PATTERN = /^(.*) \(degraded from SNOMED CT (\d+)\)$/

// Whether DegradedTermText will already render an interactive "Degrade" tag
// for this text (i.e. it carries the marker this app appends when it degrades
// a code itself). Callers that separately show a plain "Degrade" tag for
// isTransferDegraded (records that arrived already degraded from GP2GP) must
// check this first, otherwise codes degraded by this app get both — the
// interactive one from here and a second, non-interactive one from them.
export function hasDegradeMarker(text?: string): boolean {
  return !!text && DEGRADED_TEXT_PATTERN.test(text)
}
