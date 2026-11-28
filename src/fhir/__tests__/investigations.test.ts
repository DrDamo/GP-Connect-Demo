import { describe, it, expect } from 'vitest'
import { extractInvestigations } from '../investigations'

const placeholder = (id: string, valueString?: string) => ({
  resourceType: 'Observation', id, status: 'final',
  code: { coding: [{ system: 'http://snomed.info/sct', code: '24641000000107', display: 'Investigation result' }] },
  valueString,
})

function extract(...observations: Array<{ id: string }>) {
  return extractWithCode({}, ...observations)
}

function extractWithCode(code: fhir3.CodeableConcept, ...observations: Array<{ id: string }>) {
  return extractReport({ code }, ...observations)
}

function extractReport(report: object, ...observations: Array<{ id: string }>) {
  return extractInvestigations({
    resourceType: 'Bundle', type: 'collection',
    entry: [
      { resource: { resourceType: 'DiagnosticReport', id: 'r1', status: 'final', code: {}, ...report, result: observations.map(o => ({ reference: `Observation/${o.id}` })) } },
      ...observations.map(resource => ({ resource })),
    ],
  } as unknown as fhir3.Bundle)[0]
}

describe('Investigation result placeholder', () => {
  it('shows its text as a result comment, not as a result', () => {
    const report = extract(placeholder('o1', '\nCOELIAC\r'))
    expect(report.resultComments).toEqual([{ sourceRef: 'Observation/o1', text: 'COELIAC' }])
    expect(report.results).toEqual([])
  })

  it('adds no comment when it carries no text', () => {
    expect(extract(placeholder('o1', '\r\n')).resultComments).toBeUndefined()
  })
})

describe('Report conclusion', () => {
  it('shows it as a result comment', () => {
    expect(extractReport({ conclusion: 'Clinical Details:\r\nNOTE:Specimen date\r' }).resultComments)
      .toEqual([{ sourceRef: 'DiagnosticReport/r1', text: 'Clinical Details:\nNOTE:Specimen date' }])
  })
})

describe('Title in the conclusion', () => {
  it('names the report and leaves the rest as the comment', () => {
    const report = extractReport({ conclusion: 'Title: Glucose tolerance test\r\nMessage: repeat test' })
    expect(report.name).toBe('Glucose tolerance test')
    expect(report.resultComments?.map(c => c.text)).toEqual(['Message: repeat test'])
  })

  it('adds no comment when the title is all there is', () => {
    const report = extractReport({ conclusion: 'Title: Full blood count\n' })
    expect(report.name).toBe('Full blood count')
    expect(report.resultComments).toBeUndefined()
  })

  it('keeps the whole text when the title line is empty', () => {
    const report = extractReport({ conclusion: 'Title:\nMessage: repeat test' })
    expect(report.name).toBe('Investigation')
    expect(report.resultComments?.[0].text).toBe('Title:\nMessage: repeat test')
  })
})

describe('Specimen note', () => {
  it('is read when sent as a single object instead of a list', () => {
    const specimen = { resourceType: 'Specimen', id: 's1', note: { text: 'Amount Collected: 1750' } }
    const result = { resourceType: 'Observation', id: 'o1', status: 'final', code: { text: 'Urine protein' }, valueString: '1', specimen: { reference: 'Specimen/s1' } }
    const report = extractInvestigations({
      resourceType: 'Bundle', type: 'collection',
      entry: [
        { resource: { resourceType: 'DiagnosticReport', id: 'r1', status: 'final', code: {}, result: [{ reference: 'Observation/o1' }] } },
        { resource: result },
        { resource: specimen },
      ],
    } as unknown as fhir3.Bundle)[0]
    expect(report.specimens?.[0].note).toBe('Amount Collected: 1750')
  })
})

describe('Report specimens', () => {
  const specimen = (id: string) => ({ resourceType: 'Specimen', id })
  const extractWithSpecimens = (ids: string[], ...observations: Array<{ id: string }>) => extractInvestigations({
    resourceType: 'Bundle', type: 'collection',
    entry: [
      { resource: { resourceType: 'DiagnosticReport', id: 'r1', status: 'final', code: {}, specimen: ids.map(id => ({ reference: `Specimen/${id}` })), result: observations.map(o => ({ reference: `Observation/${o.id}` })) } },
      ...observations.map(resource => ({ resource })),
      ...ids.map(id => ({ resource: specimen(id) })),
    ],
  } as unknown as fhir3.Bundle)[0]
  const result = (id: string, specimenId?: string) => ({
    resourceType: 'Observation', id, status: 'final', code: { text: id }, valueString: '1',
    specimen: specimenId ? { reference: `Specimen/${specimenId}` } : undefined,
  })

  it('shows the specimen of a report with no results', () => {
    expect(extractWithSpecimens(['s1']).specimens?.map(s => s.id)).toEqual(['s1'])
  })

  it('shows every specimen no result points to', () => {
    expect(extractWithSpecimens(['s1', 's2'], result('o1')).specimens?.map(s => s.id)).toEqual(['s1', 's2'])
  })

  it('shows a shared specimen once', () => {
    const report = extractWithSpecimens(['s1'], result('o1', 's1'))
    expect(report.specimens?.map(s => s.id)).toEqual(['s1'])
    expect(report.testGroups[0].specimen).toBeUndefined()
  })
})

describe('Report title', () => {
  const generic = { coding: [{ system: 'http://snomed.info/sct', code: '721981007', display: 'Diagnostic studies report' }] }

  it("falls back to the report's own code when there is nothing more specific", () => {
    expect(extractWithCode(generic, placeholder('o1', 'COELIAC')).name).toBe('Diagnostic studies report')
  })

  it('prefers a result name over the generic code', () => {
    const result = { resourceType: 'Observation', id: 'o2', status: 'final', code: { text: 'Serum ferritin' }, valueString: '20' }
    expect(extractWithCode(generic, result).name).toBe('Serum ferritin')
  })

  it("says 'Investigation' only when the report has no code text", () => {
    expect(extract().name).toBe('Investigation')
  })
})
