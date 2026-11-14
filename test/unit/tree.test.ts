
import { describe, expect, it } from 'vitest'

import {
  addGroup1,
  addGroup2,
  addSetting,
  createCalculationData,
  createGroup1,
  createGroup2,
  createSetting,
  deleteGroup1,
  deleteGroup2,
  deleteSetting,
  renameGroup1,
  renameGroup2,
  renameSetting,
  reorderGroup1,
  reorderGroup2,
  reorderSetting,
  setGroup2Visibility,
  updateDrawData,
  updateSetting,
  TreeOperationError,
} from '../../src/core/tree'

function createBaseData() {
  let data = createCalculationData()

  data = addGroup1(
    data,
    createGroup1('d1', '11/11/2026'),
  )

  return data
}

describe('Fixed three-level data tree', () => {
  it('creates an empty Calculation Data store', () => {
    const data = createCalculationData()

    expect(data.schemaVersion).toBe(1)
    expect(data.groups1).toEqual([])
  })

  it('creates Group 1 with empty draw data and children', () => {
    const group1 = createGroup1(
      'd1',
      '11/11/2026',
    )

    expect(group1.kind).toBe('group1')
    expect(group1.dateLabel).toBe('11/11/2026')
    expect(group1.drawData).toEqual({
      oneToSeven: [],
      gdb: '',
    })
    expect(group1.groups2).toEqual([])
  })

  it('adds Group 2 and Group 3 at the correct levels', () => {
    let data = createBaseData()

    data = addGroup2(
      data,
      'd1',
      createGroup2('g1', 'Obito'),
    )

    data = addSetting(
      data,
      'd1',
      'g1',
      createSetting('s1', 'Thiết lập A'),
    )

    expect(data.groups1[0].groups2[0].name).toBe('Obito')
    expect(data.groups1[0].groups2[0].settings[0].name)
      .toBe('Thiết lập A')
  })

  it('rejects duplicate Group 2 names in the same Group 1', () => {
    let data = createBaseData()

    data = addGroup2(
      data,
      'd1',
      createGroup2('g1', 'Obito'),
    )

    expect(() =>
      addGroup2(
        data,
        'd1',
        createGroup2('g2', ' obito '),
      ),
    ).toThrowError(TreeOperationError)
  })

  it('allows the same Group 2 name in different Group 1 entries', () => {
    let data = createBaseData()

    data = addGroup1(
      data,
      createGroup1('d2', '12/11/2026'),
    )

    data = addGroup2(
      data,
      'd1',
      createGroup2('g1', 'Obito'),
    )

    data = addGroup2(
      data,
      'd2',
      createGroup2('g2', 'Obito'),
    )

    expect(data.groups1[0].groups2[0].name).toBe('Obito')
    expect(data.groups1[1].groups2[0].name).toBe('Obito')
  })

  it('allows duplicate Group 3 setting names', () => {
    let data = createBaseData()

    data = addGroup2(
      data,
      'd1',
      createGroup2('g1', 'Obito'),
    )

    data = addSetting(
      data,
      'd1',
      'g1',
      createSetting('s1', 'Đầu'),
    )

    data = addSetting(
      data,
      'd1',
      'g1',
      createSetting('s2', 'Đầu'),
    )

    expect(data.groups1[0].groups2[0].settings)
      .toHaveLength(2)
  })

  it('rejects duplicate IDs across all hierarchy levels', () => {
    let data = createBaseData()

    data = addGroup2(
      data,
      'd1',
      createGroup2('g1', 'Obito'),
    )

    expect(() =>
      addSetting(
        data,
        'd1',
        'g1',
        createSetting('g1', 'Thiết lập'),
      ),
    ).toThrowError(TreeOperationError)
  })

  it('rejects an empty Group 2 name', () => {
    expect(() =>
      createGroup2('g1', '   '),
    ).toThrowError(TreeOperationError)
  })

  it('renames Group 1 date label without changing its ID', () => {
    const data = createBaseData()

    const updated = renameGroup1(
      data,
      'd1',
      '12/11/2026',
    )

    expect(updated.groups1[0].id).toBe('d1')
    expect(updated.groups1[0].dateLabel).toBe('12/11/2026')
  })

  it('rejects renaming Group 2 to a sibling name', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addGroup2(data, 'd1', createGroup2('g2', 'Obita'))

    expect(() =>
      renameGroup2(data, 'd1', 'g2', 'Obito'),
    ).toThrowError(TreeOperationError)
  })

  it('updates draw data without changing Group 1 identity', () => {
    const data = createBaseData()

    const updated = updateDrawData(data, 'd1', {
      oneToSeven: ['0012', '12345'],
      gdb: '99123',
    })

    expect(updated.groups1[0].id).toBe('d1')
    expect(updated.groups1[0].drawData).toEqual({
      oneToSeven: ['0012', '12345'],
      gdb: '99123',
    })

    // Dữ liệu ban đầu không bị thay đổi.
    expect(data.groups1[0].drawData.oneToSeven).toEqual([])
  })

  it('updates setting fields without changing its ID', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addSetting(
      data,
      'd1',
      'g1',
      createSetting('s1', 'Đầu'),
    )

    const updated = updateSetting(
      data,
      'd1',
      'g1',
      's1',
      {
        listing: '12, 23',
        point: '2',
        coefficientD: '3',
        coefficientT: '5',
      },
    )

    const setting = updated.groups1[0].groups2[0].settings[0]

    expect(setting.id).toBe('s1')
    expect(setting.listing).toBe('12, 23')
    expect(setting.point).toBe('2')
    expect(setting.coefficientD).toBe('3')
    expect(setting.coefficientT).toBe('5')
  })

  it('allows renaming settings to an existing setting name', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addSetting(data, 'd1', 'g1', createSetting('s1', 'Đầu'))
    data = addSetting(data, 'd1', 'g1', createSetting('s2', 'Đuôi'))

    data = renameSetting(data, 'd1', 'g1', 's2', 'Đầu')

    expect(data.groups1[0].groups2[0].settings.map(
      (setting) => setting.name,
    )).toEqual(['Đầu', 'Đầu'])
  })

  it('deletes Group 2 together with all its settings', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addSetting(data, 'd1', 'g1', createSetting('s1', 'A'))
    data = addSetting(data, 'd1', 'g1', createSetting('s2', 'B'))

    data = deleteGroup2(data, 'd1', 'g1')

    expect(data.groups1[0].groups2).toEqual([])
  })

  it('deletes only the selected setting', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addSetting(data, 'd1', 'g1', createSetting('s1', 'A'))
    data = addSetting(data, 'd1', 'g1', createSetting('s2', 'B'))

    data = deleteSetting(data, 'd1', 'g1', 's1')

    expect(data.groups1[0].groups2[0].settings.map(
      (setting) => setting.id,
    )).toEqual(['s2'])
  })

  it('deletes Group 1 and all its descendants', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addSetting(data, 'd1', 'g1', createSetting('s1', 'A'))

    data = deleteGroup1(data, 'd1')

    expect(data.groups1).toEqual([])
  })

  it('reorders Group 1 entries', () => {
    let data = createBaseData()

    data = addGroup1(
      data,
      createGroup1('d2', '12/11/2026'),
    )

    data = reorderGroup1(data, 'd2', 0)

    expect(data.groups1.map((group) => group.id))
      .toEqual(['d2', 'd1'])
  })

  it('reorders Group 2 entries within the same date', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addGroup2(data, 'd1', createGroup2('g2', 'Obita'))

    data = reorderGroup2(data, 'd1', 'g2', 0)

    expect(data.groups1[0].groups2.map((group) => group.id))
      .toEqual(['g2', 'g1'])
  })

  it('reorders settings within the same Group 2', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addSetting(data, 'd1', 'g1', createSetting('s1', 'A'))
    data = addSetting(data, 'd1', 'g1', createSetting('s2', 'B'))

    data = reorderSetting(data, 'd1', 'g1', 's2', 0)

    expect(data.groups1[0].groups2[0].settings.map(
      (setting) => setting.id,
    )).toEqual(['s2', 's1'])
  })

  it('rejects an invalid reorder index', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))

    expect(() =>
      reorderGroup2(data, 'd1', 'g1', 1),
    ).toThrowError(TreeOperationError)
  })

  it('hides Group 2 on A4 without deleting its settings', () => {
    let data = createBaseData()

    data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
    data = addSetting(data, 'd1', 'g1', createSetting('s1', 'A'))

    data = setGroup2Visibility(data, 'd1', 'g1', false)

    const group2 = data.groups1[0].groups2[0]

    expect(group2.isVisibleOnA4).toBe(false)
    expect(group2.name).toBe('Obito')
    expect(group2.settings).toHaveLength(1)
    expect(group2.settings[0].id).toBe('s1')
  })

  it('does not mutate the original data when adding a group', () => {
    const original = createBaseData()

    const updated = addGroup2(
      original,
      'd1',
      createGroup2('g1', 'Obito'),
    )

    expect(original.groups1[0].groups2).toHaveLength(0)
    expect(updated.groups1[0].groups2).toHaveLength(1)
    expect(updated).not.toBe(original)
  })
})
