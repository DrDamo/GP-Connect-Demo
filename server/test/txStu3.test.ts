import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toStu3CapabilityStatement, toStu3TerminologyParameters, adaptParameters, UK_SNOMED_EDITION } from '../src/fhir/txStu3.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures are checked field by field
type Any = any

test('toStu3CapabilityStatement turns canonical strings into References', () => {
  const out = toStu3CapabilityStatement({
    resourceType: 'CapabilityStatement', fhirVersion: '4.0.1', instantiates: ['x'],
    rest: [{ operation: [{ name: 'expand', definition: 'http://x/OperationDefinition/expand' }],
      resource: [{ type: 'ValueSet', profile: 'http://x/SD/ValueSet', supportedProfile: ['y'], operation: [{ name: 'v', definition: 'http://x/OD/v' }] }] }],
  })
  assert.equal(out.fhirVersion, '3.0.1')
  assert.equal(out.instantiates, undefined)
  const rest = (out.rest as Any[])[0]
  assert.deepEqual(rest.operation[0].definition, { reference: 'http://x/OperationDefinition/expand' })
  assert.deepEqual(rest.resource[0].profile, { reference: 'http://x/SD/ValueSet' })
  assert.equal(rest.resource[0].supportedProfile, undefined)
  assert.deepEqual(rest.resource[0].operation[0].definition, { reference: 'http://x/OD/v' })
})

test('toStu3TerminologyParameters lists systems with a version-less entry first', () => {
  const out = toStu3TerminologyParameters({
    resourceType: 'TerminologyCapabilities', url: 'u', version: '6', date: '2026-01-01',
    codeSystem: [{ uri: 'http://snomed.info/sct', version: [{ code: 'http://snomed.info/sct/83821000000107/version/20261021' }] }, { uri: 'http://loinc.org' }],
  })
  assert.equal(out.resourceType, 'Parameters')
  assert.deepEqual((out.parameter as Any[]).slice(3), [
    { name: 'system', valueUri: 'http://snomed.info/sct' }, { name: 'version' },
    { name: 'version', valueCode: 'http://snomed.info/sct/83821000000107/version/20261021' },
    { name: 'system', valueUri: 'http://loinc.org' }, { name: 'version' },
  ])
})

test('adaptParameters pins SNOMED to the UK edition', () => {
  const out = adaptParameters({ resourceType: 'Parameters', parameter: [
    { name: 'code', valueCode: '1' },
    { name: 'system-version', valueUri: 'http://snomed.info/sct|http://snomed.info/sct/900000000000207008' },
    { name: 'system-version', valueUri: 'http://loinc.org|2.77' },
  ] })
  assert.deepEqual(out.parameter, [
    { name: 'code', valueCode: '1' },
    { name: 'system-version', valueUri: 'http://loinc.org|2.77' },
    { name: 'force-system-version', valueCanonical: `http://snomed.info/sct|${UK_SNOMED_EDITION}` },
  ])
  assert.deepEqual(adaptParameters({ resourceType: 'ValueSet' }), { resourceType: 'ValueSet' })
})

test('adaptParameters wraps a single identifier on an embedded resource', () => {
  const out = adaptParameters({ resourceType: 'Parameters', parameter: [
    { name: 'valueSet', resource: { resourceType: 'ValueSet', identifier: { system: 'urn:ietf:rfc:3986', value: 'x' } } },
    { name: 'tx-resource', part: [{ name: 'r', resource: { resourceType: 'ValueSet', contained: [{ resourceType: 'CodeSystem', identifier: { value: 'y' } }] } }] },
  ] })
  const p = out.parameter as Any[]
  assert.deepEqual(p[0].resource.identifier, [{ system: 'urn:ietf:rfc:3986', value: 'x' }])
  assert.deepEqual(p[1].part[0].resource.contained[0].identifier, [{ value: 'y' }])
})
