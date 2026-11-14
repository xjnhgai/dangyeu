import { describe, expect, it } from 'vitest'
import { moveGroup2Name, orderGroups2 } from '../../src/core/group2-order'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { cleanListingInput } from '../../src/core/input-text'

describe('user-managed Group2 order', () => {
  it('moves in either direction and keeps every name exactly once', () => {
    const names = ['Lan', 'Mai', 'Hồng']
    expect(moveGroup2Name(names, 'lan', 'Hồng')).toEqual(['Mai', 'Hồng', 'Lan'])
    expect(moveGroup2Name(names, 'Hồng', 'Lan')).toEqual(['Hồng', 'Lan', 'Mai'])
    expect(moveGroup2Name(names, 'missing', 'Lan')).toEqual(names)
    expect(names).toEqual(['Lan', 'Mai', 'Hồng'])
  })
  it('orders existing groups on each A4 without moving or changing rows between pages', () => {
    const group = (id: string, name: string) => ({ kind: 'group2' as const, id, name, groups3: [] })
    const data = { ...createCalculationDataV2(), groups1: [{ kind: 'group1' as const, id: 'a4', dateLabel: '14/11/2026', drawData: { oneToSeven: [], gdb: '' }, groups2: [group('1', 'Lan'), group('2', 'Mai')] }] }
    const result = orderGroups2(data, ['Mai', 'Lan'])
    expect(result.groups1[0].groups2.map((item) => item.id)).toEqual(['2', '1'])
    expect(data.groups1[0].groups2.map((item) => item.id)).toEqual(['1', '2'])
  })
})

describe('numeric multiline entry', () => {
  it('keeps leading zeros, commas and line breaks while removing alphabetic input', () => {
    expect(cleanListingInput('ab00, 12\n34 tiếng Việt !')).toBe('00, 12\n34   ')
    expect(cleanListingInput('00.12.34')).toBe('00,12,34')
  })
})
