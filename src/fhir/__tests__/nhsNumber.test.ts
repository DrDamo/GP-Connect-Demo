import { describe, expect, it } from 'vitest'
import { isTestRangeNhsNumber, isValidNhsNumber, nhsNumberCheckDigit } from '../nhsNumber'

describe('NHS Number', () => {
  it('accepts a valid Modulus 11 number, with or without spaces', () => {
    expect(isValidNhsNumber('9434765919')).toBe(true)
    expect(isValidNhsNumber('943 476 5919')).toBe(true)
  })
  it('rejects a wrong check digit, wrong length or non-digits', () => {
    expect(isValidNhsNumber('9434765918')).toBe(false)
    expect(isValidNhsNumber('943476591')).toBe(false)
    expect(isValidNhsNumber('94347659AB')).toBe(false)
    expect(isValidNhsNumber(undefined)).toBe(false)
  })
  it('treats a remainder of 10 as having no valid check digit', () => {
    // 1*10 + 1*2 = 12, 12 % 11 = 1, so 11 - 1 = 10
    expect(nhsNumberCheckDigit('100000001')).toBeNull()
  })
  it('recognises the 999 test range', () => {
    expect(isTestRangeNhsNumber('9990001234')).toBe(true)
    expect(isTestRangeNhsNumber('9434765919')).toBe(false)
  })
})
