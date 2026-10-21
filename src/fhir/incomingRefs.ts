import type * as fhir3 from 'fhir/r3'
import { getBundleIndex, lookupReference, type AnyResource } from './bundleIndex'
import { resolveItemDisplay, extractOriginalTermText } from './utils'
import { titleIndexKey } from './lineIndex'
import type { IncomingRef } from './types'

/** Builds the reverse of every reference in the bundle: for each target
 * `Type/id`, which resources point at it and through which element.
 *
 * The Patient is left out — nearly every resource references it via
 * subject/patient, so a "referenced by" list for it would just be the
 * whole record. */
export function buildIncomingRefs(bundle: fhir3.Bundle): Record<string, IncomingRef[]> {
  const index = getBundleIndex(bundle)
  const out: Record<string, IncomingRef[]> = {}
  const seen = new Set<string>()

  const sources: AnyResource[] = []
  for (const r of index.all) {
    sources.push(r)
    for (const c of (r as { contained?: AnyResource[] }).contained ?? []) sources.push(c)
  }

  for (const source of sources) {
    const sourceId = idForNavigation(source)
    let label: string | undefined
    const labelOf = () => (label ??= sourceLabel(bundle, source))

    walkReferences(source, source.resourceType, (ref, path) => {
      const target = lookupReference(index, ref)
      if (!target?.id || target === source || target.resourceType === 'Patient') return
      const key = `${target.resourceType}/${target.id}`
      const dedupe = `${key}|${source.resourceType}/${sourceId}|${path}`
      if (seen.has(dedupe)) return
      seen.add(dedupe)
      ;(out[key] ??= []).push({
        sourceType: source.resourceType,
        sourceId,
        path,
        label: labelOf(),
        contained: index.containerOf.has(source),
      })
    })
  }
  return out
}

// Top-level GP Connect Lists normally have no id; extractLists keys them by
// title (titleIndexKey), so use the same key to let the UI jump to them.
function idForNavigation(r: AnyResource): string {
  if (r.id) return r.id
  const title = (r as { title?: string }).title
  return r.resourceType === 'List' && title ? titleIndexKey(title) : ''
}

function sourceLabel(bundle: fhir3.Bundle, r: AnyResource): string | undefined {
  if (r.resourceType === 'List') return (r as fhir3.List).title ?? extractOriginalTermText((r as fhir3.List).code)
  if (r.resourceType === 'QuestionnaireResponse') {
    return (r as fhir3.QuestionnaireResponse).item?.[0]?.linkId ?? (r as fhir3.QuestionnaireResponse).item?.[0]?.text
  }
  return r.id ? resolveItemDisplay(bundle, `${r.resourceType}/${r.id}`) : undefined
}

/** Calls `visit` for every `{ reference }` under `node`, with a FHIRPath-like
 * element path (array indices dropped; extensions named by their short URL,
 * e.g. `Condition.extension(RelatedClinicalContent).valueReference`).
 * Does not descend into `contained` — those are walked as sources in their own right. */
export function walkReferences(node: unknown, path: string, visit: (ref: string, path: string) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkReferences(item, path, visit)
    return
  }
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (typeof obj.reference === 'string') visit(obj.reference, path)
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'contained' || key === 'reference') continue
    if ((key === 'extension' || key === 'modifierExtension') && Array.isArray(value)) {
      for (const ext of value as { url?: string }[]) walkReferences(ext, `${path}.${key}(${shortExtensionName(ext?.url)})`, visit)
      continue
    }
    if (value && typeof value === 'object') walkReferences(value, `${path}.${key}`, visit)
  }
}

export function shortExtensionName(url: string | undefined): string {
  if (!url) return '?'
  return url
    .split('/').pop()!
    .replace(/^Extension-(CareConnect-(GPC-)?|UKCore-)?/, '')
    .replace(/-\d+$/, '')
}
