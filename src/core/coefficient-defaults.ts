import type { CalculationDataV2, ListingCountKey, SettingTypeDefinition } from './models-v2'

/** Fill absent values only. Previously saved user settings are never overwritten. */
export function withCoefficientDefaults(type: SettingTypeDefinition): SettingTypeDefinition {
  const lo = ['la', 'lb'].includes(type.formulaId)
  const de = ['da', 'db'].includes(type.formulaId)
  const xien = ['xa', 'xb'].includes(type.formulaId)
  const d = lo ? '21,8' : de ? '0,74' : xien ? '0,65' : '1'
  const t = lo ? '80' : de ? '70' : '1'
  const fallback = (value: string | null | undefined, standard: string) => value == null || value.trim() === '' ? standard : value
  const keys: ListingCountKey[] = de ? ['2', '3'] : xien ? ['2', '3', '4'] : []
  return {
    ...type,
    defaultCoefficientD: fallback(type.defaultCoefficientD, d),
    defaultCoefficientT: fallback(type.defaultCoefficientT, t),
    ...(keys.length ? { defaultCoefficientsByCount: Object.fromEntries(keys.map(key => [key, {
      coefficientD: fallback(type.defaultCoefficientsByCount?.[key]?.coefficientD, de ? fallback(type.defaultCoefficientD, d) : d),
      coefficientT: fallback(type.defaultCoefficientsByCount?.[key]?.coefficientT, de ? (key === '3' ? '40000' : fallback(type.defaultCoefficientT, t)) : ({'2':'10','3':'35','4':'100','5':'1'}[key])),
    }])) } : {}),
  }
}
export function initializeCoefficientDefaults(data: CalculationDataV2): CalculationDataV2 {
  return { ...data, settingTypes: data.settingTypes.map(withCoefficientDefaults) }
}
