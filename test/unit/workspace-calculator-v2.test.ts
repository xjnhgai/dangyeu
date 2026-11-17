import { describe, expect, it } from 'vitest'
import type { CalculationDataV2, Group1, Group3 } from '../../src/core/models-v2'
import { addGroup1V2, addGroup2V2, addGroup3V2, createCalculationDataV2 } from '../../src/core/tree-v2'
import {
  calculateWorkspaceForA4V2,
  parseCoefficientTextV2,
  parseListingTextV2,
  parseOneToSevenTextV2,
  parseSettingNumberListV2,
  parsePointTextV2,
  WorkspaceCalculationV2Error,
} from '../../src/core/workspace-calculator-v2'

function item(id: string, overrides: Partial<Group3> = {}): Group3 {
  return { kind: 'group3', id, settingTypeId: 'setting-type-1', listing: '12', point: '2', coefficientD: '3', coefficientT: '5', ...overrides }
}

function dataWithTwoGroups(drawData: Group1['drawData'] = { oneToSeven: ['0012', '1123'], gdb: '99123' }): CalculationDataV2 {
  let data = createCalculationDataV2()
  data = addGroup1V2(data, { kind: 'group1', id: 'date-1', dateLabel: '12/11', drawData, groups2: [] })
  data = addGroup2V2(data, 'date-1', { kind: 'group2', id: 'g-obito', name: 'Obito', groups3: [] })
  data = addGroup2V2(data, 'date-1', { kind: 'group2', id: 'g-obita', name: 'Obita', groups3: [] })
  data = addGroup3V2(data, 'date-1', 'g-obito', item('a', { listing: '12, 23' }))
  data = addGroup3V2(data, 'date-1', 'g-obita', item('b', { listing: '28', point: '3', coefficientD: '1', coefficientT: '2' }))
  data.settingTypes[0].defaultCoefficientD = '3'
  data.settingTypes[0].defaultCoefficientT = '5'
  return data
}

describe('V2 parsing', () => {
  it('parses comma and whitespace separators while preserving leading zeroes and duplicates', () => {
    expect(parseListingTextV2('0012,  12,   0012')).toEqual(['0012', '12', '0012'])
    expect(parseListingTextV2('00 11    22    33,44,  55')).toEqual(['00', '11', '22', '33', '44', '55'])
    expect(parseListingTextV2('')).toEqual([])
  })
  it('requires two digits for ordinary setting lists and allows homogeneous two/three digit ĐA/ĐB lists', () => {
    expect(parseSettingNumberListV2('00,  09,   99')).toEqual(['00', '09', '99'])
    expect(parseSettingNumberListV2('00 11    22    33,44,  55')).toEqual(['00', '11', '22', '33', '44', '55'])
    expect(() => parseSettingNumberListV2('9, 123')).toThrow(WorkspaceCalculationV2Error)
    expect(parseSettingNumberListV2('123, 456', 'da')).toEqual(['123', '456'])
    expect(() => parseSettingNumberListV2('12, 345', 'db')).toThrow(/không được trộn/)
    expect(parseListingTextV2('00128, 23')).toEqual(['00128', '23'])
  })
  it('requires exactly 26 values for a partially entered 1–7 draw', () => {
    expect(parseOneToSevenTextV2('')).toEqual([])
    const completeValues = Array.from({ length: 26 }, (_, index) => String(index).padStart(2, '0'))
    const completeList = completeValues.map((value, index) => index % 3 === 0 ? ` ${value}  ` : index % 3 === 1 ? `, ${value}, ` : value).join('')
    expect(parseOneToSevenTextV2(completeList)).toHaveLength(26)
    const shortList = Array.from({ length: 25 }, (_, index) => String(index).padStart(2, '0')).join(', ')
    expect(() => parseOneToSevenTextV2(shortList)).toThrow(/đúng 26 số/i)
    const longList = Array.from({ length: 27 }, (_, index) => String(index % 100).padStart(2, '0')).join(', ')
    expect(() => parseOneToSevenTextV2(longList)).toThrow(/đúng 26 số/i)
  })
  it('rejects malformed listing values', () => {
    expect(parseListingTextV2('12,,23')).toEqual(['12', '23'])
    expect(() => parseListingTextV2('1, 123456')).toThrow(WorkspaceCalculationV2Error)
  })
  it('parses point and rejects decimal or out-of-range values', () => {
    expect(parsePointTextV2('9999')).toBe(9999)
    expect(() => parsePointTextV2('1.5')).toThrow(WorkspaceCalculationV2Error)
    expect(() => parsePointTextV2('10000')).toThrow(WorkspaceCalculationV2Error)
  })
  it('parses decimal comma and decimal point coefficients', () => {
    expect(parseCoefficientTextV2('1,5', 'D')).toBe(1.5)
    expect(parseCoefficientTextV2('2.5', 'T')).toBe(2.5)
    expect(() => parseCoefficientTextV2('-1', 'D')).toThrow(WorkspaceCalculationV2Error)
  })
})

describe('V2 workspace calculation', () => {
  it('calculates every Group3 across all Group2 in combined mode', () => {
    const result = calculateWorkspaceForA4V2(dataWithTwoGroups(), { mode: 'combined', group1Id: 'date-1' })
    expect(result.settingResults.size).toBe(2)
    expect(result.settingResults.get('a')?.d).toBe(12)
    expect(result.settingResults.get('a')?.t).toBe(30)
    expect(result.settingResults.get('a')?.matchingPairCount).toBe(3)
    expect(result.settingResults.get('b')?.d).toBe(9)
    expect(result.settingResults.get('b')?.t).toBe(0)
  })

  it('calculates only entries for an individually selected Group2', () => {
    const result = calculateWorkspaceForA4V2(dataWithTwoGroups(), { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obita' })
    expect([...result.settingResults.keys()]).toEqual(['b'])
    expect(result.summary.totals).toEqual({ settingCount: 1, d: 9, t: 0, difference: -9 })
  })

  it('routes LB, LA, ĐA and ĐB through their own comparison scopes', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['12345', '67890'], gdb: '98765' })
    data = addGroup3V2(data, 'date-1', 'g-obito', item('la', { settingTypeId: 'setting-type-2', listing: '12, 98, 65' }))
    data = addGroup3V2(data, 'date-1', 'g-obito', item('da', { settingTypeId: 'setting-type-3', listing: '12, 98, 65' }))
    data = addGroup3V2(data, 'date-1', 'g-obito', item('db', { settingTypeId: 'setting-type-4', listing: '12, 98, 65' }))

    data.settingTypes[1].defaultCoefficientT = '5'
    for (const type of data.settingTypes.filter(t => t.formulaId === 'da' || t.formulaId === 'db')) type.defaultCoefficientsByCount = { '2': {coefficientD:'3',coefficientT:'5'} }
    const result = calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect(result.settingResults.get('la')?.matchingPairCount).toBe(2)
    expect(result.settingResults.get('la')?.t).toBe(20)
    expect(result.settingResults.get('da')?.matchingPairCount).toBe(1)
    expect(result.settingResults.get('da')?.t).toBe(10)
    expect(result.settingResults.get('db')?.matchingPairCount).toBe(1)
    expect(result.settingResults.get('db')?.t).toBe(10)
  })

  it('calculates ĐA/ĐB with coefficient profiles selected by two/three-digit width', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['12000', '98000'], gdb: '12345' })
    const daType = data.settingTypes.find((type) => type.formulaId === 'da')!
    const dbType = data.settingTypes.find((type) => type.formulaId === 'db')!
    data = addGroup3V2(data, 'date-1', 'g-obito', item('da-2', { settingTypeId: daType.id, listing: '12 34 99', point: '10', coefficientsByCount: { '2': { coefficientD: '2', coefficientT: '3' } } }))
    data = addGroup3V2(data, 'date-1', 'g-obito', item('da-3', { settingTypeId: daType.id, listing: '123 234 999', point: '10', coefficientsByCount: { '3': { coefficientD: '4', coefficientT: '5' } } }))
    data = addGroup3V2(data, 'date-1', 'g-obito', item('db-2', { settingTypeId: dbType.id, listing: '45 34 99', point: '10', coefficientsByCount: { '2': { coefficientD: '6', coefficientT: '7' } } }))
    data = addGroup3V2(data, 'date-1', 'g-obito', item('db-3', { settingTypeId: dbType.id, listing: '345 234 999', point: '10', coefficientsByCount: { '3': { coefficientD: '8', coefficientT: '9' } } }))
    daType.defaultCoefficientsByCount = {'2':{coefficientD:'2',coefficientT:'3'},'3':{coefficientD:'4',coefficientT:'5'}}
    dbType.defaultCoefficientsByCount = {'2':{coefficientD:'6',coefficientT:'7'},'3':{coefficientD:'8',coefficientT:'9'}}
    const result = calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect(result.settingResults.get('da-2')?.d).toBe(20)
    expect(result.settingResults.get('da-2')?.t).toBe(30)
    expect(result.settingResults.get('da-3')?.d).toBe(40)
    expect(result.settingResults.get('da-3')?.t).toBe(50)
    expect(result.settingResults.get('db-2')?.t).toBe(70)
    expect(result.settingResults.get('db-3')?.t).toBe(90)
  })

  it('uses legacy catalog scalars for DA/DB when profile coefficients are absent', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['12345'], gdb: '12345' })
    const daType = data.settingTypes.find((type) => type.formulaId === 'da')!
    const dbType = data.settingTypes.find((type) => type.formulaId === 'db')!
    data = addGroup3V2(data, 'date-1', 'g-obito', item('da-legacy', {
      settingTypeId: daType.id, listing: '12 23', point: '2', coefficientD: '3', coefficientT: '4',
    }))
    data = addGroup3V2(data, 'date-1', 'g-obito', item('db-legacy', {
      settingTypeId: dbType.id, listing: '45 34', point: '2', coefficientD: '5', coefficientT: '6',
    }))
    daType.defaultCoefficientsByCount = undefined; daType.defaultCoefficientD='3'; daType.defaultCoefficientT='4'
    dbType.defaultCoefficientsByCount = undefined; dbType.defaultCoefficientD='5'; dbType.defaultCoefficientT='6'
    const result = calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect(result.settingResults.get('da-legacy')?.d).toBe(6)
    expect(result.settingResults.get('da-legacy')?.t).toBe(8)
    expect(result.settingResults.get('db-legacy')?.d).toBe(10)
    expect(result.settingResults.get('db-legacy')?.t).toBe(12)
  })

  it('calculates DA/DB D while GDB and profile T coefficients are unavailable', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['12000'], gdb: '' })
    const daType = data.settingTypes.find((type) => type.formulaId === 'da')!
    data = addGroup3V2(data, 'date-1', 'g-obito', item('da-no-gdb', {
      settingTypeId: daType.id,
      listing: '12 23',
      point: '2',
      coefficientD: '3',
      coefficientT: '',
      coefficientsByCount: { '2': { coefficientD: '3', coefficientT: '' } },
    }))
    daType.defaultCoefficientsByCount = {'2':{coefficientD:'3',coefficientT:''}}
    const result = calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect(result.settingResults.get('da-no-gdb')?.d).toBe(6)
    expect(result.settingResults.get('da-no-gdb')?.t).toBeNull()
  })

  it('calculates XA/XB using per-list-length coefficient pairs', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['12000', '98000'], gdb: '34567' })
    const xaType = data.settingTypes.find((type) => type.formulaId === 'xa')!
    const xbType = data.settingTypes.find((type) => type.formulaId === 'xb')!
    data = addGroup3V2(data, 'date-1', 'g-obito', item('xa-2', {
      settingTypeId: xaType.id, listing: '12, 98', point: '10',
      coefficientsByCount: { '2': { coefficientD: '2', coefficientT: '3' } },
    }))
    data = addGroup3V2(data, 'date-1', 'g-obito', item('xb-3', {
      settingTypeId: xbType.id, listing: '00, 00, 67', point: '5',
      coefficientsByCount: { '3': { coefficientD: '4', coefficientT: '6' } },
    }))
    xaType.defaultCoefficientsByCount = {'2':{coefficientD:'2',coefficientT:'3'}}
    xbType.defaultCoefficientsByCount = {'3':{coefficientD:'4',coefficientT:'6'}}
    const result = calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect(result.settingResults.get('xa-2')?.d).toBe(20)
    expect(result.settingResults.get('xa-2')?.t).toBe(30)
    expect(result.settingResults.get('xb-3')?.d).toBe(20)
    expect(result.settingResults.get('xb-3')?.t).toBe(30)
  })

  it('selects XA/XB coefficient pairs independently for listings of 2, 3 and 4 numbers', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['12000', '98000', '34000', '45000', '56000'], gdb: '78999' })
    const xaType = data.settingTypes.find((type) => type.formulaId === 'xa')!
    const coefficientPairs = {
      '2': { coefficientD: '2', coefficientT: '3' },
      '3': { coefficientD: '4', coefficientT: '5' },
      '4': { coefficientD: '6', coefficientT: '7' },
      '5': { coefficientD: '8', coefficientT: '9' },
    }
    const sourceNumbers = ['12', '98', '34', '45', '56']
    for (const count of [2, 3, 4] as const) {
      data = addGroup3V2(data, 'date-1', 'g-obito', item(`xa-${count}`, {
        settingTypeId: xaType.id,
        listing: sourceNumbers.slice(0, count).join(' '),
        point: '10',
        coefficientsByCount: { [String(count)]: coefficientPairs[String(count) as keyof typeof coefficientPairs] },
      }))
    }
    xaType.defaultCoefficientsByCount = coefficientPairs
    const result = calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect([2, 3, 4].map((count) => result.settingResults.get(`xa-${count}`)?.d)).toEqual([20, 40, 60])
    expect([2, 3, 4].map((count) => result.settingResults.get(`xa-${count}`)?.t)).toEqual([30, 50, 70])
  })

  it('rejects an XA/XB row when the coefficient pair for its detected length is missing', () => {
    for (const formulaId of ['xa', 'xb'] as const) {
      let data = dataWithTwoGroups()
      const type = data.settingTypes.find((entry) => entry.formulaId === formulaId)!
      type.defaultCoefficientsByCount = {} // Explicit malformed/missing profile, rather than the new default-one catalog.
      data = addGroup3V2(data, 'date-1', 'g-obito', item(`${formulaId}-4`, {
        settingTypeId: type.id,
        listing: '11 22 33 44',
        // The scalar coefficients inherited from item() must not mask the
        // missing profile for a four-number XA/XB list.
        coefficientsByCount: { '2': { coefficientD: '1', coefficientT: '1' } },
      }))
      expect(() => calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })).toThrow(/4 số/)
    }
  })

  it('requires an XA/XB T profile even before GDB arrives because 1–7 can already match', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['12000'], gdb: '' })
    const xaType = data.settingTypes.find((type) => type.formulaId === 'xa')!
    data = addGroup3V2(data, 'date-1', 'g-obito', item('xa-no-t-profile', {
      settingTypeId: xaType.id,
      listing: '12 23',
      coefficientsByCount: { '2': { coefficientD: '2', coefficientT: '' } },
    }))
    xaType.defaultCoefficientsByCount = {'2':{coefficientD:'2',coefficientT:''}}
    expect(() => calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })).toThrow(/hệ số Trúng/i)
  })

  it('returns null T when there are no draw results', () => {
    const result = calculateWorkspaceForA4V2(dataWithTwoGroups({ oneToSeven: [], gdb: '' }), { mode: 'combined', group1Id: 'date-1' })
    expect(result.summary.totals.t).toBeNull()
    expect(result.summary.totals.difference).toBeNull()
  })

  it('uses comma decimal coefficients', () => {
    let data = dataWithTwoGroups({ oneToSeven: ['0012'], gdb: '' })
    data = addGroup3V2(data, 'date-1', 'g-obito', item('comma', { listing: '12', point: '2', coefficientD: '1,5', coefficientT: '2,5' }))
    data.settingTypes[0].defaultCoefficientD='1,5';data.settingTypes[0].defaultCoefficientT='2,5'
    const result = calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect(result.settingResults.get('comma')?.d).toBe(3)
    expect(result.settingResults.get('comma')?.t).toBe(5)
  })

  it('includes exact match flags for A4 number highlighting', () => {
    const result = calculateWorkspaceForA4V2(dataWithTwoGroups(), { mode: 'group2', group1Id: 'date-1', group2Id: 'g-obito' })
    expect(result.settingResults.get('a')?.listingMatchFlags).toEqual([true, true])
  })

  it('reports malformed listing with the responsible Group3 ID', () => {
    const original = dataWithTwoGroups()
    const corrupted: CalculationDataV2 = {
      ...original,
      groups1: original.groups1.map((g1) => ({ ...g1, groups2: g1.groups2.map((g2) => ({ ...g2, groups3: g2.groups3.map((g3) => g3.id === 'a' ? { ...g3, listing: '12,xx,23' } : g3) })) })),
    }
    try {
      calculateWorkspaceForA4V2(corrupted, { mode: 'combined', group1Id: 'date-1' })
      throw new Error('Expected an error')
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceCalculationV2Error)
      expect((error as WorkspaceCalculationV2Error).code).toBe('INVALID_LISTING')
      expect((error as WorkspaceCalculationV2Error).group3Id).toBe('a')
    }
  })

  it('reports invalid point and coefficient', () => {
    const source = dataWithTwoGroups()
    const invalidPoint: CalculationDataV2 = {
      ...source,
      groups1: source.groups1.map((g1) => ({ ...g1, groups2: g1.groups2.map((g2) => ({ ...g2, groups3: g2.groups3.map((g3) => g3.id === 'a' ? { ...g3, point: '1.5' } : g3) })) })),
    }
    expect(() => calculateWorkspaceForA4V2(invalidPoint, { mode: 'combined', group1Id: 'date-1' })).toThrow(WorkspaceCalculationV2Error)

    const invalidCoefficient: CalculationDataV2 = {
      ...source, settingTypes: source.settingTypes.map(type=>type.id==='setting-type-1'?{...type,defaultCoefficientD:'-1'}:type),
    }
    expect(() => calculateWorkspaceForA4V2(invalidCoefficient, { mode: 'combined', group1Id: 'date-1' })).toThrow(WorkspaceCalculationV2Error)
  })

  it('reports a missing setting type reference', () => {
    const source = dataWithTwoGroups()
    const corrupted: CalculationDataV2 = {
      ...source,
      groups1: source.groups1.map((g1) => ({ ...g1, groups2: g1.groups2.map((g2) => ({ ...g2, groups3: g2.groups3.map((g3) => g3.id === 'a' ? { ...g3, settingTypeId: 'missing' } : g3) })) })),
    }
    expect(() => calculateWorkspaceForA4V2(corrupted, { mode: 'combined', group1Id: 'date-1' })).toThrow(WorkspaceCalculationV2Error)
  })

  it('reports a missing Group1 or selected Group2', () => {
    const data = dataWithTwoGroups()
    expect(() => calculateWorkspaceForA4V2(data, { mode: 'combined', group1Id: 'missing' })).toThrow(WorkspaceCalculationV2Error)
    expect(() => calculateWorkspaceForA4V2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'missing' })).toThrow(WorkspaceCalculationV2Error)
  })
})
