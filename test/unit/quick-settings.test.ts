
import { describe, expect, it } from 'vitest'

import {
  addGroup2NameSuggestion,
  addSettingNameSuggestion,
  addSettingTemplate,
  createQuickSettingsData,
  deleteGroup2NameSuggestion,
  deleteSettingNameSuggestion,
  deleteSettingTemplate,
  QuickSettingsError,
  rememberGroup2Name,
  rememberSettingName,
  renameGroup2NameSuggestion,
  renameSettingNameSuggestion,
  reorderGroup2NameSuggestion,
  reorderSettingNameSuggestion,
  reorderSettingTemplate,
  updateSettingTemplate,
} from '../../src/core/quick-settings'

describe('Quick Settings factory', () => {
  it('creates three independent empty collections', () => {
    const data = createQuickSettingsData()

    expect(data.group2NameSuggestions).toEqual([])
    expect(data.settingNameSuggestions).toEqual([])
    expect(data.settingTemplates).toEqual([])
  })
})

describe('Group 2 name suggestions', () => {
  it('adds a Group 2 name suggestion', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'g1', 'Obito')

    expect(data.group2NameSuggestions).toEqual([
      { id: 'g1', name: 'Obito' },
    ])
  })

  it('trims names and rejects duplicate suggestions', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'g1', 'Obito')

    expect(() =>
      addGroup2NameSuggestion(data, 'g2', ' obito '),
    ).toThrowError(QuickSettingsError)
  })

  it('remembers a new name only once', () => {
    let data = createQuickSettingsData()

    data = rememberGroup2Name(data, 'g1', 'Obito')

    const original = data

    data = rememberGroup2Name(data, 'g2', 'obito')

    expect(data).toBe(original)
    expect(data.group2NameSuggestions).toHaveLength(1)
  })

  it('renames a Group 2 suggestion', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'g1', 'Obito')
    data = renameGroup2NameSuggestion(data, 'g1', 'Obita')

    expect(data.group2NameSuggestions[0].name).toBe('Obita')
  })

  it('rejects renaming a suggestion to an existing name', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'g1', 'Obito')
    data = addGroup2NameSuggestion(data, 'g2', 'Obita')

    expect(() =>
      renameGroup2NameSuggestion(data, 'g2', 'Obito'),
    ).toThrowError(QuickSettingsError)
  })

  it('deletes only the selected Group 2 suggestion', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'g1', 'Obito')
    data = addGroup2NameSuggestion(data, 'g2', 'Obita')

    data = deleteGroup2NameSuggestion(data, 'g1')

    expect(data.group2NameSuggestions).toEqual([
      { id: 'g2', name: 'Obita' },
    ])
  })

  it('reorders Group 2 suggestions', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'g1', 'Obito')
    data = addGroup2NameSuggestion(data, 'g2', 'Obita')
    data = addGroup2NameSuggestion(data, 'g3', 'Naruto')

    data = reorderGroup2NameSuggestion(data, 'g3', 0)

    expect(
      data.group2NameSuggestions.map((item) => item.name),
    ).toEqual(['Naruto', 'Obito', 'Obita'])
  })
})

describe('Group 3 setting name suggestions', () => {
  it('adds and remembers a setting name', () => {
    let data = createQuickSettingsData()

    data = addSettingNameSuggestion(data, 's1', 'Đầu')
    data = rememberSettingName(data, 's2', 'Đuôi')
    data = rememberSettingName(data, 's3', 'Đuôi')

    expect(
      data.settingNameSuggestions.map((item) => item.name),
    ).toEqual(['Đầu', 'Đuôi'])
  })

  it('keeps Group 2 and setting name lists independent', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'g1', 'Đầu')
    data = addSettingNameSuggestion(data, 's1', 'Đầu')

    expect(data.group2NameSuggestions).toHaveLength(1)
    expect(data.settingNameSuggestions).toHaveLength(1)
  })

  it('renames and deletes a setting name suggestion', () => {
    let data = createQuickSettingsData()

    data = addSettingNameSuggestion(data, 's1', 'Đầu')
    data = renameSettingNameSuggestion(data, 's1', 'Đặc biệt')
    data = deleteSettingNameSuggestion(data, 's1')

    expect(data.settingNameSuggestions).toEqual([])
  })

  it('reorders setting name suggestions', () => {
    let data = createQuickSettingsData()

    data = addSettingNameSuggestion(data, 's1', 'Đầu')
    data = addSettingNameSuggestion(data, 's2', 'Đuôi')
    data = addSettingNameSuggestion(data, 's3', 'Lô')

    data = reorderSettingNameSuggestion(data, 's3', 0)

    expect(
      data.settingNameSuggestions.map((item) => item.name),
    ).toEqual(['Lô', 'Đầu', 'Đuôi'])
  })

  it('rejects duplicate IDs between suggestion lists', () => {
    let data = createQuickSettingsData()

    data = addGroup2NameSuggestion(data, 'same-id', 'Obito')

    expect(() =>
      addSettingNameSuggestion(data, 'same-id', 'Đầu'),
    ).toThrowError(QuickSettingsError)
  })
})

describe('Quick setting templates', () => {
  it('creates templates with name and D/T coefficients', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 't1',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    expect(data.settingTemplates).toEqual([
      {
        id: 't1',
        name: 'Đầu',
        coefficientD: '2',
        coefficientT: '5',
      },
    ])
  })

  it('allows templates with the same name and different coefficients', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 't1',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    data = addSettingTemplate(data, {
      id: 't2',
      name: 'Đầu',
      coefficientD: '3',
      coefficientT: '5',
    })

    expect(data.settingTemplates).toHaveLength(2)
  })

  it('does not add an exact duplicate template', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 't1',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    const original = data

    data = addSettingTemplate(data, {
      id: 't2',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    expect(data).toBe(original)
    expect(data.settingTemplates).toHaveLength(1)
  })

  it('updates template name and coefficients without changing ID', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 't1',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    data = updateSettingTemplate(data, 't1', {
      name: 'Đặc biệt',
      coefficientD: '3',
    })

    expect(data.settingTemplates[0]).toEqual({
      id: 't1',
      name: 'Đặc biệt',
      coefficientD: '3',
      coefficientT: '5',
    })
  })

  it('rejects an update that would create an exact duplicate', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 't1',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    data = addSettingTemplate(data, {
      id: 't2',
      name: 'Đuôi',
      coefficientD: '3',
      coefficientT: '5',
    })

    expect(() =>
      updateSettingTemplate(data, 't2', {
        name: 'Đầu',
        coefficientD: '2',
        coefficientT: '5',
      }),
    ).toThrowError(QuickSettingsError)
  })

  it('deletes only the selected template', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 't1',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    data = addSettingTemplate(data, {
      id: 't2',
      name: 'Đuôi',
      coefficientD: '3',
      coefficientT: '5',
    })

    data = deleteSettingTemplate(data, 't1')

    expect(data.settingTemplates.map((item) => item.id))
      .toEqual(['t2'])
  })

  it('reorders setting templates', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 't1',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    data = addSettingTemplate(data, {
      id: 't2',
      name: 'Đuôi',
      coefficientD: '3',
      coefficientT: '5',
    })

    data = addSettingTemplate(data, {
      id: 't3',
      name: 'Lô',
      coefficientD: '4',
      coefficientT: '5',
    })

    data = reorderSettingTemplate(data, 't3', 0)

    expect(data.settingTemplates.map((item) => item.name))
      .toEqual(['Lô', 'Đầu', 'Đuôi'])
  })

  it('does not allow IDs to collide with template IDs', () => {
    let data = createQuickSettingsData()

    data = addSettingTemplate(data, {
      id: 'same-id',
      name: 'Đầu',
      coefficientD: '2',
      coefficientT: '5',
    })

    expect(() =>
      addSettingNameSuggestion(data, 'same-id', 'Đầu'),
    ).toThrowError(QuickSettingsError)
  })
})
