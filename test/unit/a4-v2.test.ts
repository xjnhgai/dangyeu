import { describe, expect, it } from 'vitest'
import type { CalculationDataV2, Group1, Group2, Group3 } from '../../src/core/models-v2'
import { addGroup1V2, addGroup2V2, addGroup3V2, createCalculationDataV2 } from '../../src/core/tree-v2'
import { buildA4ProjectionV2, A4ProjectionV2Error } from '../../src/core/a4-v2'

function item(id: string, typeId = 'setting-type-3'): Group3 {
  return { kind: 'group3', id, settingTypeId: typeId, listing: '12', point: '2', coefficientD: '1.5', coefficientT: '2' }
}

function sample(): CalculationDataV2 {
  let data = createCalculationDataV2()
  // The built-in catalog order is LB, LA, ĐA, ĐB.
  const g1: Group1 = { kind: 'group1', id: 'date-1', dateLabel: '12/11', drawData: { oneToSeven: [], gdb: '' }, groups2: [] }
  data = addGroup1V2(data, g1)
  const g2a: Group2 = { kind: 'group2', id: 'obito', name: 'Obito', groups3: [] }
  const g2b: Group2 = { kind: 'group2', id: 'obita', name: 'Obita', groups3: [] }
  const g2c: Group2 = { kind: 'group2', id: 'obitu', name: 'Obitu', groups3: [] }
  data = addGroup2V2(data, 'date-1', g2a)
  data = addGroup2V2(data, 'date-1', g2b)
  data = addGroup2V2(data, 'date-1', g2c)
  data = addGroup3V2(data, 'date-1', 'obito', item('a1'))
  data = addGroup3V2(data, 'date-1', 'obita', item('a2'))
  data = addGroup3V2(data, 'date-1', 'obitu', item('a3'))
  data = addGroup3V2(data, 'date-1', 'obito', item('b1', 'setting-type-4'))
  data = addGroup3V2(data, 'date-1', 'obita', item('b2', 'setting-type-4'))
  return data
}

describe('A4 projection V2', () => {
  it('combined mode groups entries from all Group2 by setting type', () => {
    const projection = buildA4ProjectionV2(sample(), { mode: 'combined', group1Id: 'date-1' })
    expect(projection.sections.map((section) => section.title)).toEqual(['ĐA', 'ĐB'])
    expect(projection.sections[0]!.entries.map((entry) => entry.group3.id)).toEqual(['a1', 'a2', 'a3'])
    expect(projection.sections[1]!.entries.map((entry) => entry.group3.id)).toEqual(['b1', 'b2'])
    expect(projection.entries).toHaveLength(5)
    expect(projection).not.toHaveProperty('group2')
  })

  it('does not merge separate Group3 records with the same type', () => {
    const projection = buildA4ProjectionV2(sample(), { mode: 'combined', group1Id: 'date-1' })
    const entries = projection.sections[0]!.entries
    expect(entries).toHaveLength(3)
    expect(entries.map((entry) => entry.group3.listing)).toEqual(['12', '12', '12'])
  })

  it('individual Group2 mode contains only that group and includes its name metadata', () => {
    const projection = buildA4ProjectionV2(sample(), { mode: 'group2', group1Id: 'date-1', group2Id: 'obita' })
    expect(projection.group2?.name).toBe('Obita')
    expect(projection.entries.map((entry) => entry.group3.id)).toEqual(['a2', 'b2'])
  })

  it('keeps the date as page title in either mode', () => {
    const data = sample()
    expect(buildA4ProjectionV2(data, { mode: 'combined', group1Id: 'date-1' }).group1.dateLabel).toBe('12/11')
    expect(buildA4ProjectionV2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'obito' }).group1.dateLabel).toBe('12/11')
  })

  it('throws when the selected date or group does not exist', () => {
    const data = sample()
    expect(() => buildA4ProjectionV2(data, { mode: 'combined', group1Id: 'missing' })).toThrow(A4ProjectionV2Error)
    expect(() => buildA4ProjectionV2(data, { mode: 'group2', group1Id: 'date-1', group2Id: 'missing' })).toThrow(A4ProjectionV2Error)
  })

  it('throws when a Group3 refers to a missing type in corrupted data', () => {
    const data = sample()
    const corrupted: CalculationDataV2 = {
      ...data,
      groups1: data.groups1.map((g1) => ({ ...g1, groups2: g1.groups2.map((g2) => ({ ...g2, groups3: g2.groups3.map((g3) => g3.id === 'a1' ? { ...g3, settingTypeId: 'missing' } : g3) })) })),
    }
    expect(() => buildA4ProjectionV2(corrupted, { mode: 'combined', group1Id: 'date-1' })).toThrow(A4ProjectionV2Error)
  })
})
