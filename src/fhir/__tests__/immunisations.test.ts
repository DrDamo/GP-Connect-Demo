import { describe, expect, it } from 'vitest'
import { extractImmunisations } from '../immunisations'
import { bundle, sct } from './fixtures'

const imm = (extra: Record<string, unknown> = {}) => ({
  resourceType: 'Immunization', id: 'i1', status: 'completed', notGiven: false, date: '2021-03-04',
  vaccineCode: { text: 'DTaP/IPV', coding: [sct('8153411000001106', 'DTaP/IPV vaccine')] }, ...extra,
})

describe('extractImmunisations', () => {
  it('reads the vaccine code', () => {
    const [i] = extractImmunisations(bundle(imm()))
    expect(i).toMatchObject({ vaccineCodeDisplay: 'DTaP/IPV', vaccineCodeSnomed: '8153411000001106', vaccineCodeMissing: false })
  })

  it('marks vaccineCode missing when absent or only a NullFlavor', () => {
    const [absent] = extractImmunisations(bundle(imm({ vaccineCode: undefined })))
    expect(absent.vaccineCodeMissing).toBe(true)
    const [unk] = extractImmunisations(bundle(imm({ vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/v3/NullFlavor', code: 'UNK' }] } })))
    expect(unk.vaccineCodeMissing).toBe(true)
    expect(unk.vaccineCodeSnomed).toBeUndefined()
  })

  it('falls back to the VaccinationProcedure extension for the name and code', () => {
    const [i] = extractImmunisations(bundle(imm({
      vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/v3/NullFlavor', code: 'UNK' }] },
      extension: [{
        url: 'https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-VaccinationProcedure-1',
        valueCodeableConcept: { coding: [sct('1037201000000106', 'First DTaP/IPV vaccination')] },
      }],
    })))
    expect(i.vaccine).toBe('First DTaP/IPV vaccination')
    expect(i.snomedCode).toBe('1037201000000106')
  })

  it('collects target diseases across protocols, de-duplicated', () => {
    const [i] = extractImmunisations(bundle(imm({ vaccinationProtocol: [
      { targetDisease: [{ coding: [sct('397430003', 'Diphtheria')] }, { text: 'Tetanus' }] },
      { targetDisease: [{ coding: [sct('397430003', 'Diphtheria')] }] },
    ] })))
    expect(i.targetDiseases).toEqual([{ term: 'Diphtheria', snomedCode: '397430003' }, { term: 'Tetanus', snomedCode: undefined }])
  })

  it('returns no target diseases when vaccinationProtocol is absent (common for EMIS/TPP)', () => {
    expect(extractImmunisations(bundle(imm()))[0].targetDiseases).toEqual([])
  })

  it('includes Observations referenced by the Immunisations List', () => {
    const obs = { resourceType: 'Observation', id: 'o1', status: 'final', effectiveDateTime: '2022-01-01', code: { coding: [sct('171257003', 'No consent to immunisation')] } }
    const list = { resourceType: 'List', id: 'l1', code: { coding: [sct('1102181000000102')] }, entry: [{ item: { reference: 'Observation/o1' } }] }
    const result = extractImmunisations(bundle(imm(), obs, list))
    expect(result.map(r => [r.id, r.entryType])).toEqual([['o1', 'observation'], ['i1', undefined]])
  })
})

describe('extractImmunisations ordering', () => {
  it('sorts by the real date, newest first, not by the formatted text', () => {
    const result = extractImmunisations(bundle(
      imm({ id: 'a', date: '2019-12-31' }),
      imm({ id: 'b', date: '2021-01-01' }),
      imm({ id: 'c', date: '2020-06-15' }),
    ))
    expect(result.map(r => r.id)).toEqual(['b', 'c', 'a'])
  })
})
