import { describe, expect, it } from 'vitest'
import { initializeCoefficientDefaults } from '../../src/core/coefficient-defaults'
import { defaultAppPreferences, validateAppPreferences } from '../../src/core/app-preferences'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { buildEntryPreview } from '../../src/core/entry-preview'

describe('formula-specific coefficient catalog', () => {
  it('initializes the requested defaults for each formula and profile', () => {
    for (const type of createCalculationDataV2().settingTypes) {
      if (['lb','la'].includes(type.formulaId)) expect([type.defaultCoefficientD,type.defaultCoefficientT]).toEqual(['21,8','80'])
      if (['da','db'].includes(type.formulaId)) expect(type.defaultCoefficientsByCount).toEqual({'2':{coefficientD:'0,74',coefficientT:'70'},'3':{coefficientD:'0,74',coefficientT:'40000'}})
      if (['xa','xb'].includes(type.formulaId)) expect(type.defaultCoefficientsByCount).toEqual({'2':{coefficientD:'0,65',coefficientT:'10'},'3':{coefficientD:'0,65',coefficientT:'35'},'4':{coefficientD:'0,65',coefficientT:'100'}})
    }
  })
  it('fills old missing coefficients without changing edited or zero coefficients', () => {
    const data = createCalculationDataV2()
    data.settingTypes[0].defaultCoefficientD = null
    data.settingTypes[0].defaultCoefficientT = '0'
    const da = data.settingTypes.find((type) => type.formulaId === 'da')!
    da.defaultCoefficientD = '2.5'; da.defaultCoefficientT = '3'
    da.defaultCoefficientsByCount = { '2': { coefficientD: '7', coefficientT: '0' } }
    const result = initializeCoefficientDefaults(data)
    expect(result.settingTypes[0].defaultCoefficientD).toBe('21,8')
    expect(result.settingTypes[0].defaultCoefficientT).toBe('0')
    expect(result.settingTypes.find((type) => type.formulaId === 'da')?.defaultCoefficientsByCount).toEqual({
      '2': { coefficientD: '7', coefficientT: '0' }, '3': { coefficientD: '2.5', coefficientT: '40000' },
    })
    expect(data.settingTypes[0].defaultCoefficientD).toBeNull()
  })
  it('resets only the old five-attempt counter when migrating to the new policy', () => {
    const legacy = { ...defaultAppPreferences(), failurePolicyVersion: undefined, failedAttempts: 5, blockedUntil: 999999 }
    const result = validateAppPreferences(legacy)
    expect(result.failedAttempts).toBe(0)
    expect(result.blockedUntil).toBe(0)
    expect(result.wipePending).toBe(false)
    expect(result.failurePolicyVersion).toBe(2)
  })
})

describe('unfinished entry preview', () => {
  it('shows a draft on the A4 projection without modifying the source tree', () => {
    const data = createCalculationDataV2()
    data.groups1.push({ kind: 'group1', id: 'a4', dateLabel: '14/11/2026', drawData: { oneToSeven: [], gdb: '' }, groups2: [{ kind: 'group2', id: 'group', name: 'Lan', groups3: [] }] })
    const target = { mode: 'draft' as const, group1Id: 'a4', group2Id: 'group', typeId: 'setting-type-1', rowId: 'draft' }
    const preview = buildEntryPreview(data, target, { listing: '01, 02', point: '' })
    expect(preview.groups1[0].groups2[0].groups3[0].listing).toBe('01, 02')
    expect(data.groups1[0].groups2[0].groups3).toEqual([])
    expect(buildEntryPreview(data, target, { listing: '', point: '' }).groups1[0].groups2[0].groups3).toEqual([])
  })
})
