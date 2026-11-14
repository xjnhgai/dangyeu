
import { describe, expect, it } from 'vitest'

import {
  buildA4Projection,
} from '../../src/core/a4'

import {
  buildA4Summary,
  SummaryError,
  type SettingCalculationAmounts,
} from '../../src/core/summary'

import {
  addGroup1,
  addGroup2,
  addSetting,
  createCalculationData,
  createGroup1,
  createGroup2,
  createSetting,
  updateDrawData,
} from '../../src/core/tree'

function createSummaryTestData(withDrawData = true) {
  let data = createCalculationData()

  data = addGroup1(
    data,
    createGroup1('d1', '11/11/2026'),
  )

  data = addGroup2(data, 'd1', createGroup2('g1', 'Obito'))
  data = addGroup2(data, 'd1', createGroup2('g2', 'Obita'))
  data = addGroup2(data, 'd1', createGroup2('g3', 'Naruto'))

  data = addSetting(data, 'd1', 'g1', createSetting('s1', 'A'))
  data = addSetting(data, 'd1', 'g1', createSetting('s2', 'B'))
  data = addSetting(data, 'd1', 'g2', createSetting('s3', 'C'))
  data = addSetting(data, 'd1', 'g3', createSetting('s4', 'D'))

  if (withDrawData) {
    data = updateDrawData(data, 'd1', {
      oneToSeven: ['55628', '12635'],
      gdb: '99123',
    })
  }

  return data
}

function createCalculationResults(
): Map<string, SettingCalculationAmounts> {
  return new Map([
    ['s1', { d: 2, t: 3 }],
    ['s2', { d: 4, t: 0 }],
    ['s3', { d: 6, t: 7 }],
    ['s4', { d: 8, t: 11 }],
  ])
}

describe('A4 summary - Level 1', () => {
  it('calculates visible Group 2 subtotals and overall totals', () => {
    const data = createSummaryTestData()

    const group1 = data.groups1[0]

    const projection = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    const summary = buildA4Summary(
      projection,
      createCalculationResults(),
      group1.drawData,
    )

    expect(summary.level).toBe(1)

    expect(summary.sections.map((section) => ({
      group2Id: section.group2Id,
      d: section.totals.d,
      t: section.totals.t,
      difference: section.totals.difference,
    }))).toEqual([
      {
        group2Id: 'g1',
        d: 6,
        t: 3,
        difference: -3,
      },
      {
        group2Id: 'g2',
        d: 6,
        t: 7,
        difference: 1,
      },
      {
        group2Id: 'g3',
        d: 8,
        t: 11,
        difference: 3,
      },
    ])

    expect(summary.totals).toEqual({
      settingCount: 4,
      d: 20,
      t: 21,
      difference: 1,
    })
  })

  it('keeps overall totals unchanged when Group 2 groups are hidden', async () => {
    const {
      setGroup2Visibility,
    } = await import('../../src/core/tree')

    let data = createSummaryTestData()

    data = setGroup2Visibility(data, 'd1', 'g1', false)
    data = setGroup2Visibility(data, 'd1', 'g3', false)

    const group1 = data.groups1[0]

    const projection = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    const summary = buildA4Summary(
      projection,
      createCalculationResults(),
      group1.drawData,
    )

    expect(summary.sections.map((section) => section.kind))
      .toEqual(['group1-settings', 'group2'])

    expect(summary.sections[0].totals).toEqual({
      settingCount: 3,
      d: 14,
      t: 14,
      difference: 0,
    })

    expect(summary.totals).toEqual({
      settingCount: 4,
      d: 20,
      t: 21,
      difference: 1,
    })
  })
})

describe('A4 summary - Level 2', () => {
  it('summarizes only the selected Group 2', () => {
    const data = createSummaryTestData()
    const group1 = data.groups1[0]

    const projection = buildA4Projection(data, {
      level: 2,
      group1Id: 'd1',
      group2Id: 'g1',
    })

    const summary = buildA4Summary(
      projection,
      createCalculationResults(),
      group1.drawData,
    )

    expect(summary.totals).toEqual({
      settingCount: 2,
      d: 6,
      t: 3,
      difference: -3,
    })
  })
})

describe('A4 summary - Level 3', () => {
  it('summarizes only the selected setting', () => {
    const data = createSummaryTestData()
    const group1 = data.groups1[0]

    const projection = buildA4Projection(data, {
      level: 3,
      group1Id: 'd1',
      group2Id: 'g1',
      settingId: 's1',
    })

    const summary = buildA4Summary(
      projection,
      createCalculationResults(),
      group1.drawData,
    )

    expect(summary.totals).toEqual({
      settingCount: 1,
      d: 2,
      t: 3,
      difference: 1,
    })
  })
})

describe('A4 summary - Missing draw data', () => {
  it('returns null for T and difference when 1-7 and GĐB are empty', () => {
    const data = createSummaryTestData(false)
    const group1 = data.groups1[0]

    const results = new Map<string, SettingCalculationAmounts>([
      ['s1', { d: 2, t: null }],
      ['s2', { d: 4, t: null }],
      ['s3', { d: 6, t: null }],
      ['s4', { d: 8, t: null }],
    ])

    const projection = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    const summary = buildA4Summary(
      projection,
      results,
      group1.drawData,
    )

    expect(summary.totals).toEqual({
      settingCount: 4,
      d: 20,
      t: null,
      difference: null,
    })
  })

  it('does not convert a missing T result to zero', () => {
    const data = createSummaryTestData(false)
    const group1 = data.groups1[0]

    const results = new Map<string, SettingCalculationAmounts>([
      ['s1', { d: 2, t: 0 }],
    ])

    const projection = buildA4Projection(data, {
      level: 3,
      group1Id: 'd1',
      group2Id: 'g1',
      settingId: 's1',
    })

    expect(() =>
      buildA4Summary(
        projection,
        results,
        group1.drawData,
      ),
    ).toThrowError(SummaryError)
  })
})

describe('A4 summary - Zero T', () => {
  it('keeps zero T when draw data exists but no pairs match', () => {
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

    data = addSetting(
      data,
      'd1',
      'g1',
      createSetting('s1', 'A'),
    )

    data = updateDrawData(data, 'd1', {
      oneToSeven: ['12345'],
      gdb: '',
    })

    const group1 = data.groups1[0]

    const projection = buildA4Projection(data, {
      level: 3,
      group1Id: 'd1',
      group2Id: 'g1',
      settingId: 's1',
    })

    const results = new Map<string, SettingCalculationAmounts>([
      ['s1', { d: 5, t: 0 }],
    ])

    const summary = buildA4Summary(
      projection,
      results,
      group1.drawData,
    )

    expect(summary.totals).toEqual({
      settingCount: 1,
      d: 5,
      t: 0,
      difference: -5,
    })
  })

  it('returns zero totals for an empty section when draw data exists', () => {
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

    data = updateDrawData(data, 'd1', {
      oneToSeven: ['12345'],
      gdb: '',
    })

    const group1 = data.groups1[0]

    const projection = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    const summary = buildA4Summary(
      projection,
      new Map(),
      group1.drawData,
    )

    expect(summary.totals).toEqual({
      settingCount: 0,
      d: 0,
      t: 0,
      difference: 0,
    })

    expect(summary.sections[0].totals).toEqual({
      settingCount: 0,
      d: 0,
      t: 0,
      difference: 0,
    })
  })
})

describe('A4 summary - Validation', () => {
  it('rejects a missing setting calculation result', () => {
    const data = createSummaryTestData()
    const group1 = data.groups1[0]

    const projection = buildA4Projection(data, {
      level: 3,
      group1Id: 'd1',
      group2Id: 'g1',
      settingId: 's1',
    })

    expect(() =>
      buildA4Summary(
        projection,
        new Map(),
        group1.drawData,
      ),
    ).toThrowError(SummaryError)
  })
})
