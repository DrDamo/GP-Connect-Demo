import type { FhirContains, FhirParameters } from './types'
import { parseNormalFormAttributes } from './normalForm'

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
  // Pre-coordinated allergy/intolerance/adverse-reaction concepts (e.g. "allergy to penicillin")
  allergy:    '<< 420134006',
}

const DMD_ECL: Record<'vmp' | 'amp', string> = {
  vmp: '<< 10363601000001109',
  amp: '<< 10363901000001102',
}

export function snomedValueSetUrl(semanticTag?: string): string {
  const base = 'http://snomed.info/sct?fhir_vs'
  if (!semanticTag) return `${base}=isa/138875005`
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
// a genuine dm+d product at all (see validateDmdCodesBatch in lookup.ts), as
// opposed to dmdValueSetUrl above which scopes a search to one type at a time.
export function dmdMembershipValueSetUrl(): string {
  return `http://snomed.info/sct?fhir_vs=ecl/${DMD_ECL.vmp} OR ${DMD_ECL.amp}`
}

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
  const displayHasTag = item.display.endsWith(')') && semanticTag && item.display.endsWith(`(${semanticTag})`)
  const preferredTerm = displayHasTag
    ? item.display.slice(0, item.display.lastIndexOf(` (${semanticTag})`)).trim()
    : item.display
  return { code: item.code, display_term: preferredTerm, fully_specified_name: fsn, semantic_tag: semanticTag }
}

export function toDmdResult(item: FhirContains, type: 'VMP' | 'AMP'): DmdResult {
  return { code: item.code, display: item.display, type, system: 'https://dmd.nhs.uk' }
}

// ---------------------------------------------------------------------------
// Bulk active/inactive + withdrawn status — a lightweight companion to the
// search/result mappers above, used to tag every SNOMED CT/dm+d coding in a
// loaded bundle. Inactive concepts are still valid, real concepts — this is
// purely a UI tag, and must never feed the transfer-degrade check (that's
// validateCodesBatch in lookup.ts — existence-only, via $validate-code).
// ---------------------------------------------------------------------------

// "Has prescribing status" / "Has non-availability indicator" — read directly
// (not via a general CONCEPT_ATTRIBUTES map, since this mapper only needs
// these two, unlike the full dm+d detail mapper on the Express server) to
// detect a discontinued AMP.
const PRESCRIBING_STATUS_ATTRIBUTE_ID = '8940001000001105'
const NON_AVAILABILITY_ATTRIBUTE_ID = '8940601000001102'

export interface CodeStatus {
  inactive?: boolean
  /** dm+d/medication codes only: true when the concept's prescribing status
   * or non-availability indicator text says the product's been discontinued
   * — surfaced in the UI as "Withdrawn" rather than the generic "Inactive". */
  withdrawn?: boolean
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
