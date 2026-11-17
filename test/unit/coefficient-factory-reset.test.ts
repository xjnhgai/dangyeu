import { describe, expect, it } from 'vitest'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { factoryCoefficientValues, resetSettingTypeToFactory } from '../../src/core/coefficient-defaults'
import { coefficientTypesForName } from '../../src/core/coefficient-settings'

describe('factory coefficients, catalog reset, independent name rates', () => {
  it('uses 400, not 40000, for 3-digit ĐA/ĐB factory Trúng', () => {
    for (const formula of ['da', 'db']) {
      const type = createCalculationDataV2().settingTypes.find(type => type.formulaId === formula)!
      expect(type.defaultCoefficientsByCount?.['3']).toEqual({ coefficientD: '0,74', coefficientT: '400' })
    }
  })
  it('resets only one shared type, preserving IDs, aliases and saved name profiles', () => {
    const data = createCalculationDataV2()
    const da = data.settingTypes.find(type => type.formulaId === 'da')!
    da.name = 'Tên đã đổi'; da.allAliases = 'alias&other'
    da.defaultCoefficientD = '9'
    da.defaultCoefficientT = '5'
    da.defaultCoefficientsByCount!['2'] = { coefficientD: '8', coefficientT: '7' }
    da.defaultCoefficientsByCount!['3'] = { coefficientD: '6', coefficientT: '123' }
    const stored = { ...da, defaultCoefficientD: '3', defaultCoefficientT: '4', defaultCoefficientsByCount: { '2': { coefficientD: '5', coefficientT: '6' } } }
    data.nameCoefficientTypes = { lan: [structuredClone(stored)] }
    const originalPrivate = structuredClone(data.nameCoefficientTypes)
    const reset = resetSettingTypeToFactory(da)
    expect(reset.id).toBe(da.id)
    expect(reset.name).toBe('ĐA')
    expect(reset.allAliases).toBe('alias&other')
    expect(reset.defaultCoefficientD).toBe('0,74')
    expect(reset.defaultCoefficientT).toBe('70')
    expect(reset.defaultCoefficientsByCount).toEqual({
      '2': { coefficientD: '0,74', coefficientT: '70' },
      '3': { coefficientD: '0,74', coefficientT: '400' },
    })
    expect(data.nameCoefficientTypes).toEqual(originalPrivate)
  })
  it('initializes an unsaved name from factory instead of recently edited shared coefficients', () => {
    const data = createCalculationDataV2()
    data.settingTypes.find(type => type.formulaId === 'lb')!.defaultCoefficientD = '999'
    data.settingTypes.find(type => type.formulaId === 'lb')!.defaultCoefficientT = '888'
    const fresh = coefficientTypesForName(data, 'Tên mới')
    expect(fresh.find(type => type.formulaId === 'lb')).toMatchObject({ defaultCoefficientD: '21,8', defaultCoefficientT: '80' })
    expect(data.settingTypes[0]).toMatchObject({ defaultCoefficientD: '999', defaultCoefficientT: '888' })
    expect(factoryCoefficientValues(data.settingTypes[0]).name).toBe(data.settingTypes[0].name)
  })
  it('retains previously saved per-name values even when common values are reset', () => {
    const data = createCalculationDataV2()
    const existing = structuredClone(data.settingTypes[0])
    existing.defaultCoefficientD = '2'; existing.defaultCoefficientT = '3'
    data.nameCoefficientTypes = { lan: [existing] }
    data.settingTypes[0] = resetSettingTypeToFactory({ ...data.settingTypes[0], defaultCoefficientD: '99' })
    expect(coefficientTypesForName(data, 'Lan')[0]).toMatchObject({ defaultCoefficientD: '2', defaultCoefficientT: '3' })
    expect(coefficientTypesForName(data, 'Mới')[0]).toMatchObject({ defaultCoefficientD: '21,8', defaultCoefficientT: '80' })
  })
})
