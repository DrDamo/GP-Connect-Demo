import { describe, expect, it } from 'vitest'
import { parseBundle } from '../parser'
import { extractAllergies } from '../allergies'
import { extractCodedData } from '../codedData'
import { extractConsultations } from '../consultations'
import { extractDiaryEntries } from '../diaryEntries'
import { extractDocuments } from '../documents'
import { extractImmunisations } from '../immunisations'
import { extractInvestigations } from '../investigations'
import { extractLists } from '../lists'
import { extractMedications } from '../medications'
import { extractProblems } from '../problems'
import { extractReferrals } from '../referrals'
import { extractPatientInfo } from '../utils'
import text from '../../../public/gpc-sample-bundle.json?raw'

// Smoke test: every domain extractor runs over the shipped sample record.

describe('sample bundle', () => {
  const parsed = parseBundle(text)
  if (!parsed.ok) throw new Error(parsed.error)
  const b = parsed.data

  it('has a patient', () => {
    expect(extractPatientInfo(b)).toBeDefined()
  })

  it.each([
    ['allergies', extractAllergies], ['coded data', extractCodedData], ['consultations', extractConsultations],
    ['diary entries', extractDiaryEntries], ['documents', extractDocuments], ['immunisations', extractImmunisations],
    ['investigations', extractInvestigations], ['lists', extractLists], ['medications', extractMedications],
    ['problems', extractProblems], ['referrals', extractReferrals],
  ] as const)('extracts %s without throwing', (_name, extract) => {
    expect(Array.isArray(extract(b))).toBe(true)
  })

  it('finds the sample immunisations with their vaccine codes', () => {
    const imms = extractImmunisations(b).filter(i => !i.entryType)
    expect(imms.length).toBeGreaterThan(0)
    expect(imms.every(i => i.vaccineCodeSnomed)).toBe(true)
  })
})
