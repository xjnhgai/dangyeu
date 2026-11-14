
import { describe, expect, it } from 'vitest'

import {
  addGroup1,
  addGroup2,
  addSetting,
  createCalculationData,
  createGroup1,
  createGroup2,
  createSetting,
  setGroup2Visibility,
  updateDrawData,
} from '../../src/core/tree'

import {
  calculateWorkspaceForA4,
  parseCoefficientText,
  parseListingText,
  parsePointText,
  WorkspaceCalculationError,
} from '../../src/core/workspace-calculator'

// ============================================================
// 1. TEST DATA
// ============================================================

function createWorkspaceData() {
  let data = createCalculationData()

  data = addGroup1(
    data,
    createGroup1('d1', '11/11/2026'),
  )

  data = addGroup2(
    data,
    'd1',
    createGroup2('g1', 'Obito'),
  )

  data = addGroup2(
    data,
    'd1',
    createGroup2('g2', 'Obita'),
  )

  data = addSetting(
    data,
    'd1',
    'g1',
    createSetting('s1', 'Thiết lập A'),
  )

  data = addSetting(
    data,
    'd1',
    'g1',
    createSetting('s2', 'Thiết lập B'),
  )

  data = addSetting(
    data,
    'd1',
    'g2',
    createSetting('s3', 'Thiết lập C'),
  )

  data = updateDrawData(data, 'd1', {
    oneToSeven: ['55628', '12635'],
    gdb: '99123',
  })

  data = {
    ...data,
    groups1: data.groups1.map((group1) => ({
      ...group1,
      groups2: group1.groups2.map((group2) => ({
        ...group2,
        settings: group2.settings.map((setting) => {
          switch (setting.id) {
            case 's1':
              return {
                ...setting,
                listing: '28, 35, 99',
                point: '2',
                coefficientD: '3',
                coefficientT: '5',
              }

            case 's2':
              return {
                ...setting,
                listing: '12, 23',
                point: '1',
                coefficientD: '2',
                coefficientT: '4',
              }

            case 's3':
              return {
                ...setting,
                listing: '28',
                point: '3',
                coefficientD: '1',
                coefficientT: '2',
              }

            default:
              return setting
          }
        }),
      })),
    })),
  }

  return data
}

// ============================================================
// 2. LISTING PARSER
// ============================================================

describe('parseListingText', () => {
  it('parses comma-separated numbers and trims whitespace', () => {
    expect(
      parseListingText(' 12, 23, 45 '),
    ).toEqual(['12', '23', '45'])
  })

  it('preserves leading zeros', () => {
    expect(
      parseListingText('0012, 00023'),
    ).toEqual(['0012', '00023'])
  })

  it('preserves duplicate entries', () => {
    expect(
      parseListingText('28, 28, 35'),
    ).toEqual(['28', '28', '35'])
  })

  it('returns an empty array for an empty listing', () => {
    expect(parseListingText('')).toEqual([])
    expect(parseListingText('   ')).toEqual([])
  })

  it('rejects empty entries between commas', () => {
    expect(() =>
      parseListingText('12,,23'),
    ).toThrowError(WorkspaceCalculationError)
  })

  it('rejects a trailing comma', () => {
    expect(() =>
      parseListingText('12,23,'),
    ).toThrowError(WorkspaceCalculationError)
  })

  it('rejects numbers outside the 2–5 digit range', () => {
    expect(() =>
      parseListingText('1, 123456'),
    ).toThrowError(WorkspaceCalculationError)
  })
})

// ============================================================
// 3. POINT PARSER
// ============================================================

describe('parsePointText', () => {
  it('accepts an integer with up to four digits', () => {
    expect(parsePointText('5')).toBe(5)
    expect(parsePointText('25')).toBe(25)
    expect(parsePointText('100')).toBe(100)
    expect(parsePointText('2500')).toBe(2500)
  })

  it('accepts zero', () => {
    expect(parsePointText('0')).toBe(0)
  })

  it('trims surrounding whitespace', () => {
    expect(parsePointText(' 25 ')).toBe(25)
  })

  it('rejects decimal points and decimal commas', () => {
    expect(() => parsePointText('1.5')).toThrow()
    expect(() => parsePointText('1,5')).toThrow()
  })

  it('rejects negative numbers and more than four digits', () => {
    expect(() => parsePointText('-5')).toThrow()
    expect(() => parsePointText('10000')).toThrow()
  })

  it('rejects an empty point', () => {
    expect(() => parsePointText('')).toThrow()
  })
})

// ============================================================
// 4. COEFFICIENT PARSER
// ============================================================

describe('parseCoefficientText', () => {
  it('accepts integer coefficients', () => {
    expect(parseCoefficientText('5', 'Hệ số D')).toBe(5)
  })

  it('accepts decimal coefficients using dot or comma', () => {
    expect(parseCoefficientText('1.5', 'Hệ số D')).toBe(1.5)
    expect(parseCoefficientText('1,5', 'Hệ số T')).toBe(1.5)
  })

  it('rejects empty and invalid coefficients', () => {
    expect(() => parseCoefficientText('', 'Hệ số D')).toThrow()
    expect(() => parseCoefficientText('abc', 'Hệ số T')).toThrow()
  })
})

// ============================================================
// 5. WORKSPACE CALCULATION
// ============================================================

describe('calculateWorkspaceForA4', () => {
  it('calculates all settings and totals at Level 1', () => {
    const data = createWorkspaceData()

    const result = calculateWorkspaceForA4(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(result.settingResults.size).toBe(3)

    expect(result.settingResults.get('s1')?.d).toBe(18)
    expect(result.settingResults.get('s1')?.t).toBe(20)

    expect(result.settingResults.get('s2')?.d).toBe(4)
    expect(result.settingResults.get('s2')?.t).toBe(4)

    expect(result.settingResults.get('s3')?.d).toBe(3)
    expect(result.settingResults.get('s3')?.t).toBe(6)

    expect(result.summary.totals).toEqual({
      settingCount: 3,
      d: 25,
      t: 30,
      difference: 5,
    })
  })

  it('produces correct red-highlight flags for every listing entry', () => {
    const data = createWorkspaceData()

    const result = calculateWorkspaceForA4(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(
      result.settingResults.get('s1')?.listingMatchFlags,
    ).toEqual([true, true, false])

    expect(
      result.settingResults.get('s2')?.listingMatchFlags,
    ).toEqual([false, true])
  })

  it('includes hidden Group 2 settings in Level 1 calculations', () => {
    let data = createWorkspaceData()

    data = setGroup2Visibility(data, 'd1', 'g1', false)

    const result = calculateWorkspaceForA4(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(result.settingResults.size).toBe(3)

    expect(result.summary.totals).toEqual({
      settingCount: 3,
      d: 25,
      t: 30,
      difference: 5,
    })

    expect(
      result.summary.sections[0].kind,
    ).toBe('group1-settings')
  })

  it('calculates only the selected Group 2', () => {
    const data = createWorkspaceData()

    const result = calculateWorkspaceForA4(data, {
      level: 2,
      group1Id: 'd1',
      group2Id: 'g1',
    })

    expect(result.settingResults.size).toBe(2)

    expect(result.settingResults.has('s1')).toBe(true)
    expect(result.settingResults.has('s2')).toBe(true)
    expect(result.settingResults.has('s3')).toBe(false)

    expect(result.summary.totals).toEqual({
      settingCount: 2,
      d: 22,
      t: 24,
      difference: 2,
    })
  })

  it('calculates only the selected setting at Level 3', () => {
    const data = createWorkspaceData()

    const result = calculateWorkspaceForA4(data, {
      level: 3,
      group1Id: 'd1',
      group2Id: 'g2',
      settingId: 's3',
    })

    expect(result.settingResults.size).toBe(1)

    expect(result.settingResults.has('s3')).toBe(true)
    expect(result.settingResults.has('s1')).toBe(false)

    expect(result.summary.totals).toEqual({
      settingCount: 1,
      d: 3,
      t: 6,
      difference: 3,
    })
  })

  it('returns null for T when 1-7 and GĐB are empty', () => {
    let data = createWorkspaceData()

    data = updateDrawData(data, 'd1', {
      oneToSeven: [],
      gdb: '',
    })

    const result = calculateWorkspaceForA4(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(result.settingResults.get('s1')?.t).toBeNull()

    expect(result.summary.totals.t).toBeNull()
    expect(result.summary.totals.difference).toBeNull()
  })

  it('reports the invalid setting ID when point is not an integer', () => {
    let data = createWorkspaceData()

    data = {
      ...data,
      groups1: data.groups1.map((group1) => ({
        ...group1,
        groups2: group1.groups2.map((group2) => ({
          ...group2,
          settings: group2.settings.map((setting) =>
            setting.id === 's1'
              ? { ...setting, point: '1.5' }
              : setting,
          ),
        })),
      })),
    }

    expect(() =>
      calculateWorkspaceForA4(data, {
        level: 3,
        group1Id: 'd1',
        group2Id: 'g1',
        settingId: 's1',
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_POINT',
        settingId: 's1',
      }),
    )
  })

  it('rejects a missing Group 1', () => {
    const data = createWorkspaceData()

    expect(() =>
      calculateWorkspaceForA4(data, {
        level: 1,
        group1Id: 'unknown',
      }),
    ).toThrowError(WorkspaceCalculationError)
  })
})
