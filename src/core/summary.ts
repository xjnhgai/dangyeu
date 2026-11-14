
import type {
  A4Projection,
  A4ProjectionSection,
  A4SettingReference,
} from './a4'

import type {
  DrawData,
  EntityId,
} from './models'

import type {
  SettingCalculationResult,
} from './calculation'

// ============================================================
// 1. TYPES
// ============================================================

export type SettingCalculationAmounts = Pick<
  SettingCalculationResult,
  'd' | 't'
>

export interface CalculationTotals {
  /** Tổng số thiết lập được tổng hợp. */
  settingCount: number

  /** Tổng D. */
  d: number

  /** Tổng T. null nghĩa là chưa có dữ liệu để tính T. */
  t: number | null

  /** Tổng T - Tổng D. null nếu T chưa có dữ liệu. */
  difference: number | null
}

export interface A4SectionSummary {
  kind: A4ProjectionSection['kind']

  group2Id?: EntityId

  /** Tiêu đề nhóm nếu section có tên nhóm. */
  title?: string

  settingId?: EntityId

  totals: CalculationTotals
}

export interface A4Summary {
  level: A4Projection['level']

  title: string | null

  /** Tổng hợp riêng từng section trên A4. */
  sections: A4SectionSummary[]

  /** Tổng toàn bộ phạm vi A4 đang chọn. */
  totals: CalculationTotals
}

// ============================================================
// 2. ERRORS
// ============================================================

export type SummaryErrorCode =
  | 'SETTING_RESULT_NOT_FOUND'
  | 'INVALID_D_RESULT'
  | 'INVALID_T_RESULT'
  | 'INCONSISTENT_T_RESULT'

export class SummaryError extends Error {
  readonly code: SummaryErrorCode

  constructor(
    code: SummaryErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SummaryError'
    this.code = code
  }
}

// ============================================================
// 3. DRAW DATA AVAILABILITY
// ============================================================

/**
 * Kiểm tra đã có ít nhất một dữ liệu 1-7 hoặc GĐB.
 *
 * Dữ liệu này quyết định T:
 * - Chưa có dữ liệu: T = null.
 * - Đã có dữ liệu: T có thể bằng 0.
 */
export function hasDrawInputData(
  drawData: DrawData,
): boolean {
  return (
    drawData.oneToSeven.some((value) => value !== '')
    || drawData.gdb !== ''
  )
}

// ============================================================
// 4. GET SETTINGS FROM A4 SECTION
// ============================================================

function getSectionSettings(
  section: A4ProjectionSection,
): A4SettingReference[] {
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
}

// ============================================================
// 5. SUMMARIZE SETTINGS
// ============================================================

/**
 * Tổng hợp kết quả của một danh sách thiết lập.
 *
 * Mỗi Setting ID phải có kết quả tính toán tương ứng.
 *
 * Không tự chuyển null thành 0.
 * Không chấp nhận kết quả T không nhất quán với DrawData.
 */
function summarizeSettings(
  settings: readonly A4SettingReference[],
  results: ReadonlyMap<
    EntityId,
    SettingCalculationAmounts
  >,
  hasDrawData: boolean,
): CalculationTotals {
  let totalD = 0
  let totalT = 0

  for (const reference of settings) {
    const settingId = reference.setting.id
    const result = results.get(settingId)

    if (!result) {
      throw new SummaryError(
        'SETTING_RESULT_NOT_FOUND',
        `Chưa có kết quả tính toán cho thiết lập "${settingId}".`,
      )
    }

    if (!Number.isFinite(result.d)) {
      throw new SummaryError(
        'INVALID_D_RESULT',
        `Kết quả D của thiết lập "${settingId}" không hợp lệ.`,
      )
    }

    totalD += result.d

    if (hasDrawData) {
      if (result.t === null) {
        throw new SummaryError(
          'INCONSISTENT_T_RESULT',
          `Thiết lập "${settingId}" chưa có kết quả T dù dữ liệu 1-7/GĐB đã tồn tại.`,
        )
      }

      if (!Number.isFinite(result.t)) {
        throw new SummaryError(
          'INVALID_T_RESULT',
          `Kết quả T của thiết lập "${settingId}" không hợp lệ.`,
        )
      }

      totalT += result.t
    } else if (result.t !== null) {
      throw new SummaryError(
        'INCONSISTENT_T_RESULT',
        `Thiết lập "${settingId}" có kết quả T dù dữ liệu 1-7/GĐB đang trống.`,
      )
    }
  }

  const t = hasDrawData ? totalT : null

  return {
    settingCount: settings.length,
    d: totalD,
    t,
    difference: t === null ? null : t - totalD,
  }
}

// ============================================================
// 6. SUMMARIZE ONE A4 SECTION
// ============================================================

function summarizeSection(
  section: A4ProjectionSection,
  results: ReadonlyMap<
    EntityId,
    SettingCalculationAmounts
  >,
  hasDrawData: boolean,
): A4SectionSummary {
  const totals = summarizeSettings(
    getSectionSettings(section),
    results,
    hasDrawData,
  )

  switch (section.kind) {
    case 'group2':
      return {
        kind: section.kind,
        group2Id: section.group2Id,
        title: section.title,
        totals,
      }

    case 'group1-settings':
      return {
        kind: section.kind,
        totals,
      }

    case 'selected-group-settings':
      return {
        kind: section.kind,
        group2Id: section.group2Id,
        totals,
      }

    case 'single-setting':
      return {
        kind: section.kind,
        group2Id: section.group2Id,
        settingId: section.setting.id,
        title: section.setting.name,
        totals,
      }

    default: {
      const exhaustiveCheck: never = section
      return exhaustiveCheck
    }
  }
}

// ============================================================
// 7. BUILD A4 SUMMARY
// ============================================================

/**
 * Tổng hợp D/T theo phạm vi của A4Projection.
 *
 * Level 1:
 * - Tổng từng Group 2 đang hiển thị.
 * - Tổng phần thiết lập được gom từ Group 2 bị ẩn.
 * - Tổng toàn bộ Group 1.
 *
 * Level 2:
 * - Chỉ tổng thiết lập trong Group 2 được chọn.
 *
 * Level 3:
 * - Chỉ tổng của Setting được chọn.
 *
 * Hàm không sửa Calculation Data hoặc A4Projection.
 */
export function buildA4Summary(
  projection: A4Projection,
  results: ReadonlyMap<
    EntityId,
    SettingCalculationAmounts
  >,
  drawData: DrawData,
): A4Summary {
  const hasDrawData = hasDrawInputData(drawData)

  const sections = projection.sections.map((section) =>
    summarizeSection(
      section,
      results,
      hasDrawData,
    ),
  )

  // Tổng chung được tính từ tất cả thiết lập thuộc phạm vi A4.
  // Không phụ thuộc vào việc nhóm cấp 2 được ẩn hay hiện.
  const allSettings = projection.sections.flatMap(
    getSectionSettings,
  )

  const totals = summarizeSettings(
    allSettings,
    results,
    hasDrawData,
  )

  return {
    level: projection.level,
    title: projection.title,
    sections,
    totals,
  }
}
