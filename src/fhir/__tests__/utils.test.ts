import { describe, expect, it } from 'vitest'
import { extractOriginalTermText, extractSnomedCode, extractId, fhirDateKey, formatDate } from '../utils'
import { SCT, sct } from './fixtures'

describe('fhirDateKey', () => {
  it('pads partial dates so they sort before fuller ones in the same period', () => {
    expect(fhirDateKey('1989')).toBe('1989-00-00')
    expect(fhirDateKey('1985-04')).toBe('1985-04-00')
    expect(fhirDateKey('2020-01-02T10:00:00+00:00')).toBe('2020-01-02')
    expect(fhirDateKey(undefined)).toBe('')
  })
})

describe('formatDate', () => {
  it('keeps the precision the record was given in', () => {
    expect(formatDate('1989')).toBe('1989')
    expect(formatDate('1985-04')).toBe('Apr 1985')
    expect(formatDate('2020-01-02')).toBe('02 Jan 2020')
    expect(formatDate(undefined)).toBeUndefined()
  })
})

describe('extractSnomedCode', () => {
  it('prefers the SNOMED coding over a Read code listed first (EMIS)', () => {
    expect(extractSnomedCode([{ system: 'http://read.info/readv2', code: 'H33..' }, sct('195967001')])).toBe('195967001')
  })
  it('falls back to the first coding', () => {
    expect(extractSnomedCode([{ system: 'urn:x', code: 'abc' }])).toBe('abc')
    expect(extractSnomedCode(undefined)).toBeUndefined()
  })
})

describe('extractOriginalTermText', () => {
  it('uses CodeableConcept.text first', () => {
    expect(extractOriginalTermText({ text: 'Asthma', coding: [sct('195967001', 'Asthma (disorder)')] })).toBe('Asthma')
  })
  it('uses the STU3 coding-sctdescid descriptionDisplay of the selected coding', () => {
    const coding: fhir3.Coding = {
      ...sct('195967001', 'Asthma (disorder)'),
      extension: [{
        url: 'https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-coding-sctdescid',
        extension: [{ url: 'descriptionId', valueId: '1' }, { url: 'descriptionDisplay', valueString: 'Asthma' }],
      } as fhir3.Extension],
    }
    expect(extractOriginalTermText({ coding: [coding] })).toBe('Asthma')
  })
  it('prefers the userSelected coding when several are present', () => {
    expect(extractOriginalTermText({ coding: [
      { system: SCT, code: '1', display: 'Not this' },
      { system: 'urn:x', code: '2', display: 'This one', userSelected: true },
    ] })).toBe('This one')
  })
})

describe('extractId', () => {
  it('takes the id from a relative or absolute reference', () => {
    expect(extractId('Practitioner/abc')).toBe('abc')
    expect(extractId(undefined)).toBeUndefined()
  })
})
