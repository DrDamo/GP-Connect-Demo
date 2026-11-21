import { describe, expect, it } from 'vitest'
import { extractAllergies } from '../allergies'
import { bundle, sct } from './fixtures'

const allergy = (id: string, extra: Record<string, unknown> = {}) => ({
  resourceType: 'AllergyIntolerance', id, clinicalStatus: 'active', verificationStatus: 'confirmed',
  assertedDate: '2020-01-01', code: { coding: [sct('91936005', 'Allergy to penicillin')] }, ...extra,
})

describe('extractAllergies', () => {
  it('reads term, code, criticality and reaction', () => {
    const [a] = extractAllergies(bundle(allergy('a1', {
      criticality: 'high', category: ['medication'],
      reaction: [{ manifestation: [{ text: 'Rash' }] }],
    })))
    expect(a).toMatchObject({ id: 'a1', causativeAgent: 'Allergy to penicillin', snomedCode: '91936005', criticality: 'high', category: 'medication', reaction: 'Rash', status: 'active' })
    expect(a.isTransferDegraded).toBeUndefined()
  })

  it.each([
    ['196461000000101', 'drug allergy'],
    ['196471000000108', 'non-drug allergy'],
    ['196411000000103', 'generic record entry'],
  ])('flags allergies coded as transfer-degraded (%s, %s)', code => {
    const [a] = extractAllergies(bundle(allergy('a1', { code: { text: 'Peanut', coding: [sct(code)] } })))
    expect(a.isTransferDegraded).toBe(true)
    expect(a.causativeAgent).toBe('Peanut')
  })

  it('includes resolved allergies from the Ended allergies List, de-duplicated (TPP)', () => {
    const ended = allergy('a2', { clinicalStatus: 'resolved', assertedDate: '2019-01-01' })
    const list = {
      resourceType: 'List', id: 'l1', code: { coding: [sct('1103671000000101', 'Ended allergies')] },
      contained: [ended],
    }
    const result = extractAllergies(bundle(allergy('a1'), ended, list))
    expect(result.map(a => a.id)).toEqual(['a1', 'a2'])
  })

  it('sorts newest asserted date first', () => {
    const result = extractAllergies(bundle(allergy('old', { assertedDate: '2001' }), allergy('new', { assertedDate: '2022-05-01' })))
    expect(result.map(a => a.id)).toEqual(['new', 'old'])
  })
})
