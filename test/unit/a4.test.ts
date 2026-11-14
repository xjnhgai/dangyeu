
import { describe, expect, it } from 'vitest'

import {
  A4ProjectionError,
  buildA4Projection,
} from '../../src/core/a4'

import {
  addGroup1,
  addGroup2,
  addSetting,
  createCalculationData,
  createGroup1,
  createGroup2,
  createSetting,
  setGroup2Visibility,
} from '../../src/core/tree'

// ============================================================
// TEST DATA
// ============================================================

function createA4TestData() {
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

  data = addGroup2(
    data,
    'd1',
    createGroup2('g3', 'Naruto'),
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

  data = addSetting(
    data,
    'd1',
    'g3',
    createSetting('s4', 'Thiết lập D'),
  )

  return data
}

// ============================================================
// LEVEL 1
// ============================================================

describe('A4 projection - Level 1', () => {
  it('shows date and all visible Group 2 groups', () => {
    const data = createA4TestData()

    const result = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(result.level).toBe(1)
    expect(result.title).toBe('11/11/2026')

    expect(result.sections.map((section) => section.kind))
      .toEqual(['group2', 'group2', 'group2'])

    expect(
      result.sections
        .filter((section) => section.kind === 'group2')
        .map((section) => section.title),
    ).toEqual(['Obito', 'Obita', 'Naruto'])
  })

  it('flattens hidden Group 2 settings into one Group 1 section', () => {
    let data = createA4TestData()

    data = setGroup2Visibility(data, 'd1', 'g1', false)
    data = setGroup2Visibility(data, 'd1', 'g3', false)

    const result = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(result.sections.map((section) => section.kind))
      .toEqual(['group1-settings', 'group2'])

    const rootSection = result.sections[0]

    if (rootSection.kind !== 'group1-settings') {
      throw new Error('Expected Group 1 settings section')
    }

    expect(
      rootSection.settings.map(
        (item) => item.setting.id,
      ),
    ).toEqual(['s1', 's2', 's4'])

    const visibleSection = result.sections[1]

    if (visibleSection.kind !== 'group2') {
      throw new Error('Expected Group 2 section')
    }

    expect(visibleSection.title).toBe('Obita')

    expect(
      visibleSection.settings.map(
        (item) => item.setting.id,
      ),
    ).toEqual(['s3'])
  })

  it('combines hidden groups while preserving source order', () => {
    let data = createA4TestData()

    data = setGroup2Visibility(data, 'd1', 'g1', false)
    data = setGroup2Visibility(data, 'd1', 'g3', false)

    const result = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    const rootSection = result.sections.find(
      (section) => section.kind === 'group1-settings',
    )

    expect(rootSection?.kind).toBe('group1-settings')

    if (rootSection?.kind === 'group1-settings') {
      expect(
        rootSection.settings.map(
          (item) => item.setting.id,
        ),
      ).toEqual(['s1', 's2', 's4'])
    }
  })

  it('does not create an empty Group 1 settings section', () => {
    let data = createCalculationData()

    data = addGroup1(
      data,
      createGroup1('d1', '11/11/2026'),
    )

    // Nhóm cấp 2 không có thiết lập.
    data = addGroup2(
      data,
      'd1',
      createGroup2('g1', 'Obito'),
    )

    // Ẩn nhóm cấp 2.
    data = setGroup2Visibility(data, 'd1', 'g1', false)

    const result = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    // Không có thiết lập để gom nên không tạo section rỗng.
    expect(result.sections).toEqual([])
  })

  it('keeps empty visible Group 2 groups on A4', () => {
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

    const result = buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(result.sections).toHaveLength(1)

    const section = result.sections[0]

    expect(section.kind).toBe('group2')

    if (section.kind === 'group2') {
      expect(section.title).toBe('Obito')
      expect(section.settings).toEqual([])
    }
  })
})

// ============================================================
// LEVEL 2
// ============================================================

describe('A4 projection - Level 2', () => {
  it('shows only the selected Group 2 and its settings', () => {
    const data = createA4TestData()

    const result = buildA4Projection(data, {
      level: 2,
      group1Id: 'd1',
      group2Id: 'g1',
    })

    expect(result.level).toBe(2)
    expect(result.title).toBe('Obito')
    expect(result.sections).toHaveLength(1)

    const section = result.sections[0]

    expect(section.kind).toBe('selected-group-settings')

    if (section.kind === 'selected-group-settings') {
      expect(section.group2Id).toBe('g1')

      expect(
        section.settings.map(
          (item) => item.setting.id,
        ),
      ).toEqual(['s1', 's2'])
    }
  })

  it('hides the Group 2 title when selected Group 2 is hidden', () => {
    let data = createA4TestData()

    data = setGroup2Visibility(data, 'd1', 'g1', false)

    const result = buildA4Projection(data, {
      level: 2,
      group1Id: 'd1',
      group2Id: 'g1',
    })

    expect(result.title).toBeNull()

    const section = result.sections[0]

    expect(section.kind).toBe('selected-group-settings')

    if (section.kind === 'selected-group-settings') {
      expect(
        section.settings.map(
          (item) => item.setting.id,
        ),
      ).toEqual(['s1', 's2'])
    }
  })

  it('does not include settings from other Group 2 groups', () => {
    const data = createA4TestData()

    const result = buildA4Projection(data, {
      level: 2,
      group1Id: 'd1',
      group2Id: 'g2',
    })

    const section = result.sections[0]

    if (section.kind !== 'selected-group-settings') {
      throw new Error('Expected selected Group 2 section')
    }

    expect(
      section.settings.map(
        (item) => item.setting.id,
      ),
    ).toEqual(['s3'])
  })
})

// ============================================================
// LEVEL 3
// ============================================================

describe('A4 projection - Level 3', () => {
  it('shows only the selected setting', () => {
    const data = createA4TestData()

    const result = buildA4Projection(data, {
      level: 3,
      group1Id: 'd1',
      group2Id: 'g1',
      settingId: 's1',
    })

    expect(result.level).toBe(3)
    expect(result.title).toBe('Thiết lập A')
    expect(result.sections).toHaveLength(1)

    const section = result.sections[0]

    expect(section.kind).toBe('single-setting')

    if (section.kind === 'single-setting') {
      expect(section.setting.id).toBe('s1')
      expect(section.setting.name).toBe('Thiết lập A')
    }
  })

  it('does not include sibling settings or parent group names', () => {
    const data = createA4TestData()

    const result = buildA4Projection(data, {
      level: 3,
      group1Id: 'd1',
      group2Id: 'g1',
      settingId: 's2',
    })

    expect(result.title).toBe('Thiết lập B')
    expect(result.sections).toHaveLength(1)

    const section = result.sections[0]

    if (section.kind === 'single-setting') {
      expect(section.setting.id).toBe('s2')
      expect(section.setting.name).toBe('Thiết lập B')
    }
  })
})

// ============================================================
// INVALID SELECTION AND IMMUTABILITY
// ============================================================

describe('A4 projection - Invalid selection', () => {
  it('rejects an unknown Group 1 ID', () => {
    const data = createA4TestData()

    expect(() =>
      buildA4Projection(data, {
        level: 1,
        group1Id: 'unknown',
      }),
    ).toThrowError(A4ProjectionError)
  })

  it('rejects a Group 2 ID belonging to another date', () => {
    const data = createA4TestData()

    expect(() =>
      buildA4Projection(data, {
        level: 2,
        group1Id: 'd1',
        group2Id: 'unknown',
      }),
    ).toThrowError(A4ProjectionError)
  })

  it('rejects a setting ID outside its selected Group 2', () => {
    const data = createA4TestData()

    expect(() =>
      buildA4Projection(data, {
        level: 3,
        group1Id: 'd1',
        group2Id: 'g1',
        settingId: 's3',
      }),
    ).toThrowError(A4ProjectionError)
  })

  it('does not mutate the original Calculation Data', () => {
    const data = createA4TestData()

    const original = JSON.stringify(data)

    buildA4Projection(data, {
      level: 1,
      group1Id: 'd1',
    })

    expect(JSON.stringify(data)).toBe(original)
  })

  it('returns independent setting objects', () => {
    const data = createA4TestData()

    const result = buildA4Projection(data, {
      level: 2,
      group1Id: 'd1',
      group2Id: 'g1',
    })

    const section = result.sections[0]

    if (section.kind !== 'selected-group-settings') {
      throw new Error('Expected selected Group 2 section')
    }

    expect(section.settings[0].setting).not.toBe(
      data.groups1[0].groups2[0].settings[0],
    )
  })
})
