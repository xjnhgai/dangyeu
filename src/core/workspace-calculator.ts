
import type {
  A4Projection,
  A4SettingReference,
} from './a4'

import {
  buildA4Projection,
} from './a4'

import {
  calculateSetting,
  type SettingCalculationResult,
} from './calculation'

import type {
  A4Selection,
  CalculationData,
  EntityId,
  Group1,
} from './models'

import {
  buildA4Summary,
  type A4Summary,
} from './summary'

// ============================================================
// 1. ERRORS
// ============================================================

export type WorkspaceCalculationErrorCode =
  | 'GROUP1_NOT_FOUND'
  | 'INVALID_LISTING'
  | 'INVALID_POINT'
  | 'INVALID_COEFFICIENT'

export class WorkspaceCalculationError extends Error {
  readonly code: WorkspaceCalculationErrorCode

  readonly settingId?: EntityId

  constructor(
    code: WorkspaceCalculationErrorCode,
    message: string,
    settingId?: EntityId,
  ) {
    super(message)
    this.name = 'WorkspaceCalculationError'
    this.code = code
    this.settingId = settingId
  }
}

// ============================================================
// 2. RESULT TYPES
// ============================================================

export interface WorkspaceCalculationResult {
  /** Cấu trúc nội dung A4. */
  projection: A4Projection

  /** Kết quả D/T của từng thiết lập theo ID. */
  settingResults: ReadonlyMap<
    EntityId,
    SettingCalculationResult
  >

  /** Tổng hợp D/T theo phạm vi A4. */
  summary: A4Summary
}

// ============================================================
// 3. PARSE LISTING
// ============================================================

const VALID_LISTING_NUMBER = /^\d{2,5}$/

/**
 * Phân tích chuỗi danh sách số.
 *
 * Quy ước:
 * - Dùng dấu phẩy để phân cách.
 * - Cho phép khoảng trắng quanh từng số.
 * - Giữ nguyên số 0 ở đầu.
 * - Giữ nguyên các phần tử trùng lặp.
 * - Chuỗi rỗng tương ứng danh sách rỗng.
 * - Từ chối phần tử rỗng nằm giữa các dấu phẩy.
 *
 * Ví dụ:
 * "12, 23, 00128" => ["12", "23", "00128"]
 */
export function parseListingText(
  text: string,
): string[] {
  const trimmed = text.trim()

  if (trimmed === '') {
    return []
  }

  const values = trimmed.split(',').map(
    (value) => value.trim(),
  )

  if (values.some((value) => value === '')) {
    throw new WorkspaceCalculationError(
      'INVALID_LISTING',
      'Danh sách có phần tử rỗng. Hãy kiểm tra dấu phẩy phân cách.',
    )
  }

  const invalidValues = values.filter(
    (value) => !VALID_LISTING_NUMBER.test(value),
  )

  if (invalidValues.length > 0) {
    throw new WorkspaceCalculationError(
      'INVALID_LISTING',
      `Số "${invalidValues[0]}" không hợp lệ. Mỗi số phải gồm 2–5 chữ số.`,
    )
  }

  return values
}

// ============================================================
// 4. PARSE POINT
// ============================================================

const VALID_POINT = /^\d{1,4}$/

/**
 * Điểm chỉ nhận số nguyên không âm, tối đa 4 chữ số.
 *
 * Hợp lệ:
 * "0", "5", "25", "100", "2500".
 *
 * Không hợp lệ:
 * "1.5", "1,5", "-5", "10000", "".
 */
export function parsePointText(text: string): number {
  const trimmed = text.trim()

  if (!VALID_POINT.test(trimmed)) {
    throw new WorkspaceCalculationError(
      'INVALID_POINT',
      'Điểm phải là số nguyên từ 0 đến 9999, tối đa 4 chữ số.',
    )
  }

  return Number(trimmed)
}

// ============================================================
// 5. PARSE COEFFICIENT
// ============================================================

const VALID_COEFFICIENT =
  /^\d+(?:[.,]\d+)?$/

/**
 * Phân tích hệ số D/T.
 *
 * Cho phép số nguyên và số thập phân không âm.
 * Dấu chấm hoặc dấu phẩy đều được chấp nhận
 * vì đây là một trường nhập liệu riêng.
 *
 * Ví dụ:
 * "2"   => 2
 * "1.5" => 1.5
 * "1,5" => 1.5
 */
export function parseCoefficientText(
  text: string,
  fieldName: string,
): number {
  const trimmed = text.trim()

  if (!VALID_COEFFICIENT.test(trimmed)) {
    throw new WorkspaceCalculationError(
      'INVALID_COEFFICIENT',
      `${fieldName} phải là số không âm hợp lệ.`,
    )
  }

  const value = Number(trimmed.replace(',', '.'))

  if (!Number.isFinite(value)) {
    throw new WorkspaceCalculationError(
      'INVALID_COEFFICIENT',
      `${fieldName} vượt quá phạm vi số hợp lệ.`,
    )
  }

  return value
}

// ============================================================
// 6. GET SELECTED GROUP 1
// ============================================================

function findGroup1(
  data: CalculationData,
  group1Id: EntityId,
): Group1 {
  const group1 = data.groups1.find(
    (item) => item.id === group1Id,
  )

  if (!group1) {
    throw new WorkspaceCalculationError(
      'GROUP1_NOT_FOUND',
      `Không tìm thấy nhóm ngày "${group1Id}".`,
    )
  }

  return group1
}

// ============================================================
// 7. GET SETTINGS FROM A4 PROJECTION
// ============================================================

function getSectionSettings(
  projection: A4Projection,
): A4SettingReference[] {
  return projection.sections.flatMap((section) => {
    switch (section.kind) {
      case 'group2':
      case 'group1-settings':
      case 'selected-group-settings':
        return section.settings

      case 'single-setting':
        return [
          {
            group2Id: section.group2Id,
            setting: section.setting,
          },
        ]

      default: {
        const exhaustiveCheck: never = section
        return exhaustiveCheck
      }
    }
  })
}

// ============================================================
// 8. CALCULATE ONE SETTING
// ============================================================

function calculateOneSetting(
  reference: A4SettingReference,
  group1: Group1,
): SettingCalculationResult {
  const setting = reference.setting

  try {
    const listing = parseListingText(setting.listing)

    const point = parsePointText(setting.point)

    const coefficientD = parseCoefficientText(
      setting.coefficientD,
      'Hệ số D',
    )

    const coefficientT = parseCoefficientText(
      setting.coefficientT,
      'Hệ số T',
    )

    return calculateSetting({
      listing,
      oneToSeven: group1.drawData.oneToSeven,
      gdb: group1.drawData.gdb,
      point,
      coefficientD,
      coefficientT,
    })
  } catch (error) {
    if (error instanceof WorkspaceCalculationError) {
      throw new WorkspaceCalculationError(
        error.code,
        `Thiết lập "${setting.name}" (${setting.id}): ${error.message}`,
        setting.id,
      )
    }

    throw error
  }
}

// ============================================================
// 9. CALCULATE SELECTED A4 WORKSPACE
// ============================================================

/**
 * Tính toán toàn bộ thiết lập thuộc phạm vi A4 được chọn.
 *
 * Level 1:
 * - Tính tất cả thiết lập thuộc ngày.
 * - Bao gồm cả thiết lập của nhóm cấp 2 bị ẩn.
 *
 * Level 2:
 * - Chỉ tính thiết lập thuộc nhóm cấp 2 được chọn.
 *
 * Level 3:
 * - Chỉ tính thiết lập được chọn.
 *
 * Kết quả:
 * - D/T từng thiết lập.
 * - Trạng thái tô đỏ từng số trong danh sách.
 * - Tổng D/T theo từng section.
 * - Tổng D/T toàn phạm vi A4.
 */
export function calculateWorkspaceForA4(
  data: CalculationData,
  selection: A4Selection,
): WorkspaceCalculationResult {
  const group1 = findGroup1(
    data,
    selection.group1Id,
  )

  // Tạo phạm vi A4 trước để chỉ tính những thiết lập
  // thực sự thuộc phạm vi người dùng chọn.
  const projection = buildA4Projection(
    data,
    selection,
  )

  const references = getSectionSettings(projection)

  const settingResults = new Map<
    EntityId,
    SettingCalculationResult
  >()

  for (const reference of references) {
    const result = calculateOneSetting(
      reference,
      group1,
    )

    settingResults.set(
      reference.setting.id,
      result,
    )
  }

  // Tổng hợp từ chính kết quả tính vừa tạo.
  const summary = buildA4Summary(
    projection,
    settingResults,
    group1.drawData,
  )

  return {
    projection,
    settingResults,
    summary,
  }
}
