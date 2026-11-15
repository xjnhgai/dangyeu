import { resultNumbers } from './result-input'
import {
  calculateSetting,
  type SettingCalculationResult,
} from './calculation'
import {
  A4ProjectionV2Error,
  buildA4ProjectionV2,
  type A4ProjectionV2,
} from './a4-v2'
import { buildA4SummaryV2, type A4SummaryV2 } from './summary-v2'
import type {
  A4PageSelectionV2,
  CalculationDataV2,
  DrawData,
  EntityId,
  Group3,
  ListingCountKey,
  FormulaId,
} from './models-v2'

export type WorkspaceCalculationV2ErrorCode =
  | 'GROUP1_NOT_FOUND'
  | 'GROUP2_NOT_FOUND'
  | 'TYPE_NOT_FOUND'
  | 'INVALID_LISTING'
  | 'INVALID_POINT'
  | 'INVALID_COEFFICIENT'
  | 'INVALID_DRAW_DATA'

export class WorkspaceCalculationV2Error extends Error {
  readonly code: WorkspaceCalculationV2ErrorCode
  readonly group3Id?: EntityId

  constructor(code: WorkspaceCalculationV2ErrorCode, message: string, group3Id?: EntityId) {
    super(message)
    this.name = 'WorkspaceCalculationV2Error'
    this.code = code
    this.group3Id = group3Id
  }
}

export interface WorkspaceCalculationV2Result {
  projection: A4ProjectionV2
  settingResults: ReadonlyMap<EntityId, SettingCalculationResult>
  summary: A4SummaryV2
}

const VALID_LISTING_NUMBER = /^\d{2,5}$/
const VALID_SETTING_NUMBER = /^\d{2}$/
const VALID_SETTING_NUMBER_DA_DB = /^\d{2,3}$/
const VALID_POINT = /^\d{1,4}$/
const VALID_COEFFICIENT = /^\d+(?:[.,]\d+)?$/

/** Commas and any amount of whitespace are equivalent list separators. */
export function splitSeparatedValuesV2(text: string): string[] {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/[\s,]+/u).filter(Boolean) : []
}

export function parseListingTextV2(text: string): string[] {
  const values = splitSeparatedValuesV2(text)
  const invalid = values.find((value) => !VALID_LISTING_NUMBER.test(value))
  if (invalid !== undefined) {
    throw new WorkspaceCalculationV2Error('INVALID_LISTING', `Số "${invalid}" không hợp lệ. Mỗi số phải gồm 2–5 chữ số.`)
  }
  return values
}

/** UI validation for the 1–7 draw: either not entered yet or exactly 26 values. */
export function parseOneToSevenTextV2(text: string): string[] {
  const values = resultNumbers(text)
  if (values.some((value) => !VALID_LISTING_NUMBER.test(value))) throw new WorkspaceCalculationV2Error('INVALID_DRAW_DATA', 'Nhập sai số')
  if (values.length > 0 && values.length !== 26) {
    throw new WorkspaceCalculationV2Error(
      'INVALID_DRAW_DATA',
      `Dữ liệu 1–7 phải có đúng 26 số (hiện có ${values.length} số).`,
    )
  }
  return values
}

/** Parse 00–99 listings generally; ĐA/ĐB accept homogeneous 2-digit or 3-digit lists. */
export function parseSettingNumberListV2(text: string, formulaId?: FormulaId): string[] {
  const values = splitSeparatedValuesV2(text)
  const allowTwoOrThreeDigits = formulaId === 'da' || formulaId === 'db'
  const invalid = values.find((value) => !(allowTwoOrThreeDigits ? VALID_SETTING_NUMBER_DA_DB : VALID_SETTING_NUMBER).test(value))
  const mixedWidths = allowTwoOrThreeDigits && new Set(values.map((value) => value.length)).size > 1
  if (invalid !== undefined || mixedWidths) {
    throw new WorkspaceCalculationV2Error('INVALID_LISTING', allowTwoOrThreeDigits
      ? 'ĐA/ĐB chỉ nhận danh sách toàn số 2 chữ số hoặc toàn số 3 chữ số; không được trộn hai loại.'
      : `Mục ${values.indexOf(invalid!) + 1}: "${invalid}" không hợp lệ (${invalid?.length} ký tự). ${formulaId?.toUpperCase() ?? "Thiết lập"} cần đúng 2 chữ số từ 00 đến 99, ví dụ 01, 12, 99. Tách các số bằng dấu phẩy, khoảng trắng hoặc xuống dòng; không nhập liền như 011299.`)
  }
  return values
}

export function isProfileCoefficientFormula(formulaId: FormulaId): boolean {
  return formulaId === 'da' || formulaId === 'db' || formulaId === 'xa' || formulaId === 'xb'
}

export function getCoefficientProfileKeys(formulaId: FormulaId): ListingCountKey[] {
  if (formulaId === 'da' || formulaId === 'db') return ['2', '3']
  if (formulaId === 'xa' || formulaId === 'xb') return ['2', '3', '4', '5']
  return []
}

export function getCoefficientProfileKey(formulaId: FormulaId, listing: readonly string[]): ListingCountKey | null {
  if (formulaId === 'da' || formulaId === 'db') {
    const width = listing[0]?.length
    return width === 2 || width === 3 ? String(width) as ListingCountKey : null
  }
  if (formulaId === 'xa' || formulaId === 'xb') {
    return listing.length >= 2 && listing.length <= 5 ? String(listing.length) as ListingCountKey : null
  }
  return null
}

export function parsePointTextV2(text: string): number {
  const value = text.trim()
  if (!VALID_POINT.test(value)) {
    throw new WorkspaceCalculationV2Error('INVALID_POINT', 'Điểm phải là số nguyên từ 0 đến 9999, tối đa 4 chữ số.')
  }
  return Number(value)
}

export function parseCoefficientTextV2(text: string, fieldName: string): number {
  const value = text.trim()
  if (!VALID_COEFFICIENT.test(value)) {
    throw new WorkspaceCalculationV2Error('INVALID_COEFFICIENT', `${fieldName} phải là số không âm hợp lệ.`)
  }
  const parsed = Number(value.replace(',', '.'))
  if (!Number.isFinite(parsed)) {
    throw new WorkspaceCalculationV2Error('INVALID_COEFFICIENT', `${fieldName} vượt quá phạm vi số hợp lệ.`)
  }
  return parsed
}

function calculateGroup3(group3: Readonly<Group3>, drawData: DrawData, data: CalculationDataV2): SettingCalculationResult {
  try {
    const type = data.settingTypes.find((item) => item.id === group3.settingTypeId)
    if (!type) throw new WorkspaceCalculationV2Error('INVALID_DRAW_DATA', `Không tìm thấy loại thiết lập của ${group3.id}.`)
    const listing = parseSettingNumberListV2(group3.listing, type.formulaId)
    const usesProfileCoefficients = isProfileCoefficientFormula(type.formulaId)
    let coefficientDText = group3.coefficientD
    let coefficientTText = group3.coefficientT

    if (usesProfileCoefficients) {
      const profileKey = getCoefficientProfileKey(type.formulaId, listing)
      if (!profileKey) {
        throw new WorkspaceCalculationV2Error('INVALID_LISTING', type.formulaId === 'da' || type.formulaId === 'db'
          ? 'ĐA/ĐB cần danh sách toàn số 2 chữ số hoặc toàn số 3 chữ số.'
          : 'XA/XB yêu cầu đúng 2, 3, 4 hoặc 5 số trong ô Liệt kê.')
      }
      const rowCoefficients = group3.coefficientsByCount?.[profileKey]
      const defaultCoefficients = type.defaultCoefficientsByCount?.[profileKey]
      // Backward compatibility applies only to DA/DB, whose profile-based
      // coefficients replaced an older scalar setup. XA/XB have always
      // required a distinct coefficient pair for each listing count, so a
      // scalar row/default must never silently satisfy a missing profile.
      const supportsLegacyScalarFallback = type.formulaId === 'da' || type.formulaId === 'db'
      coefficientDText = rowCoefficients?.coefficientD
        || (supportsLegacyScalarFallback ? group3.coefficientD : '')
        || defaultCoefficients?.coefficientD
        || (supportsLegacyScalarFallback ? group3.coefficientD || type.defaultCoefficientD : '')
        || ''
      coefficientTText = rowCoefficients?.coefficientT
        || (supportsLegacyScalarFallback ? group3.coefficientT : '')
        || defaultCoefficients?.coefficientT
        || (supportsLegacyScalarFallback ? group3.coefficientT || type.defaultCoefficientT : '')
        || ''
      const profileLabel = type.formulaId === 'da' || type.formulaId === 'db'
        ? `${profileKey} chữ số`
        : `${profileKey} số trong danh sách`
      if (!coefficientDText) {
        throw new WorkspaceCalculationV2Error('INVALID_COEFFICIENT', `Chưa cài hệ số Đánh cho loại ${profileLabel} trong ${type.name}.`)
      }
      // DA/DB are GDB-only. Before GDB arrives, D is still calculable while
      // T is deliberately null, so a missing T profile must not block D.
      // XA/XB also compare against 1–7, therefore their T profile is required
      // even when GDB has not arrived yet.
      const isGdbOnlyFormula = type.formulaId === 'da' || type.formulaId === 'db'
      if (!coefficientTText && (!isGdbOnlyFormula || drawData.gdb.trim() !== '')) {
        throw new WorkspaceCalculationV2Error('INVALID_COEFFICIENT', `Chưa cài hệ số Trúng cho loại ${profileLabel} trong ${type.name}.`)
      }
      if (!coefficientTText) coefficientTText = '0'
    }

    return calculateSetting({
      listing,
      oneToSeven: drawData.oneToSeven,
      gdb: drawData.gdb,
      point: parsePointTextV2(group3.point),
      coefficientD: parseCoefficientTextV2(coefficientDText, 'Hệ số Đánh'),
      coefficientT: parseCoefficientTextV2(coefficientTText, 'Hệ số Trúng'),
      formulaId: type.formulaId,
    })
  } catch (error) {
    if (error instanceof WorkspaceCalculationV2Error) {
      throw new WorkspaceCalculationV2Error(error.code, `Thiết lập ${group3.id}: ${error.message}`, group3.id)
    }
    if (error instanceof Error) {
      throw new WorkspaceCalculationV2Error('INVALID_DRAW_DATA', `Thiết lập ${group3.id}: ${error.message}`, group3.id)
    }
    throw error
  }
}

export function calculateWorkspaceForA4V2(
  data: CalculationDataV2,
  selection: A4PageSelectionV2,
): WorkspaceCalculationV2Result {
  let projection: A4ProjectionV2

  try {
    projection = buildA4ProjectionV2(data, selection)
  } catch (error) {
    // Keep the workspace API's error contract consistent even when
    // its A4 projection dependency detects an invalid selection/reference.
    if (error instanceof A4ProjectionV2Error) {
      throw new WorkspaceCalculationV2Error(
        error.code,
        error.message,
      )
    }
    throw error
  }

  const settingResults = new Map<EntityId, SettingCalculationResult>()
  for (const entry of projection.entries) {
    settingResults.set(entry.group3.id, calculateGroup3(entry.group3, projection.group1.drawData, data))
  }
  const summary = buildA4SummaryV2(projection, settingResults)
  return { projection, settingResults, summary }
}
