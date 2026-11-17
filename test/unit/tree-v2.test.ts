import { describe, expect, it } from 'vitest'
import type { CalculationDataV2, Group1, Group2, Group3 } from '../../src/core/models-v2'
import {
  addGroup1V2,
  addGroup2V2,
  addGroup3V2,
  addSettingType,
  createCalculationDataV2,
  createGroup3FromDefaults,
  deleteGroup1V2,
  deleteGroup2V2,
  deleteGroup3V2,
  deleteSettingType,
  renameGroup2V2,
  reorderGroup2V2,
  reorderSettingType,
  updateGroup1DrawDataV2,
  updateGroup3V2,
  updateSettingTypeDefaults,
} from '../../src/core/tree-v2'

function base(): CalculationDataV2 {
  let data = createCalculationDataV2()
  const group1: Group1 = {
    kind: 'group1', id: 'date-1', dateLabel: '12/11/2026',
    drawData: { oneToSeven: [], gdb: '' }, groups2: [],
  }
  data = addGroup1V2(data, group1)
  const group2: Group2 = { kind: 'group2', id: 'group-1', name: 'Obito', groups3: [] }
  return addGroup2V2(data, 'date-1', group2)
}

function g3(id: string, overrides: Partial<Group3> = {}): Group3 {
  return {
    kind: 'group3', id, settingTypeId: 'setting-type-1',
    listing: '12', point: '2', coefficientD: '1.5', coefficientT: '2.5',
    ...overrides,
  }
}

function add(data: CalculationDataV2, item: Group3): CalculationDataV2 {
  return addGroup3V2(data, 'date-1', 'group-1', item)
}

function entries(data: CalculationDataV2): Group3[] {
  return data.groups1[0]!.groups2[0]!.groups3
}

function defaultType(data: CalculationDataV2) {
  return data.settingTypes.find((item) => item.id === 'setting-type-1')!
}

describe('three-level V2 tree', () => {
  it('creates the catalog with independent formula-specific coefficient defaults', () => {
    const data = base()
    expect(data.settingTypes.map((item) => [item.name, item.formulaId])).toEqual([
      ['LB', 'lb'], ['LA', 'la'], ['ĐA', 'da'], ['ĐB', 'db'],
      ['CA', 'ca'], ['CB', 'cb'], ['XA', 'xa'], ['XB', 'xb'],
    ])
    expect(defaultType(data).defaultCoefficientD).toBe('21,8')
    expect(defaultType(data).defaultCoefficientT).toBe('80')
  })

  it('creates ĐA/ĐB coefficient profiles by digit width', () => {
    const data = base()
    const da = data.settingTypes.find((item) => item.formulaId === 'da')!
    const db = data.settingTypes.find((item) => item.formulaId === 'db')!
    expect(da.defaultCoefficientsByCount).toEqual({ '2': { coefficientD: '0,74', coefficientT: '70' }, '3': { coefficientD: '0,74', coefficientT: '40000' } })
    expect(db.defaultCoefficientsByCount).toEqual({ '2': { coefficientD: '0,74', coefficientT: '70' }, '3': { coefficientD: '0,74', coefficientT: '40000' } })
    const configured = updateSettingTypeDefaults(data, da.id, {
      coefficientsByCount: {
        '2': { coefficientD: '1', coefficientT: '2' },
        '3': { coefficientD: '3', coefficientT: '4' },
      },
    })
    const configuredDa = configured.settingTypes.find((item) => item.id === da.id)!
    const twoDigitRow = createGroup3FromDefaults(configuredDa, 'da-row-2', '12 34', '10')
    const threeDigitRow = createGroup3FromDefaults(configuredDa, 'da-row-3', '123 234', '10')
    expect(twoDigitRow.coefficientsByCount?.['2']).toEqual({ coefficientD: '1', coefficientT: '2' })
    expect(threeDigitRow.coefficientsByCount?.['3']).toEqual({ coefficientD: '3', coefficientT: '4' })
  })

  it('creates XA/XB definitions with independent coefficient defaults for 2–4 listed numbers', () => {
    const data = base()
    const xa = data.settingTypes.find((item) => item.formulaId === 'xa')!
    expect(xa.name).toBe('XA')
    expect(Object.values(xa.defaultCoefficientsByCount ?? {})).toEqual(['10','35','100'].map(coefficientT => ({coefficientD:'0,65',coefficientT})))
    const updated = updateSettingTypeDefaults(data, xa.id, {
      coefficientsByCount: {
        '2': { coefficientD: '1', coefficientT: '2' },
        '3': { coefficientD: '3', coefficientT: '4' },
        '4': { coefficientD: '5', coefficientT: '6' },
        '5': { coefficientD: '7', coefficientT: '8' },
      },
    })
    const created = createGroup3FromDefaults(updated.settingTypes.find((item) => item.id === xa.id)!, 'xa-row', '11 22', '10')
    expect(created.coefficientsByCount?.['2']).toEqual({ coefficientD: '1', coefficientT: '2' })
    expect(created.coefficientsByCount?.['5']).toEqual({ coefficientD: '7', coefficientT: '8' })
  })

  it('creates Group3 directly from setting type defaults', () => {
    const data = updateSettingTypeDefaults(base(), 'setting-type-1', { coefficientD: '1.5', coefficientT: '2.5' })
    const item = createGroup3FromDefaults(defaultType(data), 'entry-1', '12', '2')
    expect(item).toEqual({
      kind: 'group3', id: 'entry-1', settingTypeId: 'setting-type-1',
      listing: '12', point: '2', coefficientD: '1.5', coefficientT: '2.5',
    })
    expect('instances' in item).toBe(false)
  })

  it('adds direct Group3 without changing publisher-protected defaults', () => {
    const data = base()
    const updated = add(data, g3('entry-1'))
    expect(entries(updated)).toHaveLength(1)
    expect(defaultType(updated)).toEqual(defaultType(data))
    expect(defaultType(updated).defaultCoefficientD).toBe('21,8')
    expect(defaultType(updated).defaultCoefficientT).toBe('80')
  })

  it('ignores stale or blank row coefficients when adding a new entry', () => {
    let data = updateSettingTypeDefaults(base(), 'setting-type-1', { coefficientD: '1.5', coefficientT: '2.5' })
    data = add(data, g3('entry-1', { coefficientD: '3.0', coefficientT: '' }))
    expect(defaultType(data).defaultCoefficientD).toBe('1.5')
    expect(defaultType(data).defaultCoefficientT).toBe('2.5')
  })

  it('does not modify historical Group3 coefficients when a new entry is added', () => {
    let data = add(base(), g3('entry-1'))
    data = add(data, g3('entry-2', { coefficientD: '4', coefficientT: '5' }))
    expect(entries(data)[0]!.coefficientD).toBe('1.5')
    expect(entries(data)[0]!.coefficientT).toBe('2.5')
  })

  it('allows editing listing, point and both coefficients on a saved Group3', () => {
    const data = add(base(), g3('entry-1'))
    const updated = updateGroup3V2(data, 'date-1', 'group-1', 'entry-1', {
      listing: '34',
      point: '7',
      coefficientD: '999',
      coefficientT: '888',
    })
    expect(entries(updated)[0]).toMatchObject({
      listing: '34',
      point: '7',
      coefficientD: '999',
      coefficientT: '888',
    })
    // Editing a saved entry cannot rewrite catalog coefficients.
    expect(defaultType(updated).defaultCoefficientD).toBe('21,8')
    expect(defaultType(updated).defaultCoefficientT).toBe('80')
  })

  it('clears D default independently from T', () => {
    const data = updateSettingTypeDefaults(base(), 'setting-type-1', { coefficientD: '1.5', coefficientT: '2.5' })
    const updated = updateSettingTypeDefaults(data, 'setting-type-1', { coefficientD: null })
    expect(defaultType(updated).defaultCoefficientD).toBeNull()
    expect(defaultType(updated).defaultCoefficientT).toBe('2.5')
  })

  it('rejects duplicate IDs in a nested Group1 subtree', () => {
    const data = base()
    const duplicate: Group1 = {
      kind: 'group1', id: 'date-2', dateLabel: '13/11/2026',
      drawData: { oneToSeven: [], gdb: '' },
      groups2: [{ kind: 'group2', id: 'group-2', name: 'Naruto', groups3: [g3('group-1')] }],
    }
    expect(() => addGroup1V2(data, duplicate)).toThrow('ID không hợp lệ hoặc bị trùng: group-1')
  })

  it('rejects duplicate IDs within a new subtree', () => {
    const data = base()
    const duplicate = g3('same')
    const group2: Group2 = { kind: 'group2', id: 'group-2', name: 'Naruto', groups3: [duplicate, { ...duplicate }] }
    expect(() => addGroup2V2(data, 'date-1', group2)).toThrow('ID không hợp lệ hoặc bị trùng: same')
  })

  it('rejects a Group3 ID already used in another group', () => {
    let data = add(base(), g3('entry-1'))
    const group2: Group2 = { kind: 'group2', id: 'group-2', name: 'Naruto', groups3: [] }
    data = addGroup2V2(data, 'date-1', group2)
    expect(() => addGroup3V2(data, 'date-1', 'group-2', g3('entry-1'))).toThrow('ID không hợp lệ hoặc bị trùng: entry-1')
  })

  it('rejects references to nonexistent setting types', () => {
    expect(() => add(base(), g3('entry-1', { settingTypeId: 'missing' }))).toThrow('Không tìm thấy loại thiết lập: missing')
  })

  it('rejects duplicate Group2 names case-insensitively within one date', () => {
    const data = base()
    expect(() => addGroup2V2(data, 'date-1', { kind: 'group2', id: 'group-2', name: 'obito', groups3: [] })).toThrow('Tên nhóm đã tồn tại trong ngày này.')
  })

  it('allows multiple Group1 records to share the same date label', () => {
    const data = base()
    const duplicateDate: Group1 = {
      kind: 'group1', id: 'date-duplicate', dateLabel: '12/11/2026',
      drawData: { oneToSeven: [], gdb: '' }, groups2: [],
    }
    const updated = addGroup1V2(data, duplicateDate)
    expect(updated.groups1.filter((item) => item.dateLabel === '12/11/2026')).toHaveLength(2)
  })

  it('allows the same Group2 name on a different date', () => {
    let data = base()
    data = addGroup1V2(data, { kind: 'group1', id: 'date-2', dateLabel: '13/11/2026', drawData: { oneToSeven: [], gdb: '' }, groups2: [] })
    data = addGroup2V2(data, 'date-2', { kind: 'group2', id: 'group-2', name: 'Obito', groups3: [] })
    expect(data.groups1[1]!.groups2[0]!.name).toBe('Obito')
  })

  it('renames Group2 and rejects a sibling duplicate', () => {
    let data = base()
    data = addGroup2V2(data, 'date-1', { kind: 'group2', id: 'group-2', name: 'Naruto', groups3: [] })
    data = renameGroup2V2(data, 'date-1', 'group-2', 'Sasuke')
    expect(data.groups1[0]!.groups2[1]!.name).toBe('Sasuke')
    expect(() => renameGroup2V2(data, 'date-1', 'group-2', 'OBITO')).toThrow('Tên nhóm đã tồn tại trong ngày này.')
  })

  it("reorders Group2 while preserving each group's data", () => {
    let data = base()
    data = addGroup2V2(data, 'date-1', { kind: 'group2', id: 'group-2', name: 'Obita', groups3: [] })
    data = reorderGroup2V2(data, 'date-1', 'group-2', 0)
    expect(data.groups1[0]!.groups2.map((item) => item.name)).toEqual(['Obita', 'Obito'])
    expect(() => reorderGroup2V2(data, 'date-1', 'group-2', 5)).toThrow('Vị trí mới không hợp lệ.')
  })

  it('deletes one complete Group1 A4 record without changing other dates', () => {
    let data = add(base(), g3('entry-1'))
    data = addGroup1V2(data, { kind: 'group1', id: 'date-2', dateLabel: '13/11/2026', drawData: { oneToSeven: [], gdb: '' }, groups2: [] })
    const updated = deleteGroup1V2(data, 'date-1')
    expect(updated.groups1.map((item) => item.id)).toEqual(['date-2'])
    expect(data.groups1).toHaveLength(2)
    expect(() => deleteGroup1V2(updated, 'date-1')).toThrow('Không tìm thấy A4 cần xóa.')
  })

  it('deletes one Group3 or Group2 without mutating the original', () => {
    let data = add(base(), g3('entry-1'))
    data = add(data, g3('entry-2'))
    const withoutEntry = deleteGroup3V2(data, 'date-1', 'group-1', 'entry-1')
    expect(entries(withoutEntry).map((item) => item.id)).toEqual(['entry-2'])
    const withoutGroup = deleteGroup2V2(withoutEntry, 'date-1', 'group-1')
    expect(withoutGroup.groups1[0]!.groups2).toHaveLength(0)
    expect(data.groups1[0]!.groups2[0]!.groups3).toHaveLength(2)
  })

  it('reorders formula catalog entries without changing formula identities', () => {
    const data = base()
    const updated = reorderSettingType(data, 'setting-type-4', 0)
    expect(updated.settingTypes.map((item) => item.name)).toEqual(['ĐB', 'LB', 'LA', 'ĐA', 'CA', 'CB', 'XA', 'XB'])
    expect(updated.settingTypes[0]!.formulaId).toBe('db')
    expect(data.settingTypes[0]!.name).toBe('LB')
    expect(() => reorderSettingType(updated, 'setting-type-4', 9)).toThrow('Vị trí mới không hợp lệ.')
  })

  it('prevents deleting a setting type that is in use', () => {
    const data = add(base(), g3('entry-1'))
    expect(() => deleteSettingType(data, 'setting-type-1')).toThrow('Không thể xóa loại thiết lập đang được sử dụng.')
  })

  it('adds and renames distinct setting types', () => {
    let data = base()
    data = addSettingType(data, { id: 'type-5', formulaId: 'lb', name: 'Khác', defaultCoefficientD: null, defaultCoefficientT: null })
    expect(data.settingTypes).toHaveLength(9)
    expect(() => addSettingType(data, { id: 'type-6', formulaId: 'lb', name: ' khác ', defaultCoefficientD: null, defaultCoefficientT: null })).toThrow('Tên loại thiết lập đã tồn tại.')
  })

  it('updates draw data without mutating other groups', () => {
    const data = base()
    const updated = updateGroup1DrawDataV2(data, 'date-1', { oneToSeven: ['00012'], gdb: '12345' })
    expect(updated.groups1[0]!.drawData).toEqual({ oneToSeven: ['00012'], gdb: '12345' })
    expect(data.groups1[0]!.drawData.oneToSeven).toEqual([])
  })
})
