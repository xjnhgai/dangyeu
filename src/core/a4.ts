
import type {
  A4Selection,
  CalculationData,
  EntityId,
  Group1,
  Group2,
  Setting,
} from './models'

// ============================================================
// 1. ERRORS
// ============================================================

export type A4ProjectionErrorCode =
  | 'GROUP1_NOT_FOUND'
  | 'GROUP2_NOT_FOUND'
  | 'SETTING_NOT_FOUND'

export class A4ProjectionError extends Error {
  readonly code: A4ProjectionErrorCode

  constructor(
    code: A4ProjectionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'A4ProjectionError'
    this.code = code
  }
}

// ============================================================
// 2. PROJECTION TYPES
// ============================================================

/**
 * Tham chiếu tới một thiết lập được hiển thị trên A4.
 *
 * group2Id chỉ dùng để xác định nguồn dữ liệu.
 * Không dùng để hiển thị tên nhóm 2 khi nhóm đó bị ẩn.
 */
export interface A4SettingReference {
  group2Id: EntityId
  setting: Readonly<Setting>
}

/**
 * Nhóm thiết lập được hiển thị theo cấu trúc A4.
 */
export type A4ProjectionSection =
  /**
   * Nhóm cấp 2 vẫn hiển thị tên trên A4.
   */
  | {
      kind: 'group2'
      group2Id: EntityId
      title: string
      settings: A4SettingReference[]
    }

  /**
   * Các thiết lập thuộc những nhóm cấp 2 bị ẩn.
   *
   * Tất cả được gom chung dưới nhóm cấp 1.
   * Không hiển thị tên các nhóm cấp 2 nguồn.
   */
  | {
      kind: 'group1-settings'
      settings: A4SettingReference[]
    }

  /**
   * Khi người dùng chọn riêng một nhóm cấp 2.
   */
  | {
      kind: 'selected-group-settings'
      group2Id: EntityId
      settings: A4SettingReference[]
    }

  /**
   * Khi người dùng chọn riêng một thiết lập cấp 3.
   */
  | {
      kind: 'single-setting'
      group2Id: EntityId
      setting: Readonly<Setting>
    }

/**
 * Kết quả chuyển đổi dữ liệu thành cấu trúc hiển thị A4.
 */
export interface A4Projection {
  level: A4Selection['level']

  /**
   * Tiêu đề chính trên A4:
   * - Level 1: Ngày.
   * - Level 2: Tên nhóm nếu đang hiển thị.
   * - Level 3: Tên thiết lập.
   * - Level 2 bị ẩn: null.
   */
  title: string | null

  sections: A4ProjectionSection[]
}

// ============================================================
// 3. FIND DATA
// ============================================================

function findGroup1(
  data: CalculationData,
  group1Id: EntityId,
): Group1 {
  const group1 = data.groups1.find(
    (item) => item.id === group1Id,
  )

  if (!group1) {
    throw new A4ProjectionError(
      'GROUP1_NOT_FOUND',
      `Không tìm thấy nhóm cấp 1 "${group1Id}".`,
    )
  }

  return group1
}

function findGroup2(
  group1: Group1,
  group2Id: EntityId,
): Group2 {
  const group2 = group1.groups2.find(
    (item) => item.id === group2Id,
  )

  if (!group2) {
    throw new A4ProjectionError(
      'GROUP2_NOT_FOUND',
      `Không tìm thấy nhóm cấp 2 "${group2Id}".`,
    )
  }

  return group2
}

function findSetting(
  group2: Group2,
  settingId: EntityId,
): Setting {
  const setting = group2.settings.find(
    (item) => item.id === settingId,
  )

  if (!setting) {
    throw new A4ProjectionError(
      'SETTING_NOT_FOUND',
      `Không tìm thấy thiết lập "${settingId}".`,
    )
  }

  return setting
}

// ============================================================
// 4. CREATE SETTING REFERENCES
// ============================================================

function createSettingReferences(
  group2: Group2,
): A4SettingReference[] {
  return group2.settings.map((setting) => ({
    group2Id: group2.id,
    setting: { ...setting },
  }))
}

// ============================================================
// 5. LEVEL 1 PROJECTION
// ============================================================

/**
 * A4 tại cấp 1:
 *
 * - Hiển thị ngày.
 * - Nhóm cấp 2 đang hiện: hiển thị tên và thiết lập.
 * - Nhóm cấp 2 bị ẩn: gom các thiết lập vào một nhóm chung.
 *
 * Các thiết lập của nhóm bị ẩn vẫn giữ nguyên thứ tự
 * tương đối theo thứ tự nhóm 2 và thiết lập ban đầu.
 */
function buildLevel1Projection(
  group1: Group1,
): A4Projection {
  const sections: A4ProjectionSection[] = []

  let rootSettingsSection:
    | Extract<
        A4ProjectionSection,
        { kind: 'group1-settings' }
      >
    | null = null

  for (const group2 of group1.groups2) {
    const settingReferences = createSettingReferences(group2)

    if (group2.isVisibleOnA4) {
      sections.push({
        kind: 'group2',
        group2Id: group2.id,
        title: group2.name,
        settings: settingReferences,
      })

      continue
    }

    // Nhóm cấp 2 bị ẩn nhưng không có thiết lập:
    // không cần tạo một section rỗng trên A4.
    if (settingReferences.length === 0) {
      continue
    }

    // Chỉ có một section chung cho tất cả thiết lập
    // thuộc các nhóm cấp 2 bị ẩn.
    if (rootSettingsSection === null) {
      rootSettingsSection = {
        kind: 'group1-settings',
        settings: [],
      }

      sections.push(rootSettingsSection)
    }

    rootSettingsSection.settings.push(...settingReferences)
  }

  return {
    level: 1,
    title: group1.dateLabel,
    sections,
  }
}

// ============================================================
// 6. LEVEL 2 PROJECTION
// ============================================================

/**
 * A4 tại cấp 2:
 * - Chỉ lấy nhóm cấp 2 được chọn và thiết lập của nó.
 * - Không hiển thị ngày.
 * - Nếu tên nhóm bị ẩn, title = null.
 * - Không lấy dữ liệu của nhóm cấp 2 khác.
 */
function buildLevel2Projection(
  group2: Group2,
): A4Projection {
  return {
    level: 2,
    title: group2.isVisibleOnA4
      ? group2.name
      : null,
    sections: [
      {
        kind: 'selected-group-settings',
        group2Id: group2.id,
        settings: createSettingReferences(group2),
      },
    ],
  }
}

// ============================================================
// 7. LEVEL 3 PROJECTION
// ============================================================

/**
 * A4 tại cấp 3:
 * - Chỉ hiển thị thiết lập được chọn.
 * - Không hiển thị ngày.
 * - Không hiển thị tên nhóm cấp 2.
 * - Không lấy các thiết lập khác.
 */
function buildLevel3Projection(
  group2: Group2,
  setting: Setting,
): A4Projection {
  return {
    level: 3,
    title: setting.name,
    sections: [
      {
        kind: 'single-setting',
        group2Id: group2.id,
        setting: { ...setting },
      },
    ],
  }
}

// ============================================================
// 8. PUBLIC A4 PROJECTION
// ============================================================

/**
 * Tạo cấu trúc nội dung A4 theo cấp được chọn.
 *
 * Hàm này không sửa Calculation Data.
 * Các Setting trả về là bản sao độc lập.
 */
export function buildA4Projection(
  data: CalculationData,
  selection: A4Selection,
): A4Projection {
  const group1 = findGroup1(
    data,
    selection.group1Id,
  )

  switch (selection.level) {
    case 1:
      return buildLevel1Projection(group1)

    case 2: {
      const group2 = findGroup2(
        group1,
        selection.group2Id,
      )

      return buildLevel2Projection(group2)
    }

    case 3: {
      const group2 = findGroup2(
        group1,
        selection.group2Id,
      )

      const setting = findSetting(
        group2,
        selection.settingId,
      )

      return buildLevel3Projection(
        group2,
        setting,
      )
    }

    default: {
      const exhaustiveCheck: never = selection
      return exhaustiveCheck
    }
  }
}
