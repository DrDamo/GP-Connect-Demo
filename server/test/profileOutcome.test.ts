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
  assert.equal(s.unchecked, 0)
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

test('summariseOutcome sets skipped terminology checks apart', () => {
  // Real validator 7.0.3 wording, from the sample record.
  const skipped = [
    'Could not confirm that the codes provided are from the required value set https://fhir.nhs.uk/STU3/ValueSet/CareConnect-CareSettingType-1 because there is no terminology service',
    'The value provided ([http://snomed.info/sct#721981007]) could not be validated in the absence of a terminology server',
    "Unable to validate code '78421000' in system 'http://snomed.info/sct' because the validator is running without terminology services",
    "Unable to validate code without using server because: Resolved system http://unitsofmeasure.org (v3.0.1), but the definition doesn't include any codes, so the code has not been validated",
    "A definition for CodeSystem 'https://fhir.nhs.uk/STU3/CodeSystem/GPConnect-ParticipantType-1' could not be found, so the code cannot be validated",
  ]
  const outcome = { issue: [
    ...skipped.map(text => ({ severity: 'warning', details: { text } })),
    { severity: 'information', details: { text: 'a real note' } },
    { severity: 'warning', details: { text: "None of the codings provided are in the value set 'X'" } },
  ] }
  const s = summariseOutcome(outcome, undefined, 6)
  assert.equal(s.unchecked, 5)
  assert.deepEqual(s.counts, { error: 0, warning: 1, information: 1 })
  // Findings come first; the cap of 6 cuts a skipped check, not a finding.
  assert.deepEqual(s.issues.map(i => !!i.unchecked), [false, false, true, true, true, true])
  assert.equal(s.truncated, true)
})
