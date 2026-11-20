import { describe, expect, it } from 'vitest'
import { normalizePastedJson, parseBundle } from '../parser'

describe('parseBundle', () => {
  it('parses a JSON Bundle and strips a UTF-8 BOM', () => {
    const r = parseBundle('﻿{"resourceType":"Bundle","type":"collection","entry":[]}')
    expect(r).toMatchObject({ ok: true, format: 'json', wrapped: false })
  })
  it('wraps a single resource into a Bundle', () => {
    const r = parseBundle('{"resourceType":"OperationOutcome","issue":[]}')
    expect(r.ok && r.wrapped).toBe(true)
    expect(r.ok && (r.data.entry?.[0].resource as { resourceType?: string } | undefined)?.resourceType).toBe('OperationOutcome')
  })
  it('unwraps a Bundle inside Parameters', () => {
    const r = parseBundle(JSON.stringify({ resourceType: 'Parameters', parameter: [{ resource: { resourceType: 'Bundle', type: 'collection', entry: [] } }] }))
    expect(r.ok && r.data.resourceType).toBe('Bundle')
  })
  it('reports bad JSON and unknown formats', () => {
    expect(parseBundle('{nope')).toMatchObject({ ok: false, format: 'json' })
    expect(parseBundle('hello')).toMatchObject({ ok: false, format: 'unknown' })
  })
  it('parses FHIR XML and refuses DOCTYPE declarations', () => {
    const xml = '<Bundle xmlns="http://hl7.org/fhir"><type value="collection"/></Bundle>'
    expect(parseBundle(xml)).toMatchObject({ ok: true, format: 'xml' })
    expect(parseBundle('<!DOCTYPE x><Bundle xmlns="http://hl7.org/fhir"/>')).toMatchObject({ ok: false, format: 'xml' })
  })
})

describe('normalizePastedJson', () => {
  it('wraps a bare array of resources', () => {
    const r = normalizePastedJson('[{"resourceType":"Patient","id":"p1"}]')
    expect(r.ok && r.data.entry?.length).toBe(1)
  })
})
