import type { CalculationDataV2, ListingCountKey, SettingTypeDefinition } from './models-v2'

/** Fill only absent values; preserve every edited coefficient, including zero. */
export function withCoefficientDefaults(type: SettingTypeDefinition): SettingTypeDefinition {
  const fallback = (value: string | null | undefined) => value == null || value.trim() === '' ? '1' : value
  const profileFallback = (value: string | null | undefined, scalar: string | null) => value == null || value.trim() === ''
    ? fallback(['da', 'db'].includes(type.formulaId) ? scalar : null) : value
  const keys: ListingCountKey[] = ['da', 'db'].includes(type.formulaId) ? ['2', '3'] : ['xa', 'xb'].includes(type.formulaId) ? ['2', '3', '4', '5'] : []
  return {
    ...type,
    defaultCoefficientD: fallback(type.defaultCoefficientD),
    defaultCoefficientT: fallback(type.defaultCoefficientT),
    ...(keys.length ? { defaultCoefficientsByCount: Object.fromEntries(keys.map((key) => [key, {
      coefficientD: profileFallback(type.defaultCoefficientsByCount?.[key]?.coefficientD, type.defaultCoefficientD),
      coefficientT: profileFallback(type.defaultCoefficientsByCount?.[key]?.coefficientT, type.defaultCoefficientT),
    }])) } : {}),
  }
}

export function initializeCoefficientDefaults(data: CalculationDataV2): CalculationDataV2 {
  return { ...data, settingTypes: data.settingTypes.map(withCoefficientDefaults) }
}
