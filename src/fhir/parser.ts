import { fhirXmlToJson } from './xmlToFhir'

export type ParseResult =
  /** `wrapped`: the JSON wasn't a Bundle and was wrapped into one, so the
   * original text no longer lines up with `data` — callers should re-serialise. */
  | { ok: true; data: fhir3.Bundle; format: 'json' | 'xml'; wrapped?: boolean }
  | { ok: false; error: string; format: 'json' | 'xml' | 'unknown' }

function detectFormat(text: string): 'json' | 'xml' | 'unknown' {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('<')) return 'xml'
  return 'unknown'
}

// Windows editors (Notepad, PowerShell Out-File) often save JSON with a UTF-8
// byte-order mark, which JSON.parse rejects as an unexpected token.
export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

/** Coerces parsed JSON into a Bundle: accepts a Bundle, a Parameters resource
 * wrapping a Bundle, a bare array of resources, an entry-only object, or a
 * single resource (e.g. an OperationOutcome error response). `wrapped` is true
 * when the result differs structurally from the input. */
function normalizeFhirJson(parsed: unknown):
  | { ok: true; data: fhir3.Bundle; wrapped: boolean }
  | { ok: false; error: string } {
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, error: 'Content is not recognisable FHIR JSON' }
  }

  if (Array.isArray(parsed)) {
    return {
      ok: true,
      wrapped: true,
      data: {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: parsed.map(r => ({ resource: (r as { resource?: unknown })?.resource ?? r })),
      } as fhir3.Bundle,
    }
  }

  const obj = parsed as Record<string, unknown>

  if (obj['resourceType'] === 'Bundle') {
    return { ok: true, wrapped: false, data: obj as unknown as fhir3.Bundle }
  }

  if (obj['resourceType'] === 'Parameters' && Array.isArray(obj['parameter'])) {
    const inner = (obj['parameter'] as { resource?: { resourceType?: string } }[])
      .map(p => p.resource)
      .find(r => r?.resourceType === 'Bundle')
    if (inner) return { ok: true, wrapped: true, data: inner as unknown as fhir3.Bundle }
  }

  if (Array.isArray(obj['entry']) && !obj['resourceType']) {
    return { ok: true, wrapped: true, data: { ...obj, resourceType: 'Bundle' } as unknown as fhir3.Bundle }
  }

  if (typeof obj['resourceType'] === 'string') {
    return {
      ok: true,
      wrapped: true,
      data: { resourceType: 'Bundle', type: 'searchset', entry: [{ resource: obj }] } as fhir3.Bundle,
    }
  }

  return { ok: false, error: 'Content has no resourceType or entry array — expected a FHIR Bundle, a resource, or an array of resources' }
}

export function normalizePastedJson(text: string):
  | { ok: true; data: fhir3.Bundle }
  | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripBom(text))
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${(e as Error).message}` }
  }
  const normalized = normalizeFhirJson(parsed)
  return normalized.ok ? { ok: true, data: normalized.data } : normalized
}

export function parseBundle(text: string): ParseResult {
  text = stripBom(text)
  const format = detectFormat(text)

  if (format === 'unknown') {
    return { ok: false, error: 'File does not appear to be JSON or XML', format: 'unknown' }
  }

  if (format === 'json') {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return { ok: false, error: `JSON parse error: ${(e as Error).message}`, format: 'json' }
    }
    const normalized = normalizeFhirJson(parsed)
    if (!normalized.ok) return { ...normalized, format: 'json' }
    return { ok: true, data: normalized.data, format: 'json', wrapped: normalized.wrapped }
  }

  // XML. FHIR forbids DTDs, and refusing them up front rules out entity
  // expansion ("billion laughs") before the parser sees the text.
  if (/<!DOCTYPE/i.test(text)) {
    return { ok: false, error: 'XML parse error: DOCTYPE declarations are not allowed in FHIR XML', format: 'xml' }
  }
  let root: Record<string, unknown>
  try {
    root = fhirXmlToJson(text)
  } catch (e) {
    return { ok: false, error: `XML parse error: ${(e as Error).message}`, format: 'xml' }
  }
  const normalized = normalizeFhirJson(root)
  if (!normalized.ok) return { ...normalized, format: 'xml' }
  // `wrapped` is left unset: the Inspector keeps showing the original XML.
  return { ok: true, data: normalized.data, format: 'xml' }
}
