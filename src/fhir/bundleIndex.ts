import type * as fhir3 from 'fhir/r3'

export type AnyResource = fhir3.Resource & { resourceType: string }

/** Lookup tables built once per bundle object. Real exports run to 2,500+
 * entries and every extractor resolves references repeatedly, so a linear
 * scan per lookup adds up to seconds on load. */
export interface BundleIndex {
  /** `Type/id` and entry.fullUrl → first resource in bundle order */
  byRef: Map<string, AnyResource>
  /** Contained resource id → first contained resource with that id (any container) */
  contained: Map<string, AnyResource>
  /** Contained resource → the bundle entry resource that contains it */
  containerOf: Map<AnyResource, AnyResource>
  /** resourceType → entries, de-duplicated by id (first occurrence wins) */
  byType: Map<string, AnyResource[]>
  /** Every top-level entry resource, in bundle order */
  all: AnyResource[]
}

// Bundles are treated as immutable once loaded (SNOMED transfer-degrade edits
// codings in place but never ids or fullUrls), so a WeakMap keyed on the
// bundle object is a safe cache that's collected with the bundle.
const cache = new WeakMap<fhir3.Bundle, BundleIndex>()

export function getBundleIndex(bundle: fhir3.Bundle): BundleIndex {
  const hit = cache.get(bundle)
  if (hit) return hit

  const index: BundleIndex = {
    byRef: new Map(),
    contained: new Map(),
    containerOf: new Map(),
    byType: new Map(),
    all: [],
  }
  const seenTypeIds = new Set<string>()

  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as AnyResource | undefined
    if (!r?.resourceType) continue
    index.all.push(r)

    // Some vendor exports include the exact same resource id twice within a
    // single bundle (invalid per the FHIR spec, but seen in real GP Connect
    // exports) — keep the first occurrence so the same clinical record is
    // never rendered as two rows.
    const typeId = r.id ? `${r.resourceType}/${r.id}` : undefined
    if (!typeId || !seenTypeIds.has(typeId)) {
      if (typeId) seenTypeIds.add(typeId)
      const list = index.byType.get(r.resourceType)
      if (list) list.push(r)
      else index.byType.set(r.resourceType, [r])
    }

    if (typeId && !index.byRef.has(typeId)) index.byRef.set(typeId, r)
    // fullUrl lets `urn:uuid:` and absolute references resolve, which are
    // legal in collection bundles even though GP Connect suppliers mostly
    // use relative `Type/id` references.
    if (entry.fullUrl && !index.byRef.has(entry.fullUrl)) index.byRef.set(entry.fullUrl, r)

    for (const c of (r as { contained?: AnyResource[] }).contained ?? []) {
      index.containerOf.set(c, r)
      if (c.id && !index.contained.has(c.id)) index.contained.set(c.id, c)
    }
  }

  cache.set(bundle, index)
  return index
}

export function lookupReference(index: BundleIndex, ref: string | undefined): AnyResource | undefined {
  if (!ref) return undefined
  // Local contained reference (#id). Strictly these are scoped to the
  // containing resource, but GP Connect only uses them for the Ended
  // allergies List, so a bundle-wide lookup is sufficient.
  if (ref.startsWith('#')) return index.contained.get(ref.slice(1))

  const exact = index.byRef.get(ref)
  if (exact) return exact

  // Absolute URL ending in Type/id (e.g. https://server/fhir/Patient/123).
  // A bare id is intentionally never matched on its own: ignoring the type
  // causes wrong matches when two resources share an id (Organization/1 vs
  // Patient/1).
  const parts = ref.split('/')
  if (parts.length > 2) return index.byRef.get(parts.slice(-2).join('/'))
  return undefined
}
