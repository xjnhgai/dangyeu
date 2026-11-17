
export interface SettingCalculationInput {
  /** Danh sách số cần tính. */
  listing: readonly string[]

  /** Dữ liệu 1-7: tối đa 26 số. */
  oneToSeven: readonly string[]

  /** Dữ liệu GĐB: một số gồm đúng 5 chữ số. */
  gdb?: string | null

  point: number
  coefficientD: number
  coefficientT: number
  /** Defaults to LB for compatibility with the original calculation API. */
  formulaId?: 'lb' | 'la' | 'da' | 'db' | 'ca' | 'cb' | 'xa' | 'xb'
}

export interface SettingCalculationResult {
  /** Kết quả D. */
  d: number

  /** Kết quả T. null nghĩa là chưa có dữ liệu 1-7 và GĐB. */
  t: number | null

  /** Số phần tử hợp lệ trong danh sách. */
  listingCount: number

  /** Số bản ghi thuộc phạm vi T của công thức đang chạy. */
  inputRecordCount: number

  /** Tổng số cặp khớp theo quy tắc của công thức đang chạy. */
  matchingPairCount: number

  /**
   * Trạng thái khớp của từng phần tử trong listing.
   *
   * Vị trí trong mảng tương ứng chính xác với vị trí
   * trong input.listing.
   *
   * true: Có ít nhất một bản ghi 1-7 hoặc GĐB khớp.
   * false: Không có bản ghi khớp.
   *
   * Dùng thuộc tính này để hiển thị số màu đỏ.
   * Các dòng trống luôn có giá trị false.
   */
  listingMatchFlags: boolean[]
}

const VALID_LISTING_NUMBER = /^\d{2}$/
const VALID_DA_DB_LISTING_NUMBER = /^\d{2,3}$/
const VALID_DRAW_NUMBER = /^\d{2,5}$/
const VALID_GDB_NUMBER = /^\d{5}$/

// ============================================================
// 1. VALIDATION
// ============================================================

function assertFiniteNumber(
  value: number,
  fieldName: string,
): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${fieldName} phải là một số hợp lệ.`)
  }
}

function validateCalculationInput(
  input: SettingCalculationInput,
  formulaId: NonNullable<SettingCalculationInput['formulaId']>,
): {
  listing: string[]
  oneToSeven: string[]
  gdb: string
} {
  const listing = input.listing.filter((value) => value !== '')
  const oneToSeven = input.oneToSeven.filter(
    (value) => value !== '',
  )
  const gdb = input.gdb ?? ''

  assertFiniteNumber(input.point, 'Điểm')
  assertFiniteNumber(input.coefficientD, 'Hệ số Đánh')
  assertFiniteNumber(input.coefficientT, 'Hệ số Trúng')

  const allowTwoOrThreeDigits = formulaId === 'da' || formulaId === 'db'
  const invalidListing = listing.some((value) => !(allowTwoOrThreeDigits ? VALID_DA_DB_LISTING_NUMBER : VALID_LISTING_NUMBER).test(value))
  const mixedDaDbWidths = allowTwoOrThreeDigits && new Set(listing.map((value) => value.length)).size > 1
  if (invalidListing || mixedDaDbWidths) {
    throw new Error(allowTwoOrThreeDigits
      ? 'ĐA/ĐB chỉ nhận danh sách toàn số 2 chữ số hoặc toàn số 3 chữ số; không được trộn hai loại.'
      : 'Mỗi số trong danh sách phải gồm đúng 2 chữ số (00–99).')
  }

  if (oneToSeven.length > 26) {
    throw new Error('Dữ liệu 1-7 không được vượt quá 26 số.')
  }

  if (
    oneToSeven.some(
      (value) => !VALID_DRAW_NUMBER.test(value),
    )
  ) {
    throw new Error(
      'Mỗi số 1-7 phải gồm 2–5 chữ số.',
    )
  }

  if (gdb !== '' && !VALID_GDB_NUMBER.test(gdb)) {
    throw new Error('GĐB phải gồm đúng 5 chữ số.')
  }

  return {
    listing,
    oneToSeven,
    gdb,
  }
}

// ============================================================
// 2. FIND EXACT DUPLICATES
// ============================================================

/**
 * Tìm các giá trị trùng khớp hoàn toàn.
 *
 * Không so sánh theo hậu tố.
 * Không tự động xóa dữ liệu trùng.
 * Không xem chuỗi rỗng là dữ liệu trùng.
 */
export function findExactDuplicates(
  values: readonly string[],
): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (value === '') {
      continue
    }

    if (seen.has(value)) {
      duplicates.add(value)
    } else {
      seen.add(value)
    }
  }

  return [...duplicates]
}

// ============================================================
// 3. CALCULATE D AND T
// ============================================================

/**
 * Công thức:
 *
 * LB/LA/CA/CB:
 * D = số lượng số trong danh sách × điểm × hệ số Đánh.
 * T = số cặp khớp theo phạm vi và vị trí chữ số của công thức × điểm × hệ số Trúng.
 *
 * ĐA/ĐB: listing 2 hoặc 3 chữ số, đồng nhất trong một bản ghi;
 * D = điểm × hệ số Đánh; T = số mục khớp trong GĐB × điểm × hệ số Trúng theo độ rộng 2/3 chữ số.
 * XA/XB:
 * D = điểm × hệ số Đánh theo độ dài danh sách (2–4 số).
 * T = điểm × hệ số Trúng theo độ dài danh sách, trả một lần khi mọi số trong danh sách đều khớp.
 */
export function calculateSetting(
  input: SettingCalculationInput,
): SettingCalculationResult {
  // Validate with the selected formula before selecting its listing width rules.
  const formulaId = input.formulaId ?? 'lb'
  const { listing, oneToSeven, gdb } = validateCalculationInput(input, formulaId)

  // Tổng hợp dữ liệu đầu vào của phép tính T.
  const gdbOnlyFormula = formulaId === 'da' || formulaId === 'db' || formulaId === 'ca' || formulaId === 'cb'
  const compoundFormula = formulaId === 'xa' || formulaId === 'xb'
  if (compoundFormula && (listing.length < 2 || listing.length > 4)) {
    throw new Error('XA/XB yêu cầu đúng 2, 3 hoặc 4 số trong ô Liệt kê.')
  }
  const inputRecords = gdbOnlyFormula
    ? (gdb === '' ? [] : [gdb])
    : (gdb === '' ? oneToSeven : [...oneToSeven, gdb])

  const getComparableNumber = (record: string): string => {
    switch (formulaId) {
      case 'la':
      case 'xa': return record.slice(0, 2)
      case 'da': return record.slice(0, listing[0]?.length ?? 2)
      case 'ca': return record.slice(1, 3)
      case 'cb': return record.slice(2, 4)
      case 'lb':
      case 'xb': return record.slice(-2)
      case 'db': return record.slice(-(listing[0]?.length ?? 2))
    }
  }

  // ----------------------------------------------------------
  // Đếm tổng số cặp khớp theo công thức.
  // ----------------------------------------------------------

  const listingMatchFlags = input.listing.map((listingNumber) => (
    listingNumber !== '' && inputRecords.some((record) => getComparableNumber(record) === listingNumber)
  ))

  // XA/XB are combination-style formulas: every number in the selected
  // 2–4-number list must appear at least once in the draw. A successful
  // combination pays once, not once per matched pair.
  const matchingPairCount = compoundFormula
    ? (listing.length > 0 && listing.every((listingNumber) => inputRecords.some((record) => getComparableNumber(record) === listingNumber)) ? 1 : 0)
    : listing.reduce(
        (total, listingNumber) => total + inputRecords.filter((record) => getComparableNumber(record) === listingNumber).length,
        0,
      )

  // ----------------------------------------------------------
  // Xác định từng số trong danh sách có cần tô đỏ hay không.
  //
  // Dùng input.listing gốc để giữ đúng vị trí từng dòng.
  // Một số chỉ cần khớp ít nhất một bản ghi là được tô đỏ.
  // ----------------------------------------------------------


  // ----------------------------------------------------------
  // Tính D.
  // ----------------------------------------------------------

  const fixedStakeFormula = compoundFormula || formulaId === 'da' || formulaId === 'db'
  const d =
    (fixedStakeFormula ? 1 : listing.length) *
    input.point *
    input.coefficientD

  // ----------------------------------------------------------
  // Tính T.
  //
  // Không có 1-7 và GĐB:
  // T = null, nghĩa là chưa có dữ liệu để tính.
  //
  // Có dữ liệu nhưng không có cặp khớp:
  // T = 0.
  // ----------------------------------------------------------

  const t =
    inputRecords.length === 0
      ? null
      : matchingPairCount *
        input.point *
        input.coefficientT

  return {
    d,
    t,
    listingCount: listing.length,
    inputRecordCount: inputRecords.length,
    matchingPairCount,
    listingMatchFlags,
  }
}
