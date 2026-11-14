import type {
  CalculationDataV2,
  CoefficientPairText,
  DrawData,
  EntityId,
  Group1,
  Group2,
  Group3,
  NumericText,
  ListingCountKey,
  SettingTypeDefinition,
} from './models-v2'
import { withCoefficientDefaults } from './coefficient-defaults'

export class TreeV2Error extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'TreeV2Error'
    this.code = code
  }
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim().normalize('NFC')
  if (!normalized) {
    throw new TreeV2Error('EMPTY_VALUE', `${label} không được để trống.`)
  }
  return normalized
}

function nameKey(value: string): string {
  return value.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
}

function normalizeDefault(value: NumericText | null | undefined): NumericText | null {
  return value == null || value.trim() === '' ? null : value.trim()
}

function allIds(data: CalculationDataV2): Set<EntityId> {
  const ids = new Set<EntityId>()
  const add = (id: EntityId) => {
    if (!id.trim() || ids.has(id)) {
      throw new TreeV2Error('DUPLICATE_ID', `ID không hợp lệ hoặc bị trùng: ${id}`)
    }
    ids.add(id)
  }

  data.settingTypes.forEach((type) => add(type.id))
  data.groups1.forEach((group1) => {
    add(group1.id)
    group1.groups2.forEach((group2) => {
      add(group2.id)
      group2.groups3.forEach((group3) => add(group3.id))
    })
  })
  return ids
}

function assertNewIdsAvailable(data: CalculationDataV2, idsToAdd: EntityId[]): void {
  const used = allIds(data)
  for (const id of idsToAdd) {
    if (!id.trim() || used.has(id)) {
      throw new TreeV2Error('DUPLICATE_ID', `ID không hợp lệ hoặc bị trùng: ${id}`)
    }
    used.add(id)
  }
}

function collectGroup3Ids(group3: Group3): EntityId[] {
  return [group3.id]
}

function collectGroup2Ids(group2: Group2): EntityId[] {
  return [group2.id, ...group2.groups3.flatMap(collectGroup3Ids)]
}

function collectGroup1Ids(group1: Group1): EntityId[] {
  return [group1.id, ...group1.groups2.flatMap(collectGroup2Ids)]
}

function assertTypeExists(data: CalculationDataV2, typeId: EntityId): void {
  if (!data.settingTypes.some((type) => type.id === typeId)) {
    throw new TreeV2Error('TYPE_NOT_FOUND', `Không tìm thấy loại thiết lập: ${typeId}`)
  }
}

function assertTypeReferences(data: CalculationDataV2, groups3: Group3[]): void {
  groups3.forEach((group3) => assertTypeExists(data, group3.settingTypeId))
}

function assertUniqueGroup2Names(groups2: Group2[]): void {
  const names = new Set<string>()
  for (const group2 of groups2) {
    const key = nameKey(requiredText(group2.name, 'Tên nhóm'))
    if (names.has(key)) {
      throw new TreeV2Error('DUPLICATE_GROUP_NAME', 'Tên nhóm đã tồn tại trong ngày này.')
    }
    names.add(key)
  }
}

function updateGroup1(
  data: CalculationDataV2,
  group1Id: EntityId,
  updater: (group1: Group1) => Group1,
): CalculationDataV2 {
  const index = data.groups1.findIndex((item) => item.id === group1Id)
  if (index < 0) throw new TreeV2Error('GROUP1_NOT_FOUND', 'Không tìm thấy ngày được chọn.')
  const groups1 = [...data.groups1]
  groups1[index] = updater(groups1[index])
  return { ...data, groups1 }
}

function updateGroup2(
  data: CalculationDataV2,
  group1Id: EntityId,
  group2Id: EntityId,
  updater: (group2: Group2) => Group2,
): CalculationDataV2 {
  return updateGroup1(data, group1Id, (group1) => {
    const index = group1.groups2.findIndex((item) => item.id === group2Id)
    if (index < 0) throw new TreeV2Error('GROUP2_NOT_FOUND', 'Không tìm thấy nhóm được chọn.')
    const groups2 = [...group1.groups2]
    groups2[index] = updater(groups2[index])
    return { ...group1, groups2 }
  })
}

export function createCalculationDataV2(
  initialTypeId: EntityId = 'setting-type-1',
): CalculationDataV2 {
  if (!initialTypeId.trim()) throw new TreeV2Error('INVALID_ID', 'ID loại thiết lập không hợp lệ.')
  const extraIds = ['setting-type-2', 'setting-type-3', 'setting-type-4', 'setting-type-5', 'setting-type-6', 'setting-type-7', 'setting-type-8']
  if (extraIds.includes(initialTypeId)) {
    throw new TreeV2Error('DUPLICATE_ID', 'ID loại thiết lập ban đầu bị trùng với catalog mặc định.')
  }
  const ids = [initialTypeId, ...extraIds]
  const definitions = [
    ['lb', 'LB'], ['la', 'LA'], ['da', 'ĐA'], ['db', 'ĐB'],
    ['ca', 'CA'], ['cb', 'CB'], ['xa', 'XA'], ['xb', 'XB'],
  ] as const
  return {
    schemaVersion: 2,
    settingTypes: definitions.map(([formulaId, name], index) => withCoefficientDefaults({
      id: ids[index]!, formulaId, name, defaultCoefficientD: null, defaultCoefficientT: null,
      ...(['da', 'db', 'xa', 'xb'].includes(formulaId) ? { defaultCoefficientsByCount: {} } : {}),
    })),
    groups1: [],
  }
}

/* Global setting type catalog. */
export function addSettingType(data: CalculationDataV2, type: SettingTypeDefinition): CalculationDataV2 {
  assertNewIdsAvailable(data, [type.id])
  const name = requiredText(type.name, 'Tên loại thiết lập')
  if (data.settingTypes.some((item) => nameKey(item.name) === nameKey(name))) {
    throw new TreeV2Error('DUPLICATE_TYPE_NAME', 'Tên loại thiết lập đã tồn tại.')
  }
  return {
    ...data,
    settingTypes: [...data.settingTypes, {
      ...type,
      name,
      defaultCoefficientD: normalizeDefault(type.defaultCoefficientD),
      defaultCoefficientT: normalizeDefault(type.defaultCoefficientT),
    }],
  }
}

export function renameSettingType(data: CalculationDataV2, typeId: EntityId, newName: string): CalculationDataV2 {
  const index = data.settingTypes.findIndex((item) => item.id === typeId)
  if (index < 0) throw new TreeV2Error('TYPE_NOT_FOUND', 'Không tìm thấy loại thiết lập.')
  const name = requiredText(newName, 'Tên loại thiết lập')
  if (data.settingTypes.some((item) => item.id !== typeId && nameKey(item.name) === nameKey(name))) {
    throw new TreeV2Error('DUPLICATE_TYPE_NAME', 'Tên loại thiết lập đã tồn tại.')
  }
  const settingTypes = [...data.settingTypes]
  settingTypes[index] = { ...settingTypes[index], name }
  return { ...data, settingTypes }
}

export function updateSettingTypeDefaults(
  data: CalculationDataV2,
  typeId: EntityId,
  defaults: {
    coefficientD?: NumericText | null
    coefficientT?: NumericText | null
    coefficientsByCount?: Partial<Record<ListingCountKey, CoefficientPairText>>
  },
): CalculationDataV2 {
  const index = data.settingTypes.findIndex((item) => item.id === typeId)
  if (index < 0) throw new TreeV2Error('TYPE_NOT_FOUND', 'Không tìm thấy loại thiết lập.')
  const settingTypes = [...data.settingTypes]
  const current = settingTypes[index]
  settingTypes[index] = {
    ...current,
    defaultCoefficientD: defaults.coefficientD === undefined ? current.defaultCoefficientD : normalizeDefault(defaults.coefficientD),
    defaultCoefficientT: defaults.coefficientT === undefined ? current.defaultCoefficientT : normalizeDefault(defaults.coefficientT),
    ...(defaults.coefficientsByCount !== undefined ? { defaultCoefficientsByCount: structuredClone(defaults.coefficientsByCount) } : {}),
  }
  return { ...data, settingTypes }
}

export function reorderSettingType(data: CalculationDataV2, typeId: EntityId, newIndex: number): CalculationDataV2 {
  const oldIndex = data.settingTypes.findIndex((item) => item.id === typeId)
  if (oldIndex < 0) throw new TreeV2Error('TYPE_NOT_FOUND', 'Không tìm thấy loại thiết lập.')
  if (!Number.isInteger(newIndex) || newIndex < 0 || newIndex >= data.settingTypes.length) {
    throw new TreeV2Error('INVALID_INDEX', 'Vị trí mới không hợp lệ.')
  }
  const settingTypes = [...data.settingTypes]
  const [item] = settingTypes.splice(oldIndex, 1)
  settingTypes.splice(newIndex, 0, item)
  return { ...data, settingTypes }
}

export function deleteSettingType(data: CalculationDataV2, typeId: EntityId): CalculationDataV2 {
  if (!data.settingTypes.some((item) => item.id === typeId)) {
    throw new TreeV2Error('TYPE_NOT_FOUND', 'Không tìm thấy loại thiết lập.')
  }
  const inUse = data.groups1.some((g1) => g1.groups2.some((g2) => g2.groups3.some((g3) => g3.settingTypeId === typeId)))
  if (inUse) throw new TreeV2Error('TYPE_IN_USE', 'Không thể xóa loại thiết lập đang được sử dụng.')
  return { ...data, settingTypes: data.settingTypes.filter((item) => item.id !== typeId) }
}

/* Group1: date. */
export function addGroup1V2(data: CalculationDataV2, group1: Group1): CalculationDataV2 {
  const next = structuredClone(group1)
  assertNewIdsAvailable(data, collectGroup1Ids(next))
  assertTypeReferences(data, next.groups2.flatMap((group2) => group2.groups3))
  assertUniqueGroup2Names(next.groups2)
  return { ...data, groups1: [...data.groups1, next] }
}

/** Delete one complete A4 record (Group1 and all nested Group2/Group3 data). */
export function deleteGroup1V2(data: CalculationDataV2, group1Id: EntityId): CalculationDataV2 {
  if (!data.groups1.some((item) => item.id === group1Id)) {
    throw new TreeV2Error('GROUP1_NOT_FOUND', 'Không tìm thấy A4 cần xóa.')
  }
  return { ...data, groups1: data.groups1.filter((item) => item.id !== group1Id) }
}

export function updateGroup1DrawDataV2(
  data: CalculationDataV2,
  group1Id: EntityId,
  drawData: DrawData,
): CalculationDataV2 {
  if (drawData.oneToSeven.length > 26) throw new TreeV2Error('INVALID_DRAW_DATA', 'Dữ liệu 1-7 không được vượt quá 26 số.')
  return updateGroup1(data, group1Id, (group1) => ({
    ...group1,
    drawData: { oneToSeven: [...drawData.oneToSeven], gdb: drawData.gdb },
  }))
}

/* Group2: named group. */
export function addGroup2V2(data: CalculationDataV2, group1Id: EntityId, group2: Group2): CalculationDataV2 {
  const next = structuredClone(group2)
  assertNewIdsAvailable(data, collectGroup2Ids(next))
  assertTypeReferences(data, next.groups3)
  const name = requiredText(next.name, 'Tên nhóm')
  return updateGroup1(data, group1Id, (group1) => {
    if (group1.groups2.some((item) => nameKey(item.name) === nameKey(name))) {
      throw new TreeV2Error('DUPLICATE_GROUP_NAME', 'Tên nhóm đã tồn tại trong ngày này.')
    }
    return { ...group1, groups2: [...group1.groups2, { ...next, name }] }
  })
}

export function renameGroup2V2(
  data: CalculationDataV2,
  group1Id: EntityId,
  group2Id: EntityId,
  newName: string,
): CalculationDataV2 {
  const name = requiredText(newName, 'Tên nhóm')
  return updateGroup1(data, group1Id, (group1) => {
    if (group1.groups2.some((item) => item.id !== group2Id && nameKey(item.name) === nameKey(name))) {
      throw new TreeV2Error('DUPLICATE_GROUP_NAME', 'Tên nhóm đã tồn tại trong ngày này.')
    }
    const exists = group1.groups2.some((item) => item.id === group2Id)
    if (!exists) throw new TreeV2Error('GROUP2_NOT_FOUND', 'Không tìm thấy nhóm được chọn.')
    return { ...group1, groups2: group1.groups2.map((item) => item.id === group2Id ? { ...item, name } : item) }
  })
}

/** Reorder named Group2 chips without changing their IDs or contained entries. */
export function reorderGroup2V2(
  data: CalculationDataV2,
  group1Id: EntityId,
  group2Id: EntityId,
  newIndex: number,
): CalculationDataV2 {
  return updateGroup1(data, group1Id, (group1) => {
    const oldIndex = group1.groups2.findIndex((item) => item.id === group2Id)
    if (oldIndex < 0) throw new TreeV2Error('GROUP2_NOT_FOUND', 'Không tìm thấy nhóm được chọn.')
    if (!Number.isInteger(newIndex) || newIndex < 0 || newIndex >= group1.groups2.length) {
      throw new TreeV2Error('INVALID_INDEX', 'Vị trí mới không hợp lệ.')
    }
    const groups2 = [...group1.groups2]
    const [item] = groups2.splice(oldIndex, 1)
    groups2.splice(newIndex, 0, item!)
    return { ...group1, groups2 }
  })
}

export function deleteGroup2V2(data: CalculationDataV2, group1Id: EntityId, group2Id: EntityId): CalculationDataV2 {
  return updateGroup1(data, group1Id, (group1) => {
    if (!group1.groups2.some((item) => item.id === group2Id)) {
      throw new TreeV2Error('GROUP2_NOT_FOUND', 'Không tìm thấy nhóm cần xóa.')
    }
    return { ...group1, groups2: group1.groups2.filter((item) => item.id !== group2Id) }
  })
}

/* Group3: one real setting entry (not a parent containing instances). */
export function createGroup3FromDefaults(
  type: SettingTypeDefinition,
  id: EntityId,
  listing = '',
  point = '',
): Group3 {
  return {
    kind: 'group3',
    id,
    settingTypeId: type.id,
    listing,
    point,
    coefficientD: type.defaultCoefficientD ?? '',
    coefficientT: type.defaultCoefficientT ?? '',
    ...(['da', 'db', 'xa', 'xb'].includes(type.formulaId)
      ? {
          coefficientsByCount: Object.fromEntries(
            Object.entries(type.defaultCoefficientsByCount ?? {}).map(([key, pair]) => [key, {
              coefficientD: pair?.coefficientD ?? '',
              coefficientT: pair?.coefficientT ?? '',
            }]),
          ) as Partial<Record<ListingCountKey, { coefficientD: NumericText; coefficientT: NumericText }>>,
        }
      : {}),
  }
}

export function addGroup3V2(data: CalculationDataV2, group1Id: EntityId, group2Id: EntityId, group3: Group3): CalculationDataV2 {
  const next = structuredClone(group3)
  assertNewIdsAvailable(data, collectGroup3Ids(next))
  assertTypeExists(data, next.settingTypeId)
  const updated = updateGroup2(data, group1Id, group2Id, (group2) => ({
    ...group2,
    groups3: [...group2.groups3, next],
  }))
  const typeIndex = updated.settingTypes.findIndex((item) => item.id === next.settingTypeId)
  const settingTypes = [...updated.settingTypes]
  const current = settingTypes[typeIndex]
  const coefficientD = normalizeDefault(next.coefficientD)
  const coefficientT = normalizeDefault(next.coefficientT)
  settingTypes[typeIndex] = {
    ...current,
    defaultCoefficientD: coefficientD ?? current.defaultCoefficientD,
    defaultCoefficientT: coefficientT ?? current.defaultCoefficientT,
    ...(['da', 'db', 'xa', 'xb'].includes(current.formulaId)
      ? {
          defaultCoefficientsByCount: {
            ...(current.defaultCoefficientsByCount ?? {}),
            ...Object.fromEntries(Object.entries(next.coefficientsByCount ?? {}).map(([key, pair]) => [key, {
              coefficientD: normalizeDefault(pair.coefficientD),
              coefficientT: normalizeDefault(pair.coefficientT),
            }])),
          },
        }
      : {}),
  }
  return { ...updated, settingTypes }
}

export function updateGroup3V2(
  data: CalculationDataV2,
  group1Id: EntityId,
  group2Id: EntityId,
  group3Id: EntityId,
  patch: Partial<Pick<Group3, 'listing' | 'point' | 'coefficientD' | 'coefficientT'>>,
): CalculationDataV2 {
  return updateGroup2(data, group1Id, group2Id, (group2) => {
    const index = group2.groups3.findIndex((item) => item.id === group3Id)
    if (index < 0) throw new TreeV2Error('GROUP3_NOT_FOUND', 'Không tìm thấy thiết lập được chọn.')
    const groups3 = [...group2.groups3]
    const current = groups3[index]
    // All entered values of a saved Group3 remain editable.
    groups3[index] = {
      ...current,
      ...(patch.listing !== undefined ? { listing: patch.listing } : {}),
      ...(patch.point !== undefined ? { point: patch.point } : {}),
      ...(patch.coefficientD !== undefined ? { coefficientD: patch.coefficientD } : {}),
      ...(patch.coefficientT !== undefined ? { coefficientT: patch.coefficientT } : {}),
    }
    return { ...group2, groups3 }
  })
}

export function deleteGroup3V2(data: CalculationDataV2, group1Id: EntityId, group2Id: EntityId, group3Id: EntityId): CalculationDataV2 {
  return updateGroup2(data, group1Id, group2Id, (group2) => {
    if (!group2.groups3.some((item) => item.id === group3Id)) {
      throw new TreeV2Error('GROUP3_NOT_FOUND', 'Không tìm thấy thiết lập cần xóa.')
    }
    return { ...group2, groups3: group2.groups3.filter((item) => item.id !== group3Id) }
  })
}
