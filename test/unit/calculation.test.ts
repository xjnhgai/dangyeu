
import { describe, expect, it } from 'vitest'

import {
  calculateSetting,
  findExactDuplicates,
} from '../../src/core/calculation'

describe('calculateSetting', () => {
  it('calculates D and T correctly using 1-7 and GĐB', () => {
    const result = calculateSetting({
      listing: ['12', '23'],
      oneToSeven: ['0012', '1123'],
      gdb: '99123',
      point: 2,
      coefficientD: 3,
      coefficientT: 5,
    })

    expect(result.d).toBe(12)
    expect(result.t).toBe(30)
    expect(result.listingCount).toBe(2)
    expect(result.inputRecordCount).toBe(3)
    expect(result.matchingPairCount).toBe(3)
    expect(result.listingMatchFlags).toEqual([true, true])
  })

  it('compares the last two digits for LB', () => {
    const result = calculateSetting({
      listing: ['28', '29'],
      oneToSeven: ['55628', '12629', '28'],
      point: 1,
      coefficientD: 1,
      coefficientT: 1,
    })

    expect(result.matchingPairCount).toBe(3)
    expect(result.t).toBe(3)
    expect(result.listingMatchFlags).toEqual([true, true])
  })

  it('compares the first two digits across 1–7 and GĐB for LA', () => {
    const result = calculateSetting({
      listing: ['12', '98', '65'],
      oneToSeven: ['12345', '67890'],
      gdb: '98765',
      point: 2,
      coefficientD: 3,
      coefficientT: 5,
      formulaId: 'la',
    })
    expect(result.d).toBe(18)
    expect(result.matchingPairCount).toBe(2)
    expect(result.t).toBe(20)
    expect(result.listingMatchFlags).toEqual([true, true, false])
  })

  it('compares only the first two digits of GĐB for ĐA', () => {
    const result = calculateSetting({
      listing: ['12', '98', '65'],
      oneToSeven: ['12345'],
      gdb: '98765',
      point: 2,
      coefficientD: 3,
      coefficientT: 5,
      formulaId: 'da',
    })
    expect(result.matchingPairCount).toBe(1)
    expect(result.t).toBe(10)
    expect(result.listingMatchFlags).toEqual([false, true, false])
  })

  it('compares two- and three-digit ĐA listings with the corresponding GĐB prefix', () => {
    const twoDigit = calculateSetting({ listing: ['12', '34', '98'], oneToSeven: [], gdb: '12345', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'da' })
    expect(twoDigit.d).toBe(6)
    expect(twoDigit.matchingPairCount).toBe(1)
    expect(twoDigit.t).toBe(10)
    expect(twoDigit.listingMatchFlags).toEqual([true, false, false])
    const threeDigit = calculateSetting({ listing: ['123', '234', '999'], oneToSeven: [], gdb: '12345', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'da' })
    expect(threeDigit.d).toBe(6)
    expect(threeDigit.matchingPairCount).toBe(1)
    expect(threeDigit.t).toBe(10)
    expect(threeDigit.listingMatchFlags).toEqual([true, false, false])
  })

  it('compares two- and three-digit ĐB listings with the corresponding GĐB suffix', () => {
    const twoDigit = calculateSetting({ listing: ['45', '34', '98'], oneToSeven: [], gdb: '12345', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'db' })
    expect(twoDigit.d).toBe(6)
    expect(twoDigit.matchingPairCount).toBe(1)
    expect(twoDigit.t).toBe(10)
    const threeDigit = calculateSetting({ listing: ['345', '234', '999'], oneToSeven: [], gdb: '12345', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'db' })
    expect(threeDigit.d).toBe(6)
    expect(threeDigit.matchingPairCount).toBe(1)
    expect(threeDigit.t).toBe(10)
  })

  it('rejects mixed two- and three-digit values in a single ĐA/ĐB listing', () => {
    expect(() => calculateSetting({ listing: ['12', '345'], oneToSeven: [], gdb: '12345', point: 1, coefficientD: 1, coefficientT: 1, formulaId: 'da' })).toThrow(/không được trộn/)
  })

  it('compares only the last two digits of GĐB for ĐB', () => {
    const result = calculateSetting({
      listing: ['12', '98', '65'],
      oneToSeven: ['12345'],
      gdb: '98765',
      point: 2,
      coefficientD: 3,
      coefficientT: 5,
      formulaId: 'db',
    })
    expect(result.matchingPairCount).toBe(1)
    expect(result.t).toBe(10)
    expect(result.listingMatchFlags).toEqual([false, false, true])
  })

  it('counts duplicate listing and 1-7 entries independently', () => {
    const result = calculateSetting({
      listing: ['28', '28'],
      oneToSeven: ['55628', '55628'],
      point: 1,
      coefficientD: 1,
      coefficientT: 1,
    })

    expect(result.d).toBe(2)
    expect(result.matchingPairCount).toBe(4)
    expect(result.t).toBe(4)
    expect(result.listingMatchFlags).toEqual([true, true])
  })

  it('returns null for T when 1-7 and GĐB are both empty', () => {
    const result = calculateSetting({
      listing: ['12', '34'],
      oneToSeven: [],
      gdb: '',
      point: 3,
      coefficientD: 2,
      coefficientT: 5,
    })

    expect(result.d).toBe(12)
    expect(result.t).toBeNull()
    expect(result.inputRecordCount).toBe(0)
    expect(result.listingMatchFlags).toEqual([false, false])
  })

  it('returns zero for T when inputs exist but no pairs match', () => {
    const result = calculateSetting({
      listing: ['99'],
      oneToSeven: ['12345'],
      point: 2,
      coefficientD: 1,
      coefficientT: 5,
    })

    expect(result.inputRecordCount).toBe(1)
    expect(result.matchingPairCount).toBe(0)
    expect(result.t).toBe(0)
    expect(result.listingMatchFlags).toEqual([false])
  })

  it('ignores blank entries used as temporary input rows', () => {
    const result = calculateSetting({
      listing: ['', '28', ''],
      oneToSeven: ['', '55628'],
      gdb: '',
      point: 1,
      coefficientD: 2,
      coefficientT: 3,
    })

    expect(result.listingCount).toBe(1)
    expect(result.inputRecordCount).toBe(1)
    expect(result.matchingPairCount).toBe(1)
    expect(result.d).toBe(2)
    expect(result.t).toBe(3)

    // Vẫn giữ đúng vị trí của ba dòng đầu vào.
    expect(result.listingMatchFlags).toEqual([
      false,
      true,
      false,
    ])
  })

  it('rejects invalid listing numbers', () => {
    expect(() =>
      calculateSetting({
        listing: ['1'],
        oneToSeven: [],
        point: 1,
        coefficientD: 1,
        coefficientT: 1,
      }),
    ).toThrow()
  })

  it('rejects more than 26 entries in 1-7', () => {
    expect(() =>
      calculateSetting({
        listing: ['12'],
        oneToSeven: Array(27).fill('12'),
        point: 1,
        coefficientD: 1,
        coefficientT: 1,
      }),
    ).toThrow()
  })

  it('rejects GĐB unless it has exactly 5 digits', () => {
    expect(() =>
      calculateSetting({
        listing: ['12'],
        oneToSeven: [],
        gdb: '1234',
        point: 1,
        coefficientD: 1,
        coefficientT: 1,
      }),
    ).toThrow()
  })

  it('highlights a listing number matching only GĐB', () => {
    const result = calculateSetting({
      listing: ['23', '99'],
      oneToSeven: ['55628'],
      gdb: '99123',
      point: 1,
      coefficientD: 1,
      coefficientT: 1,
    })

    expect(result.listingMatchFlags).toEqual([true, false])
    expect(result.matchingPairCount).toBe(1)
  })

  it('highlights every matching listing entry independently', () => {
    const result = calculateSetting({
      listing: ['28', '28', '99'],
      oneToSeven: ['55628'],
      gdb: '',
      point: 1,
      coefficientD: 1,
      coefficientT: 1,
    })

    expect(result.listingMatchFlags).toEqual([
      true,
      true,
      false,
    ])
    expect(result.matchingPairCount).toBe(2)
  })
})

describe('additional formula calculations CA, CB, XA and XB', () => {
  it('CA compares only the 2nd and 3rd digits of GĐB', () => {
    const result = calculateSetting({ listing: ['23', '12'], oneToSeven: ['12345'], gdb: '12345', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'ca' })
    expect(result.d).toBe(12)
    expect(result.matchingPairCount).toBe(1)
    expect(result.t).toBe(10)
    expect(result.listingMatchFlags).toEqual([true, false])
  })

  it('CB compares only the 3rd and 4th digits of GĐB', () => {
    const result = calculateSetting({ listing: ['34', '12'], oneToSeven: ['12345'], gdb: '12345', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'cb' })
    expect(result.matchingPairCount).toBe(1)
    expect(result.t).toBe(10)
    expect(result.listingMatchFlags).toEqual([true, false])
  })

  it('XA pays one Trúng only when every listed number appears among first-two-digit draw values', () => {
    const result = calculateSetting({ listing: ['12', '98'], oneToSeven: ['12345'], gdb: '98765', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'xa' })
    expect(result.d).toBe(6)
    expect(result.matchingPairCount).toBe(1)
    expect(result.t).toBe(10)
    expect(result.listingMatchFlags).toEqual([true, true])

    const incomplete = calculateSetting({ listing: ['12', '98'], oneToSeven: ['12345'], gdb: '', point: 2, coefficientD: 3, coefficientT: 5, formulaId: 'xa' })
    expect(incomplete.matchingPairCount).toBe(0)
    expect(incomplete.t).toBe(0)
    expect(incomplete.listingMatchFlags).toEqual([true, false])
  })

  it('XB pays one Trúng only when every listed number appears among last-two-digit draw values', () => {
    const result = calculateSetting({ listing: ['45', '65', '90'], oneToSeven: ['12345', '9865'], gdb: '45690', point: 3, coefficientD: 2, coefficientT: 4, formulaId: 'xb' })
    expect(result.d).toBe(6)
    expect(result.matchingPairCount).toBe(1)
    expect(result.t).toBe(12)
    expect(result.listingMatchFlags).toEqual([true, true, true])
  })

  it('requires 2–4 numbers for XA/XB', () => {
    expect(() => calculateSetting({ listing: ['12'], oneToSeven: ['12345'], point: 1, coefficientD: 1, coefficientT: 1, formulaId: 'xa' })).toThrow(/2, 3 hoặc 4/)
    expect(() => calculateSetting({ listing: ['12', '23', '34', '45', '56', '67'], oneToSeven: ['12345'], point: 1, coefficientD: 1, coefficientT: 1, formulaId: 'xb' })).toThrow(/2, 3 hoặc 4/)
  })
})

describe('findExactDuplicates', () => {
  it('finds exact duplicates without comparing suffixes', () => {
    const result = findExactDuplicates([
      '55628',
      '12628',
      '55628',
      '00123',
      '123',
      '00123',
    ])

    expect(result).toEqual(['55628', '00123'])
  })

  it('does not treat blank entries as duplicates', () => {
    const result = findExactDuplicates(['', '12', ''])

    expect(result).toEqual([])
  })
})
