import { describe, expect, it } from 'vitest'
import { withCoefficientDefaults } from '../../src/core/coefficient-defaults'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { getCoefficientProfileKey, getCoefficientProfileKeys } from '../../src/core/workspace-calculator-v2'
import { parseAll } from '../../src/core/all-input'

describe('XA/XB profiles: only two, three, or four numbers', () => {
  it.each(['xa', 'xb'] as const)('has no five-number profile for %s', formula => {
    const type = createCalculationDataV2().settingTypes.find(type => type.formulaId === formula)!
    expect(getCoefficientProfileKeys(formula)).toEqual(['2', '3', '4'])
    expect(Object.keys(type.defaultCoefficientsByCount ?? {})).toEqual(['2', '3', '4'])
    expect(getCoefficientProfileKey(formula, ['01', '02', '03', '04', '05'])).toBeNull()
    expect(type.defaultCoefficientsByCount).toEqual({
      '2': { coefficientD: '0,65', coefficientT: '10' },
      '3': { coefficientD: '0,65', coefficientT: '35' },
      '4': { coefficientD: '0,65', coefficientT: '100' },
    })
  })

  it.each(['xa', 'xb'] as const)('discards obsolete five-number settings without changing other saved settings for %s', formula => {
    const type = createCalculationDataV2().settingTypes.find(type => type.formulaId === formula)!
    const legacy = {
      ...type,
      defaultCoefficientsByCount: {
        ...type.defaultCoefficientsByCount,
        '2': { coefficientD: '2,5', coefficientT: '9' },
        '5': { coefficientD: '888', coefficientT: '999' },
      },
    }
    const actual = withCoefficientDefaults(legacy)
    expect(Object.keys(actual.defaultCoefficientsByCount ?? {})).toEqual(['2', '3', '4'])
    expect(actual.defaultCoefficientsByCount?.['2']).toEqual({ coefficientD: '2,5', coefficientT: '9' })
    expect(actual.defaultCoefficientsByCount?.['4']).toEqual(type.defaultCoefficientsByCount?.['4'])
  })

  it('still accepts four xiên numbers and rejects five without adding result rows', () => {
    const types = createCalculationDataV2().settingTypes
    expect(parseAll('xiên 11.22.33.44.10n', types)).toHaveLength(1)
    expect(() => parseAll('xiên 11.22.33.44.55.10n', types)).toThrow()
  })
})
