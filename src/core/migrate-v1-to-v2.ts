import type {
  CalculationDataV1,
  CalculationDataV2,
  Group1,
  Group2,
  Group3,
  SettingTypeDefinition,
} from './models-v2'

/**
 * V1 -> V2 migration.
 * Every legacy Setting becomes one direct Group3 record.
 * Equal legacy names are not merged because V1 does not identify formula types.
 */
export function migrateCalculationDataV1ToV2(legacy: CalculationDataV1): CalculationDataV2 {
  if (legacy.schemaVersion !== 1 || !Array.isArray(legacy.groups1)) {
    throw new TypeError('Calculation Data phiên bản 1 không hợp lệ.')
  }

  const settingTypes: SettingTypeDefinition[] = []
  const groups1: Group1[] = legacy.groups1.map((oldGroup1) => {
    if (!Array.isArray(oldGroup1.groups2) || !Array.isArray(oldGroup1.drawData?.oneToSeven)) {
      throw new TypeError(`Dữ liệu ngày ${oldGroup1.id} không hợp lệ.`)
    }

    const groups2: Group2[] = oldGroup1.groups2.map((oldGroup2) => {
      if (!Array.isArray(oldGroup2.settings)) {
        throw new TypeError(`Dữ liệu nhóm ${oldGroup2.id} không hợp lệ.`)
      }
      const groups3: Group3[] = oldGroup2.settings.map((oldSetting) => {
        const typeId = `migrated-type-${oldSetting.id}`
        settingTypes.push({
          id: typeId,
          formulaId: 'lb',
          name: oldSetting.name,
          defaultCoefficientD: null,
          defaultCoefficientT: null,
        })
        return {
          kind: 'group3',
          id: oldSetting.id,
          settingTypeId: typeId,
          listing: oldSetting.listing,
          point: oldSetting.point,
          coefficientD: oldSetting.coefficientD,
          coefficientT: oldSetting.coefficientT,
        }
      })
      return { kind: 'group2', id: oldGroup2.id, name: oldGroup2.name, groups3 }
    })

    return {
      kind: 'group1',
      id: oldGroup1.id,
      dateLabel: oldGroup1.dateLabel,
      drawData: { oneToSeven: [...oldGroup1.drawData.oneToSeven], gdb: oldGroup1.drawData.gdb },
      groups2,
    }
  })

  return { schemaVersion: 2, settingTypes, groups1 }
}
