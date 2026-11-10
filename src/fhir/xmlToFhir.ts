import { XMLParser } from 'fast-xml-parser'

// FHIR STU3 XML → FHIR JSON.
//
// fast-xml-parser has no FHIR schema, so on its own it cannot tell a repeating
// element that happens to occur once (`<coding>` in a CodeableConcept) from a
// singleton. Every element is therefore parsed as an array here, and
// `isRepeating()` decides — from STU3 cardinalities of the elements GP
// Connect bundles use — whether a lone occurrence becomes `[x]` or `x`. An
// element that occurs more than once is always an array.
//
// Also handled, per the FHIR JSON representation rules:
//  - `value` / `url` / `id` attributes, including primitive extensions (`_name`)
//  - Resource-typed elements (`resource`, `contained`, `outcome`) whose child
//    element names the resource type
//  - XHTML narrative (`text.div`), kept as an XHTML string
//  - booleans and numbers, which XML carries as strings

type XmlNode = Record<string, unknown>

const ATTR = '@_'
const TEXT = '#text'
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

/** Elements that repeat (0..* / 1..*) in every STU3 context they appear in
 *  for the resources and datatypes GP Connect uses. */
const ALWAYS_REPEATING = new Set([
  // datatypes
  'extension', 'modifierExtension', 'coding', 'given', 'prefix', 'suffix', 'line',
  'telecom', 'profile', 'security', 'tag', 'event', 'dayOfWeek', 'timeOfDay', 'when',
  'additionalInstruction',
  // Bundle / List / Composition / Parameters / OperationOutcome
  'entry', 'link', 'section', 'attester', 'relatesTo', 'parameter', 'issue', 'part',
  // shared resource elements
  'contained', 'note', 'contact', 'communication', 'qualification', 'generalPractitioner',
  'alias', 'endpoint', 'photo', 'basedOn', 'reasonCode', 'reasonReference', 'participant',
  'diagnosis', 'episodeOfCare', 'incomingReferral', 'account', 'statusHistory',
  'classHistory', 'reaction', 'manifestation', 'evidence', 'component',
  'referenceRange', 'related', 'result', 'codedDiagnosis', 'presentedForm', 'image',
  'derivedFrom', 'dosage', 'dosageInstruction', 'reasonNotTaken', 'reasonNotGiven',
  'targetDisease', 'vaccinationProtocol', 'supportingInformation', 'supportingInfo',
  'serviceRequested', 'recipient', 'replaces', 'definition', 'relevantHistory',
  'ingredient', 'container', 'processing', 'healthcareService',
  'availableTime', 'notAvailable', 'daysOfWeek', 'securityLabel', 'reason',
  'expression', 'focalDevice', 'usedReference', 'usedCode', 'complication',
  'followUp', 'report', 'complicationDetail',
])

/** ALWAYS_REPEATING elements that are singletons at these paths. */
const SINGLETON_PATHS = new Set([
  'Flag.author',
  'Location.partOf', 'Organization.partOf',
  'Location.address', 'Patient.contact.address', 'Organization.contact.address',
])

/** Elements whose cardinality depends on where they appear: repeating only at
 *  these paths (resource type, then element names from the resource root). */
const REPEATING_PATHS = new Set([
  'Patient.name', 'Practitioner.name', 'RelatedPerson.name', 'Person.name',
  'Patient.address', 'Practitioner.address', 'Organization.address', 'RelatedPerson.address', 'Person.address',
  'Encounter.type', 'Encounter.participant.type', 'Organization.type', 'HealthcareService.type',
  'Appointment.participant.type', 'Appointment.serviceType', 'Appointment.specialty',
  'Encounter.location', 'PractitionerRole.location', 'HealthcareService.location',
  'PractitionerRole.code', 'PractitionerRole.specialty', 'HealthcareService.specialty',
  'Condition.evidence.code', 'Condition.category', 'Observation.category',
  'AllergyIntolerance.category', 'ProcedureRequest.category', 'CarePlan.category',
  'Condition.bodySite', 'Procedure.bodySite', 'ProcedureRequest.bodySite',
  'Observation.performer', 'DiagnosticReport.performer', 'Procedure.performer',
  'MedicationStatement.partOf', 'Procedure.partOf', 'MedicationAdministration.partOf',
  'DiagnosticReport.specimen', 'ProcedureRequest.specimen',
  'Composition.author', 'DocumentReference.author', 'DocumentReference.content',
  'Medication.package.content', 'Medication.package.batch',
  'Immunization.practitioner', 'Immunization.explanation.reason',
  'Specimen.container.identifier', 'Specimen.note', 'Specimen.request', 'Specimen.parent',
  'Condition.evidence.detail', 'Questionnaire.item',
  'QuestionnaireResponse.parent', 'QuestionnaireResponse.basedOn', 'QuestionnaireResponse.item',
  'QuestionnaireResponse.item.answer', 'QuestionnaireResponse.item.item', 'QuestionnaireResponse.item.answer.item',
  'Patient.contact.relationship', 'RelatedPerson.relationship',
  'OperationOutcome.issue.location',
  'Schedule.actor', 'Schedule.serviceType', 'Slot.serviceType',
])

/** Resources whose own `identifier` is 0..1. `identifier` elsewhere below a
 *  resource root (Reference.identifier, …) is a singleton too. */
const SINGLE_IDENTIFIER_RESOURCES = new Set(['Bundle', 'Composition', 'QuestionnaireResponse'])

function isRepeating(name: string, path: string, atResourceRoot: boolean, resourceType: string): boolean {
  if (name === 'identifier') {
    if (atResourceRoot) return !SINGLE_IDENTIFIER_RESOURCES.has(resourceType)
    return REPEATING_PATHS.has(path)
  }
  if (ALWAYS_REPEATING.has(name)) return !SINGLETON_PATHS.has(path)
  return REPEATING_PATHS.has(path)
}

/** Integer/decimal primitives outside Quantity-like types. */
const NUMERIC_ELEMENTS = new Set([
  'valueInteger', 'valueDecimal', 'valueUnsignedInt', 'valuePositiveInt',
  'rank', 'sequence', 'frequency', 'frequencyMax', 'period', 'periodMax',
  'count', 'countMax', 'duration', 'durationMax', 'numberOfRepeatsAllowed',
  'multipleBirthInteger', 'offset', 'minutesDuration', 'priority', 'numberOfSeries',
  'doseSequence', 'seriesDoses', 'total', 'size',
])

/** Parent elements whose child `value` is a string (ContactPoint), not a
 *  Quantity decimal. Identifier-typed parents (`*identifier`) are also excluded. */
const STRING_VALUE_PARENTS = new Set(['telecom'])

/** Free-text elements left as strings even if they read "true" / "42". */
const TEXT_ELEMENTS = new Set(['display', 'text', 'comment', 'description', 'title', 'div', 'valueString', 'code', 'version'])

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/

function typedPrimitive(raw: string, name: string, parentName: string): unknown {
  if (TEXT_ELEMENTS.has(name)) return raw
  if (raw === 'true' || raw === 'false') return raw === 'true'
  const numeric = NUMERIC_ELEMENTS.has(name)
    || (name === 'value' && !STRING_VALUE_PARENTS.has(parentName) && !/identifier$/i.test(parentName))
  if (numeric && NUMBER_RE.test(raw)) return Number(raw)
  return raw
}

const isElementKey = (k: string) => !k.startsWith(ATTR) && k !== TEXT
const isResourceTypeName = (k: string) => /^[A-Z]/.test(k)

interface Ctx { resourceType: string; path: string; atResourceRoot: boolean }

function convertResource(resourceType: string, node: XmlNode): Record<string, unknown> {
  return {
    resourceType,
    ...convertChildren(node, { resourceType, path: resourceType, atResourceRoot: true }, resourceType),
  }
}

/** A Resource-typed element: `<resource><Patient>…</Patient></resource>`. */
function convertResourceWrapper(node: XmlNode): unknown {
  const typeKey = Object.keys(node).find(k => isElementKey(k) && isResourceTypeName(k))
  if (!typeKey) return undefined
  const inner = (node[typeKey] as XmlNode[])[0]
  return convertResource(typeKey, inner ?? {})
}

function convertDiv(node: XmlNode): string {
  const inner = typeof node[TEXT] === 'string' ? node[TEXT] : ''
  return `<div xmlns="${XHTML_NS}">${inner}</div>`
}

/** Converts one XML element occurrence to its JSON value and, for a primitive
 *  carrying `id`/extensions, the `_name` companion object. */
function convertElement(name: string, node: XmlNode, ctx: Ctx, parentName: string): { value: unknown; meta?: Record<string, unknown> } {
  if (name === 'div') return { value: convertDiv(node) }
  if ((name === 'resource' || name === 'contained' || name === 'outcome') && Object.keys(node).some(k => isElementKey(k) && isResourceTypeName(k))) {
    return { value: convertResourceWrapper(node) }
  }

  const hasValueAttr = typeof node[`${ATTR}value`] === 'string'
  const children = convertChildren(node, { ...ctx, atResourceRoot: false }, name)

  if (hasValueAttr) {
    const value = typedPrimitive(node[`${ATTR}value`] as string, name, parentName)
    const meta: Record<string, unknown> = {}
    if (typeof node[`${ATTR}id`] === 'string') meta.id = node[`${ATTR}id`]
    if (children.extension) meta.extension = children.extension
    return { value, meta: Object.keys(meta).length ? meta : undefined }
  }

  const obj: Record<string, unknown> = {}
  if (typeof node[`${ATTR}id`] === 'string') obj.id = node[`${ATTR}id`]
  if (typeof node[`${ATTR}url`] === 'string') obj.url = node[`${ATTR}url`]
  return { value: Object.assign(obj, children) }
}

function convertChildren(node: XmlNode, ctx: Ctx, nodeName: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, raw] of Object.entries(node)) {
    if (!isElementKey(name)) continue
    const occurrences = (Array.isArray(raw) ? raw : [raw]) as XmlNode[]
    const path = `${ctx.path}.${name}`
    const childCtx: Ctx = { resourceType: ctx.resourceType, path, atResourceRoot: false }
    const converted = occurrences.map(o => convertElement(name, (o && typeof o === 'object') ? o : {}, childCtx, nodeName))

    const asArray = occurrences.length > 1 || isRepeating(name, path, ctx.atResourceRoot, ctx.resourceType)
    const values = converted.map(c => c.value)
    out[name] = asArray ? values : values[0]

    if (converted.some(c => c.meta)) {
      const metas = converted.map(c => c.meta ?? null)
      out[`_${name}`] = asArray ? metas : metas[0]
    }
  }
  return out
}

/**
 * Parses FHIR STU3 XML into FHIR JSON. Returns the root resource (normally a
 * Bundle). Throws on malformed XML or a root that isn't a FHIR resource.
 */
export function fhirXmlToJson(text: string): Record<string, unknown> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR,
    textNodeName: TEXT,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: false,
    // Narrative XHTML is kept verbatim rather than parsed as FHIR elements.
    stopNodes: ['*.div'],
    isArray: (_name, _jpath, _isLeaf, isAttribute) => !isAttribute,
  })
  const raw = parser.parse(text) as XmlNode
  const rootKey = Object.keys(raw).find(k => isElementKey(k) && !k.startsWith('?'))
  if (!rootKey || !isResourceTypeName(rootKey)) {
    throw new Error('Root element is not a FHIR resource')
  }
  const root = (raw[rootKey] as XmlNode[])[0] ?? {}
  return convertResource(rootKey, root)
}
