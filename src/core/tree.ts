
import type {
  CalculationData,
  DrawData,
  EntityId,
  Group1,
  Group2,
  Setting,
} from './models'

// ============================================================
// 1. OPERATION ERRORS
// ============================================================

export type TreeOperationErrorCode =
  | 'INVALID_ID'
  | 'INVALID_DATE'
  | 'INVALID_GROUP_NAME'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_GROUP_NAME'
  | 'GROUP1_NOT_FOUND'
  | 'GROUP2_NOT_FOUND'
  | 'SETTING_NOT_FOUND'
  | 'INVALID_INDEX'

export class TreeOperationError extends Error {
  readonly code: TreeOperationErrorCode

  constructor(
    code: TreeOperationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TreeOperationError'
    this.code = code
  }
}

// ============================================================
// 2. BASIC VALIDATION
// ============================================================

function validateId(id: EntityId): void {
  if (!id.trim()) {
    throw new TreeOperationError(
      'INVALID_ID',
      'ID không được để trống.',
    )
  }
}

function cleanDateLabel(dateLabel: string): string {
  const cleaned = dateLabel.trim()

  if (!cleaned) {
    throw new TreeOperationError(
      'INVALID_DATE',
      'Tên hoặc ngày của nhóm cấp 1 không được để trống.',
    )
  }

  return cleaned
}

function cleanGroup2Name(name: string): string {
  const cleaned = name.trim().normalize('NFC')

  if (!cleaned) {
    throw new TreeOperationError(
      'INVALID_GROUP_NAME',
      'Tên nhóm cấp 2 không được để trống.',
    )
  }

  return cleaned
}

/**
 * Chuẩn hóa tên nhóm cấp 2 để kiểm tra trùng.
 *
 * - Bỏ khoảng trắng đầu và cuối.
 * - Chuẩn hóa Unicode NFC.
 * - Không phân biệt chữ hoa và chữ thường.
 *
 * Chỉ áp dụng cho nhóm cấp 2 trong cùng một nhóm ngày.
 */
function group2NameKey(name: string): string {
  return cleanGroup2Name(name).toLocaleLowerCase('vi-VN')
}

// ============================================================
// 3. FACTORIES
// ============================================================

export function createCalculationData(): CalculationData {
  return {
    schemaVersion: 1,
    groups1: [],
  }
}

export function createGroup1(
  id: EntityId,
  dateLabel: string,
): Group1 {
  validateId(id)

  return {
    kind: 'group1',
    id,
    dateLabel: cleanDateLabel(dateLabel),
    drawData: {
      oneToSeven: [],
      gdb: '',
    },
    groups2: [],
  }
}

export function createGroup2(
  id: EntityId,
  name: string,
): Group2 {
  validateId(id)

  return {
    kind: 'group2',
    id,
    name: cleanGroup2Name(name),
    isVisibleOnA4: true,
    settings: [],
  }
}

export function createSetting(
  id: EntityId,
  name = '',
): Setting {
  validateId(id)

  return {
    kind: 'setting',
    id,
    name,
    listing: '',
    point: '',
    coefficientD: '',
    coefficientT: '',
  }
}

// ============================================================
// 4. ID VALIDATION ACROSS CALCULATION DATA
// ============================================================

function registerId(
  ids: Set<EntityId>,
  id: EntityId,
): void {
  validateId(id)

  if (ids.has(id)) {
    throw new TreeOperationError(
      'DUPLICATE_ID',
      `ID "${id}" đã tồn tại trong Calculation Data.`,
    )
  }

  ids.add(id)
}

function collectSettingIds(
  setting: Setting,
  ids: Set<EntityId>,
): void {
  if (setting.kind !== 'setting') {
    throw new TypeError('Phần tử cấp 3 phải là thiết lập.')
  }

  registerId(ids, setting.id)
}

function collectGroup2Ids(
  group2: Group2,
  ids: Set<EntityId>,
): void {
  if (group2.kind !== 'group2') {
    throw new TypeError('Phần tử cấp 2 không hợp lệ.')
  }

  registerId(ids, group2.id)

  for (const setting of group2.settings) {
    collectSettingIds(setting, ids)
  }
}

function collectGroup1Ids(
  group1: Group1,
  ids: Set<EntityId>,
): void {
  if (group1.kind !== 'group1') {
    throw new TypeError('Phần tử cấp 1 không hợp lệ.')
  }

  registerId(ids, group1.id)

  for (const group2 of group1.groups2) {
    collectGroup2Ids(group2, ids)
  }
}

function collectAllIds(
  data: CalculationData,
): Set<EntityId> {
  const ids = new Set<EntityId>()

  for (const group1 of data.groups1) {
    collectGroup1Ids(group1, ids)
  }

  return ids
}

function assertNewGroup1IdsAvailable(
  data: CalculationData,
  newGroup1: Group1,
): void {
  const existingIds = collectAllIds(data)
  const newIds = new Set<EntityId>()

  collectGroup1Ids(newGroup1, newIds)

  for (const id of newIds) {
    if (existingIds.has(id)) {
      throw new TreeOperationError(
        'DUPLICATE_ID',
        `ID "${id}" đã tồn tại trong Calculation Data.`,
      )
    }
  }
}

function assertNewGroup2IdsAvailable(
  data: CalculationData,
  newGroup2: Group2,
): void {
  const existingIds = collectAllIds(data)
  const newIds = new Set<EntityId>()

  collectGroup2Ids(newGroup2, newIds)

  for (const id of newIds) {
    if (existingIds.has(id)) {
      throw new TreeOperationError(
        'DUPLICATE_ID',
        `ID "${id}" đã tồn tại trong Calculation Data.`,
      )
    }
  }
}

function assertNewSettingIdAvailable(
  data: CalculationData,
  setting: Setting,
): void {
  const existingIds = collectAllIds(data)
  const newIds = new Set<EntityId>()

  collectSettingIds(setting, newIds)

  for (const id of newIds) {
    if (existingIds.has(id)) {
      throw new TreeOperationError(
        'DUPLICATE_ID',
        `ID "${id}" đã tồn tại trong Calculation Data.`,
      )
    }
  }
}

// ============================================================
// 5. GROUP 2 NAME VALIDATION
// ============================================================

function assertGroup2NameAvailable(
  groups: readonly Group2[],
  name: string,
  excludedGroupId?: EntityId,
): void {
  const targetKey = group2NameKey(name)

  const duplicate = groups.some((group) => {
    if (group.id === excludedGroupId) {
      return false
    }

    return group2NameKey(group.name) === targetKey
  })

  if (duplicate) {
    throw new TreeOperationError(
      'DUPLICATE_GROUP_NAME',
      'Tên nhóm cấp 2 đã tồn tại trong cùng nhóm ngày.',
    )
  }
}

// ============================================================
// 6. IMMUTABLE UPDATE HELPERS
// ============================================================

function updateGroup1ById(
  data: CalculationData,
  group1Id: EntityId,
  update: (group1: Group1) => Group1,
): CalculationData {
  const index = data.groups1.findIndex(
    (group1) => group1.id === group1Id,
  )

  if (index === -1) {
    throw new TreeOperationError(
      'GROUP1_NOT_FOUND',
      `Không tìm thấy nhóm ngày "${group1Id}".`,
    )
  }

  const nextGroups = [...data.groups1]
  nextGroups[index] = update(data.groups1[index])

  return {
    ...data,
    groups1: nextGroups,
  }
}

function updateGroup2ById(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  update: (group2: Group2, parent: Group1) => Group2,
): CalculationData {
  return updateGroup1ById(data, group1Id, (group1) => {
    const index = group1.groups2.findIndex(
      (group2) => group2.id === group2Id,
    )

    if (index === -1) {
      throw new TreeOperationError(
        'GROUP2_NOT_FOUND',
        `Không tìm thấy nhóm cấp 2 "${group2Id}".`,
      )
    }

    const nextGroups = [...group1.groups2]

    nextGroups[index] = update(
      group1.groups2[index],
      group1,
    )

    return {
      ...group1,
      groups2: nextGroups,
    }
  })
}

// ============================================================
// 7. ADD GROUP 1
// ============================================================

export function addGroup1(
  data: CalculationData,
  group1: Group1,
): CalculationData {
  assertNewGroup1IdsAvailable(data, group1)

  const group2Names = new Set<string>()

  for (const group2 of group1.groups2) {
    const key = group2NameKey(group2.name)

    if (group2Names.has(key)) {
      throw new TreeOperationError(
        'DUPLICATE_GROUP_NAME',
        'Nhóm cấp 2 có tên trùng nhau trong cùng nhóm ngày.',
      )
    }

    group2Names.add(key)
  }

  const clonedGroup1: Group1 = {
    ...group1,
    drawData: {
      oneToSeven: [...group1.drawData.oneToSeven],
      gdb: group1.drawData.gdb,
    },
    groups2: group1.groups2.map((group2) => ({
      ...group2,
      settings: group2.settings.map((setting) => ({
        ...setting,
      })),
    })),
  }

  return {
    ...data,
    groups1: [...data.groups1, clonedGroup1],
  }
}

// ============================================================
// 8. UPDATE GROUP 1 DATE
// ============================================================

export function renameGroup1(
  data: CalculationData,
  group1Id: EntityId,
  newDateLabel: string,
): CalculationData {
  const dateLabel = cleanDateLabel(newDateLabel)

  return updateGroup1ById(data, group1Id, (group1) => ({
    ...group1,
    dateLabel,
  }))
}

// ============================================================
// 9. UPDATE DRAW DATA
// ============================================================

export function updateDrawData(
  data: CalculationData,
  group1Id: EntityId,
  patch: Partial<DrawData>,
): CalculationData {
  return updateGroup1ById(data, group1Id, (group1) => ({
    ...group1,
    drawData: {
      ...group1.drawData,
      ...patch,
      oneToSeven: patch.oneToSeven
        ? [...patch.oneToSeven]
        : [...group1.drawData.oneToSeven],
    },
  }))
}

// ============================================================
// 10. ADD GROUP 2
// ============================================================

export function addGroup2(
  data: CalculationData,
  group1Id: EntityId,
  group2: Group2,
): CalculationData {
  const name = cleanGroup2Name(group2.name)

  assertNewGroup2IdsAvailable(data, group2)

  return updateGroup1ById(data, group1Id, (group1) => {
    assertGroup2NameAvailable(group1.groups2, name)

    return {
      ...group1,
      groups2: [
        ...group1.groups2,
        {
          ...group2,
          name,
          isVisibleOnA4: true,
          settings: group2.settings.map((setting) => ({
            ...setting,
          })),
        },
      ],
    }
  })
}

// ============================================================
// 11. RENAME GROUP 2
// ============================================================

export function renameGroup2(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  newName: string,
): CalculationData {
  const name = cleanGroup2Name(newName)

  return updateGroup1ById(data, group1Id, (group1) => {
    assertGroup2NameAvailable(
      group1.groups2,
      name,
      group2Id,
    )

    const index = group1.groups2.findIndex(
      (group2) => group2.id === group2Id,
    )

    if (index === -1) {
      throw new TreeOperationError(
        'GROUP2_NOT_FOUND',
        `Không tìm thấy nhóm cấp 2 "${group2Id}".`,
      )
    }

    const nextGroups = [...group1.groups2]

    nextGroups[index] = {
      ...nextGroups[index],
      name,
    }

    return {
      ...group1,
      groups2: nextGroups,
    }
  })
}

// ============================================================
// 12. GROUP 2 A4 VISIBILITY
// ============================================================

export function setGroup2Visibility(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  isVisibleOnA4: boolean,
): CalculationData {
  return updateGroup2ById(
    data,
    group1Id,
    group2Id,
    (group2) => ({
      ...group2,
      isVisibleOnA4,
    }),
  )
}

// ============================================================
// 13. ADD SETTING (GROUP 3)
// ============================================================

export function addSetting(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  setting: Setting,
): CalculationData {
  assertNewSettingIdAvailable(data, setting)

  return updateGroup2ById(
    data,
    group1Id,
    group2Id,
    (group2) => ({
      ...group2,
      settings: [
        ...group2.settings,
        { ...setting },
      ],
    }),
  )
}

// ============================================================
// 14. UPDATE SETTING
// ============================================================

export type SettingUpdate = Partial<
  Omit<Setting, 'kind' | 'id'>
>

export function updateSetting(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  settingId: EntityId,
  patch: SettingUpdate,
): CalculationData {
  return updateGroup2ById(
    data,
    group1Id,
    group2Id,
    (group2) => {
      const index = group2.settings.findIndex(
        (setting) => setting.id === settingId,
      )

      if (index === -1) {
        throw new TreeOperationError(
          'SETTING_NOT_FOUND',
          `Không tìm thấy thiết lập "${settingId}".`,
        )
      }

      const nextSettings = [...group2.settings]

      nextSettings[index] = {
        ...nextSettings[index],
        ...patch,
      }

      return {
        ...group2,
        settings: nextSettings,
      }
    },
  )
}

// ============================================================
// 15. RENAME SETTING
// ============================================================

export function renameSetting(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  settingId: EntityId,
  newName: string,
): CalculationData {
  return updateSetting(
    data,
    group1Id,
    group2Id,
    settingId,
    { name: newName },
  )
}

// ============================================================
// 16. DELETE OPERATIONS
// ============================================================

export function deleteGroup1(
  data: CalculationData,
  group1Id: EntityId,
): CalculationData {
  const exists = data.groups1.some(
    (group1) => group1.id === group1Id,
  )

  if (!exists) {
    throw new TreeOperationError(
      'GROUP1_NOT_FOUND',
      `Không tìm thấy nhóm ngày "${group1Id}".`,
    )
  }

  return {
    ...data,
    groups1: data.groups1.filter(
      (group1) => group1.id !== group1Id,
    ),
  }
}

export function deleteGroup2(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
): CalculationData {
  return updateGroup1ById(data, group1Id, (group1) => {
    const exists = group1.groups2.some(
      (group2) => group2.id === group2Id,
    )

    if (!exists) {
      throw new TreeOperationError(
        'GROUP2_NOT_FOUND',
        `Không tìm thấy nhóm cấp 2 "${group2Id}".`,
      )
    }

    return {
      ...group1,
      groups2: group1.groups2.filter(
        (group2) => group2.id !== group2Id,
      ),
    }
  })
}

export function deleteSetting(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  settingId: EntityId,
): CalculationData {
  return updateGroup2ById(
    data,
    group1Id,
    group2Id,
    (group2) => {
      const exists = group2.settings.some(
        (setting) => setting.id === settingId,
      )

      if (!exists) {
        throw new TreeOperationError(
          'SETTING_NOT_FOUND',
          `Không tìm thấy thiết lập "${settingId}".`,
        )
      }

      return {
        ...group2,
        settings: group2.settings.filter(
          (setting) => setting.id !== settingId,
        ),
      }
    },
  )
}

// ============================================================
// 17. REORDER HELPER
// ============================================================

function reorderItems<T extends { id: EntityId }>(
  items: readonly T[],
  itemId: EntityId,
  newIndex: number,
): T[] {
  if (
    !Number.isInteger(newIndex)
    || newIndex < 0
    || newIndex >= items.length
  ) {
    throw new TreeOperationError(
      'INVALID_INDEX',
      'Vị trí sắp xếp không hợp lệ.',
    )
  }

  const oldIndex = items.findIndex(
    (item) => item.id === itemId,
  )

  if (oldIndex === -1) {
    throw new TreeOperationError(
      'INVALID_INDEX',
      `Không tìm thấy phần tử "${itemId}" để sắp xếp.`,
    )
  }

  if (oldIndex === newIndex) {
    return [...items]
  }

  const nextItems = [...items]
  const [movedItem] = nextItems.splice(oldIndex, 1)

  nextItems.splice(newIndex, 0, movedItem)

  return nextItems
}

// ============================================================
// 18. REORDER GROUP 1
// ============================================================

export function reorderGroup1(
  data: CalculationData,
  group1Id: EntityId,
  newIndex: number,
): CalculationData {
  return {
    ...data,
    groups1: reorderItems(
      data.groups1,
      group1Id,
      newIndex,
    ),
  }
}

// ============================================================
// 19. REORDER GROUP 2
// ============================================================

export function reorderGroup2(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  newIndex: number,
): CalculationData {
  return updateGroup1ById(data, group1Id, (group1) => ({
    ...group1,
    groups2: reorderItems(
      group1.groups2,
      group2Id,
      newIndex,
    ),
  }))
}

// ============================================================
// 20. REORDER SETTINGS
// ============================================================

export function reorderSetting(
  data: CalculationData,
  group1Id: EntityId,
  group2Id: EntityId,
  settingId: EntityId,
  newIndex: number,
): CalculationData {
  return updateGroup2ById(
    data,
    group1Id,
    group2Id,
    (group2) => ({
      ...group2,
      settings: reorderItems(
        group2.settings,
        settingId,
        newIndex,
      ),
    }),
  )
}
