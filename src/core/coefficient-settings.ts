import type { CalculationDataV2, SettingTypeDefinition } from './models-v2'

export function coefficientNameKey(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
}

/** Saved name settings own coefficients only; formula/name/aliases always come from the catalog. */
export function coefficientTypesForName(data: CalculationDataV2, name: string): SettingTypeDefinition[] {
  const key = coefficientNameKey(name)
  const saved = data.nameCoefficientTypes && Object.hasOwn(data.nameCoefficientTypes, key)
    ? data.nameCoefficientTypes[key] : undefined
  return data.settingTypes.map(type => {
    const own = saved?.find(item => item.id === type.id)
    return own ? {
      ...type,
      defaultCoefficientD: own.defaultCoefficientD,
      defaultCoefficientT: own.defaultCoefficientT,
      defaultCoefficientsByCount: own.defaultCoefficientsByCount,
    } : type
  })
}
