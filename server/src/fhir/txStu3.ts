// Adapts the NHS England Terminology Server (Ontoserver, FHIR R4) for the
// HL7 validator's STU3 terminology client. Only the capability statements
// differ in ways that client cannot read; the operations it uses
// ($validate-code, $expand, $lookup) are close enough between versions.

type Json = Record<string, unknown> & { [k: string]: unknown }

/** The UK edition (clinical + drug extension). The validator asks with no
 *  SNOMED version, and the server would otherwise not use the UK edition. */
export const UK_SNOMED_EDITION = 'http://snomed.info/sct/83821000000107'
const SNOMED = 'http://snomed.info/sct'

/** R4 CapabilityStatement -> STU3: `profile` and operation `definition`
 *  are References in STU3, not canonical strings. */
export function toStu3CapabilityStatement(cs: Json): Json {
  const out = structuredClone(cs)
  out.fhirVersion = '3.0.1'
  delete out.instantiates
  delete out.imports
  for (const rest of (out.rest as Json[] | undefined) ?? []) {
    const ops = [...((rest.operation as Json[] | undefined) ?? [])]
    for (const r of (rest.resource as Json[] | undefined) ?? []) {
      if (typeof r.profile === 'string') r.profile = { reference: r.profile }
      delete r.supportedProfile
      ops.push(...((r.operation as Json[] | undefined) ?? []))
    }
    for (const o of ops) if (typeof o.definition === 'string') o.definition = { reference: o.definition }
  }
  return out
}

/** R4 TerminologyCapabilities -> the STU3 tx convention, a Parameters list of
 *  `system` + `version` entries. Every system also gets a version-less entry,
 *  or the validator refuses codings that carry no version (all of them). */
export function toStu3TerminologyParameters(tc: Json): Json {
  const parameter: Json[] = [
    { name: 'url', valueUri: (tc.url as string) ?? 'urn:nhs-terminology-server' },
    { name: 'version', valueCode: (tc.version as string) ?? '1' },
  ]
  if (typeof tc.date === 'string') parameter.push({ name: 'date', valueDateTime: tc.date })
  for (const c of (tc.codeSystem as Json[] | undefined) ?? []) {
    if (typeof c.uri !== 'string') continue
    parameter.push({ name: 'system', valueUri: c.uri }, { name: 'version' })
    for (const v of (c.version as Json[] | undefined) ?? []) {
      if (typeof v.code === 'string') parameter.push({ name: 'version', valueCode: v.code })
    }
  }
  return { resourceType: 'Parameters', parameter }
}

/** Adapts an operation's STU3 Parameters body for the R4 server: pins SNOMED
 *  CT to the UK edition, and turns a single `identifier` on an embedded
 *  resource (e.g. a ValueSet) into the list R4 requires. */
export function adaptParameters(params: Json): Json {
  if (params.resourceType !== 'Parameters') return params
  const out = structuredClone(params)
  // Resources can sit at any depth (parameter parts, contained resources).
  const fixIdentifiers = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(fixIdentifiers); return }
    if (!node || typeof node !== 'object') return
    const o = node as Json
    if (typeof o.resourceType === 'string' && o.identifier && !Array.isArray(o.identifier)) o.identifier = [o.identifier]
    Object.values(o).forEach(fixIdentifiers)
  }
  fixIdentifiers(out.parameter)
  const kept = ((out.parameter as Json[] | undefined) ?? []).filter(p => {
    if (!/system-version$/.test(String(p.name))) return true
    const v = String(p.valueUri ?? p.valueCanonical ?? '')
    return !v.startsWith(SNOMED + '|')
  })
  kept.push({ name: 'force-system-version', valueCanonical: `${SNOMED}|${UK_SNOMED_EDITION}` })
  out.parameter = kept
  return out
}
