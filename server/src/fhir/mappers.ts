import type { FhirContains } from './types.js'

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
