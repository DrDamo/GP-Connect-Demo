import { describe, expect, it } from 'vitest'
import { extractCodedData } from '../codedData'
import { bundle, sct } from './fixtures'

describe('extractCodedData', () => {
  it('recovers the original term of a transfer-degraded Observation from its comment', () => {
    const [item] = extractCodedData(bundle({
      resourceType: 'Observation', id: 'o1', status: 'final', effectiveDateTime: '2020-01-01',
      code: { coding: [sct('196411000000103', 'Transfer-degraded record entry')] },
      comment: 'Original text: Smoking cessation advice\nOther note',
    }))
    expect(item.description).toBe('Smoking cessation advice')
    expect(item.isTransferDegraded).toBe(true)
  })

  it('leaves out Observations that belong to a DiagnosticReport, including has-member children', () => {
    const header = { resourceType: 'Observation', id: 'h', status: 'final', code: { text: 'FBC' }, related: [{ type: 'has-member', target: { reference: 'Observation/c' } }] }
    const child = { resourceType: 'Observation', id: 'c', status: 'final', code: { text: 'Hb' } }
    const other = { resourceType: 'Observation', id: 'bp', status: 'final', code: { text: 'Blood pressure' } }
    const report = { resourceType: 'DiagnosticReport', id: 'r', status: 'final', code: { text: 'Lab' }, result: [{ reference: 'Observation/h' }] }
    expect(extractCodedData(bundle(header, child, other, report)).map(i => i.id)).toEqual(['bp'])
  })
})
