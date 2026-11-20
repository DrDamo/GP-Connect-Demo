import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summariseOutcome } from '../src/fhir/profileOutcome.js'

const LINE = 'http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-line'

test('summariseOutcome counts, orders by severity and resolves the entry', () => {
  const bundle = { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient', id: 'p1' } }, { resource: { resourceType: 'Observation' } }] }
  const outcome = { resourceType: 'OperationOutcome', issue: [
    { severity: 'information', details: { text: 'note' } },
    { severity: 'warning', diagnostics: 'warn', expression: ['Bundle.entry[1].resource.code'] },
    { severity: 'fatal', code: 'structure', details: { text: 'bad' }, expression: ['Bundle.entry[0].resource'], extension: [{ url: LINE, valueInteger: 12 }] },
  ] }
  const s = summariseOutcome(outcome, bundle, 10)
  assert.deepEqual(s.counts, { error: 1, warning: 1, information: 1 })
  assert.deepEqual(s.issues.map(i => i.severity), ['error', 'warning', 'information'])
  assert.deepEqual(s.issues[0], { severity: 'error', code: 'structure', text: 'bad', expression: 'Bundle.entry[0].resource', line: 12, resource: 'Patient/p1' })
  assert.equal(s.issues[1].resource, 'Observation')
  assert.equal(s.issues[1].text, 'warn')
  assert.equal(s.truncated, false)
})

test('summariseOutcome caps the issues but not the counts', () => {
  const outcome = { issue: Array.from({ length: 5 }, () => ({ severity: 'error', details: { text: 'x' } })) }
  const s = summariseOutcome(outcome, undefined, 2)
  assert.equal(s.issues.length, 2)
  assert.equal(s.counts.error, 5)
  assert.equal(s.truncated, true)
})
