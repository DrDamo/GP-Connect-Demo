import type { FhirContains, FhirParameters } from './types.js'
import { parseNormalFormAttributes } from './normalForm.js'

// ---------------------------------------------------------------------------
// Output types (the contracts exposed by the proxy routes)
// ---------------------------------------------------------------------------

export interface SnomedResult {
  code: string
  display_term: string
  fully_specified_name: string
  semantic_tag: string
}

export interface DmdResult {
  code: string
  display: string
  type: 'VMP' | 'AMP'
  system: 'https://dmd.nhs.uk'
}

// ---------------------------------------------------------------------------
// SNOMED CT — ECL expression builder
// ---------------------------------------------------------------------------

// Maps semantic tag keywords → SNOMED CT ECL hierarchy root
const ECL_FOR_TAG: Record<string, string> = {
  disorder:   '<< 404684003',
  finding:    '<< 404684003',
  procedure:  '<< 71388002',
  substance:  '<< 105590001',
  product:    '<< 373873005',
  observable: '<< 363787002',
  organism:   '<< 410607006',
  situation:  '<< 243796009',
  event:      '<< 272379006',
  body:       '<< 123037004',
}

// dm+d hierarchy roots within SNOMED CT UK edition
const DMD_ECL: Record<'vmp' | 'amp', string> = {
  vmp: '<< 10363601000001109',
  amp: '<< 10363901000001102',
}

export function snomedValueSetUrl(semanticTag?: string): string {
  const base = 'http://snomed.info/sct?fhir_vs'

  if (!semanticTag) {
    // No filter — search entire active SNOMED CT content
    return `${base}=isa/138875005`
  }

  const tags = semanticTag.split(',').map(t => t.trim().toLowerCase())
  const ecls = [...new Set(tags.flatMap(t => (ECL_FOR_TAG[t] ? [ECL_FOR_TAG[t]] : [])))]

  if (ecls.length === 0) return `${base}=isa/138875005`
  if (ecls.length === 1) return `${base}=ecl/${ecls[0]}`
  return `${base}=ecl/${ecls.join(' OR ')}`
}

export function dmdValueSetUrl(type: 'vmp' | 'amp'): string {
  return `http://snomed.info/sct?fhir_vs=ecl/${DMD_ECL[type]}`
}

// Combined VMP + AMP ValueSet — used to check whether a medication coding is
// a genuine dm+d product at all (see validateDmdCodesBatch), as opposed to
// dmdValueSetUrl above which scopes a search to one type at a time.
export function dmdMembershipValueSetUrl(): string {
  return `http://snomed.info/sct?fhir_vs=ecl/${DMD_ECL.vmp} OR ${DMD_ECL.amp}`
}

// ---------------------------------------------------------------------------
// FHIR contains → domain result mappers
// ---------------------------------------------------------------------------

const FSN_USE_CODE = '900000000000003001'

function findFsn(item: FhirContains): string | undefined {
  return item.designation?.find(d => d.use?.code === FSN_USE_CODE)?.value
}

function extractSemanticTag(fsn: string): string {
  const match = fsn.match(/\(([^)]+)\)$/)
  return match ? match[1] : ''
}

export function toSnomedResult(item: FhirContains): SnomedResult {
  const fsn = findFsn(item) ?? item.display
  const semanticTag = extractSemanticTag(fsn)

  // Preferred term: strip the "(semantic tag)" suffix if present in display
  const displayHasTag = item.display.endsWith(')') && semanticTag && item.display.endsWith(`(${semanticTag})`)
  const preferredTerm = displayHasTag
    ? item.display.slice(0, item.display.lastIndexOf(` (${semanticTag})`)).trim()
    : item.display

  return {
    code: item.code,
    display_term: preferredTerm,
    fully_specified_name: fsn,
    semantic_tag: semanticTag,
  }
}

export function toDmdResult(item: FhirContains, type: 'VMP' | 'AMP'): DmdResult {
  return {
    code: item.code,
    display: item.display,
    type,
    system: 'https://dmd.nhs.uk',
  }
}

// ---------------------------------------------------------------------------
// dm+d detail — strength/dose-form/route, parsed from CodeSystem/$lookup's
// `normalForm` property (see normalForm.ts for why this needs parsing rather
// than reading structured fields directly).
// ---------------------------------------------------------------------------

export interface ConceptRef {
  code: string
  display: string
}

export interface DmdDetail {
  code: string
  display: string
  type: 'VMP' | 'AMP'
  inactive?: boolean
  /** More than one active ingredient — strength is per-ingredient in SNOMED CT, so it's omitted rather than misattributed to the whole product */
  isCombinationProduct: boolean
  activeIngredient?: ConceptRef
  preciseActiveIngredient?: ConceptRef
  basisOfStrengthSubstance?: ConceptRef
  strength?: {
    numeratorValue?: number
    numeratorUnit?: ConceptRef
    denominatorValue?: number
    denominatorUnit?: ConceptRef
  }
  dispensedDoseForm?: ConceptRef
  basicDoseForm?: ConceptRef
  route?: ConceptRef
  ontologyFormAndRoute?: ConceptRef
  supplier?: ConceptRef
  controlledDrugCategory?: ConceptRef
  prescribingStatus?: ConceptRef
  nonAvailability?: ConceptRef
  parentCodes: string[]
  childCodes: string[]
  /** Set when this detail is for an AMP and some fields below were filled in
   * from its parent VMP-equivalent concept (see mergeParentVmpDetail) rather
   * than defined on the AMP itself. */
  parentVmp?: ConceptRef
  fromParentVmp?: string[]
}

// dm+d/SNOMED CT attribute concept IDs that carry a single numeric value.
// Numerator/denominator each have two possible source attributes depending on
// whether the concept expresses strength as a concentration (e.g. mg/ml
// liquids) or a discrete presentation amount (e.g. mg per tablet, micrograms
// per inhaler dose) — both map to the same logical field. IDs verified
// against live $lookup responses (see conversation for concentration vs
// presentation examples) — do not add IDs here without verifying against a
// real response, the display text alone is not a reliable guide (e.g.
// 732945000 below is named "...numerator value" in some contexts but is
// actually the unit attribute, confirmed live).
const NUMBER_ATTRIBUTES: Record<string, 'numeratorValue' | 'denominatorValue'> = {
  '1142138002': 'numeratorValue', // Has concentration strength numerator value
  '1142135004': 'numeratorValue', // Has presentation strength numerator value
  '1142137007': 'denominatorValue', // Has concentration strength denominator value
  '1142136003': 'denominatorValue', // Has presentation strength denominator value
}

type ConceptField =
  | 'activeIngredient' | 'preciseActiveIngredient' | 'basisOfStrengthSubstance'
  | 'dispensedDoseForm' | 'basicDoseForm' | 'route' | 'ontologyFormAndRoute'
  | 'supplier' | 'controlledDrugCategory' | 'prescribingStatus' | 'nonAvailability'

// "Has prescribing status" / "Has non-availability indicator" — also read
// standalone (not just via CONCEPT_ATTRIBUTES) by extractCodeStatus below, to
// detect a discontinued AMP without needing the full DmdDetail mapping.
const PRESCRIBING_STATUS_ATTRIBUTE_ID = '8940001000001105'
const NON_AVAILABILITY_ATTRIBUTE_ID = '8940601000001102'

// Attribute concept IDs that carry a concept-reference value, mapped to the
// DmdDetail field they populate. Strength units are handled separately below
// since they nest inside `strength` rather than sitting at the top level.
const CONCEPT_ATTRIBUTES: Record<string, ConceptField> = {
  '127489000': 'activeIngredient',
  '762949000': 'preciseActiveIngredient',
  '732943007': 'basisOfStrengthSubstance',
  '10362901000001105': 'dispensedDoseForm', // Has dispensed dose form
  '736476002': 'basicDoseForm',             // Has basic dose form
  '13088401000001104': 'route',             // Has NHS dm+d VMP route of administration
  '13088501000001100': 'ontologyFormAndRoute',
  '774159003': 'supplier',                  // Has supplier (AMP)
  '13089101000001102': 'controlledDrugCategory',
  [PRESCRIBING_STATUS_ATTRIBUTE_ID]: 'prescribingStatus',
  [NON_AVAILABILITY_ATTRIBUTE_ID]: 'nonAvailability',
}

const UNIT_ATTRIBUTES: Record<string, 'numeratorUnit' | 'denominatorUnit'> = {
  '733725009': 'numeratorUnit',   // Has concentration strength numerator unit
  '732945000': 'numeratorUnit',   // Has presentation strength numerator unit
  '733722007': 'denominatorUnit', // Has concentration strength denominator unit
  '732947008': 'denominatorUnit', // Has presentation strength denominator unit
}

// "Count of base of active ingredient" — a dedicated SNOMED CT attribute that
// gives the ingredient count directly. Prefer this over counting occurrences
// of an ingredient attribute: dosed/precise concepts (with strength attached)
// reference each ingredient via "Has precise active ingredient" (762949000)
// while undosed/abstract concepts use "Has active ingredient" (127489000) —
// counting either one alone under-detects the other's combination products.
const INGREDIENT_COUNT_ATTRIBUTE_ID = '1142139005'

// Attribute IDs that express strength — skipped entirely for combination
// products, since SNOMED CT models strength per-ingredient and there's no
// single value that correctly describes the whole product.
const STRENGTH_ATTRIBUTE_IDS = new Set([
  ...Object.keys(NUMBER_ATTRIBUTES),
  ...Object.keys(UNIT_ATTRIBUTES),
  '732943007', // Has basis of strength substance
])

function findParameter(parameters: FhirParameters, name: string) {
  return parameters.parameter?.find(p => p.name === name)
}

function findPropertyValues(parameters: FhirParameters, propertyCode: string): string[] {
  return (parameters.parameter ?? [])
    .filter(p => p.name === 'property' && p.part?.some(part => part.name === 'code' && part.valueCode === propertyCode))
    .flatMap(p => p.part?.find(part => part.name === 'value')?.valueCode ?? [])
}

function findNormalFormExpression(parameters: FhirParameters): string | undefined {
  return (parameters.parameter ?? [])
    .find(p => p.name === 'property' && p.part?.some(part => part.name === 'code' && part.valueCode === 'normalForm'))
    ?.part?.find(part => part.name === 'value')?.valueString
}

export function extractInactive(parameters: FhirParameters): boolean | undefined {
  const inactiveProp = (parameters.parameter ?? []).find(
    p => p.name === 'property' && p.part?.some(part => part.name === 'code' && part.valueCode === 'inactive'),
  )
  return inactiveProp?.part?.find(part => part.name === 'value')?.valueBoolean
}

export function toDmdDetail(parameters: FhirParameters, type: 'VMP' | 'AMP'): DmdDetail {
  const code = findParameter(parameters, 'code')?.valueCode ?? ''
  const display = findParameter(parameters, 'display')?.valueString ?? ''
  const inactive = extractInactive(parameters)

  const normalForm = findNormalFormExpression(parameters)
  const attrs = normalForm ? parseNormalFormAttributes(normalForm) : []
  const ingredientCount = attrs.find(a => a.attributeId === INGREDIENT_COUNT_ATTRIBUTE_ID)?.valueNumber
  const isCombinationProduct = (ingredientCount ?? 1) > 1

  const detail: DmdDetail = {
    code,
    display,
    type,
    inactive,
    isCombinationProduct,
    parentCodes: findPropertyValues(parameters, 'parent'),
    childCodes: findPropertyValues(parameters, 'child'),
  }

  for (const attr of attrs) {
    if (isCombinationProduct && STRENGTH_ATTRIBUTE_IDS.has(attr.attributeId)) continue

    if (attr.attributeId in NUMBER_ATTRIBUTES && attr.valueNumber !== undefined) {
      const field = NUMBER_ATTRIBUTES[attr.attributeId]
      detail.strength = { ...detail.strength, [field]: attr.valueNumber }
    } else if (attr.attributeId in UNIT_ATTRIBUTES && attr.valueCode) {
      const field = UNIT_ATTRIBUTES[attr.attributeId]
      detail.strength = { ...detail.strength, [field]: { code: attr.valueCode, display: attr.valueDisplay ?? '' } }
    } else if (attr.attributeId in CONCEPT_ATTRIBUTES && attr.valueCode) {
      const field = CONCEPT_ATTRIBUTES[attr.attributeId]
      if (!detail[field]) {
        detail[field] = { code: attr.valueCode, display: attr.valueDisplay ?? '' }
      }
    }
  }

  return detail
}

// ---------------------------------------------------------------------------
// AMP → parent VMP-equivalent fallback — AMPs never carry their own strength
// or ingredient attributes (see conversation: confirmed against multiple live
// examples), they're always defined on a parent concept instead. `parentCodes`
// mixes that useful parent in with generic dm+d category roots, so those roots
// need filtering out first.
// ---------------------------------------------------------------------------

const DMD_CATEGORY_ROOT_IDS = new Set([
  '10363901000001102', // Actual medicinal product
  '10363801000001108', // Virtual medicinal product
  '10363701000001104', // Virtual therapeutic moiety
])

export function pickParentVmpCode(detail: DmdDetail): string | undefined {
  return detail.parentCodes.find(code => !DMD_CATEGORY_ROOT_IDS.has(code))
}

// Fills gaps on an AMP's own detail using its parent VMP-equivalent's detail,
// recording which fields were filled in so the caller can flag them as
// inherited rather than the AMP's own data. Each field is copied explicitly
// (rather than looped over a key list) because the fields' value types differ
// (ConceptRef vs the strength object), which a generic keyed loop can't
// express in a way TypeScript can verify as sound.
export function mergeParentVmpDetail(detail: DmdDetail, parent: DmdDetail): DmdDetail {
  const fromParentVmp: string[] = []

  const copy = <K extends keyof DmdDetail>(field: K, value: DmdDetail[K]) => {
    if (detail[field] === undefined && value !== undefined) {
      detail[field] = value
      fromParentVmp.push(field as string)
    }
  }

  copy('activeIngredient', parent.activeIngredient)
  copy('preciseActiveIngredient', parent.preciseActiveIngredient)
  copy('basisOfStrengthSubstance', parent.basisOfStrengthSubstance)
  copy('strength', parent.strength)
  copy('route', parent.route)
  copy('ontologyFormAndRoute', parent.ontologyFormAndRoute)

  // AMPs never carry their own ingredient-count attributes, so a combination
  // flag computed from the AMP's own normalForm is always false regardless of
  // the actual product — the parent is the only reliable source for this.
  if (parent.isCombinationProduct && !detail.isCombinationProduct) {
    detail.isCombinationProduct = true
    fromParentVmp.push('isCombinationProduct')
  }

  if (fromParentVmp.length > 0) {
    detail.parentVmp = { code: parent.code, display: parent.display }
    detail.fromParentVmp = fromParentVmp
  }

  return detail
}

// ---------------------------------------------------------------------------
// SNOMED CT concept detail — generic CodeSystem/$lookup detail for any
// concept (disorder, finding, procedure, substance, etc.), not just dm+d.
// Unlike dm+d there's no fixed attribute set to target (a disorder's
// normalForm carries different attributes than a procedure's), so this
// exposes the parsed attributes generically rather than mapping named fields.
// ---------------------------------------------------------------------------

export interface SnomedDesignation {
  language?: string
  use?: string
  value: string
}

export interface SnomedAttribute {
  attributeName: string
  valueDisplay?: string
  valueCode?: string
  valueNumber?: number
}

export interface SnomedDetail {
  code: string
  display: string
  inactive?: boolean
  parentCodes: string[]
  childCodes: string[]
  designations: SnomedDesignation[]
  attributes: SnomedAttribute[]
}

export function toSnomedDetail(parameters: FhirParameters): SnomedDetail {
  const code = findParameter(parameters, 'code')?.valueCode ?? ''
  const display = findParameter(parameters, 'display')?.valueString ?? ''
  const inactive = extractInactive(parameters)

  const designations: SnomedDesignation[] = (parameters.parameter ?? [])
    .filter(p => p.name === 'designation')
    .map(p => {
      const useCoding = p.part?.find(part => part.name === 'use')?.valueCoding
      return {
        language: p.part?.find(part => part.name === 'language')?.valueCode,
        use: useCoding?.display ?? useCoding?.code,
        value: p.part?.find(part => part.name === 'value')?.valueString ?? '',
      }
    })
    .filter(d => d.value)

  const normalForm = findNormalFormExpression(parameters)
  const attributes: SnomedAttribute[] = normalForm
    ? parseNormalFormAttributes(normalForm).map(a => ({
        attributeName: a.attributeName,
        valueDisplay: a.valueDisplay,
        valueCode: a.valueCode,
        valueNumber: a.valueNumber,
      }))
    : []

  return {
    code,
    display,
    inactive,
    parentCodes: findPropertyValues(parameters, 'parent'),
    childCodes: findPropertyValues(parameters, 'child'),
    designations,
    attributes,
  }
}

// ---------------------------------------------------------------------------
// Bulk active/inactive + withdrawn status — a lightweight companion to the
// detail mappers above, used to tag every SNOMED CT/dm+d coding in a loaded
// bundle without pulling the full attribute set toSnomedDetail/toDmdDetail
// need. Inactive concepts are still valid, real concepts — this is purely a
// UI tag, and must never feed the transfer-degrade check (see
// src/fhir/snomedDegrade.ts on the client — that's existence-only, via
// $validate-code, and stays untouched by this).
// ---------------------------------------------------------------------------

export interface CodeStatus {
  inactive?: boolean
  /** dm+d/medication codes only: true when the concept's prescribing status
   * or non-availability indicator text says the product's been discontinued
   * (see isDiscontinuedStatusText) — surfaced in the UI as "Withdrawn"
   * rather than the generic "Inactive". */
  withdrawn?: boolean
}

function isDiscontinuedStatusText(text: string | undefined): boolean {
  return !!text && /discontinu/i.test(text)
}

// Extracts inactive/withdrawn from a CodeSystem/$lookup response. `checkWithdrawn`
// should only be set for dm+d/medication codes — the prescribing-status and
// non-availability attributes checked here are dm+d-specific and won't be
// present (or meaningful) on an arbitrary SNOMED CT concept.
export function extractCodeStatus(parameters: FhirParameters, checkWithdrawn: boolean): CodeStatus {
  const inactive = extractInactive(parameters)
  if (!checkWithdrawn || !inactive) return { inactive }

  const normalForm = findNormalFormExpression(parameters)
  const attrs = normalForm ? parseNormalFormAttributes(normalForm) : []
  const statusText = attrs.find(a => a.attributeId === PRESCRIBING_STATUS_ATTRIBUTE_ID)?.valueDisplay
    ?? attrs.find(a => a.attributeId === NON_AVAILABILITY_ATTRIBUTE_ID)?.valueDisplay

  return { inactive, withdrawn: isDiscontinuedStatusText(statusText) }
}
