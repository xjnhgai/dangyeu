import type { EntityId } from './models-v2'
import type { SettingCalculationResult } from './calculation'
import type { A4ProjectionV2, A4ProjectionSectionV2 } from './a4-v2'

export interface CalculationTotalsV2 {
  settingCount: number
  d: number
  t: number | null
  difference: number | null
}

export interface A4SectionSummaryV2 {
  settingTypeId: EntityId
  title: string
  totals: CalculationTotalsV2
}

export interface A4SummaryV2 {
  mode: A4ProjectionV2['mode']
  sections: A4SectionSummaryV2[]
  totals: CalculationTotalsV2
}

export class SummaryV2Error extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SummaryV2Error'
    this.code = code
  }
}

function hasAnyDrawData(projection: A4ProjectionV2): boolean {
  return projection.group1.drawData.oneToSeven.some((value) => value !== '')
    || projection.group1.drawData.gdb !== ''
}

function sumEntries(
  section: A4ProjectionSectionV2 | null,
  projection: A4ProjectionV2,
  results: ReadonlyMap<EntityId, SettingCalculationResult>,
): CalculationTotalsV2 {
  const entries = section ? section.entries : projection.entries
  let d = 0
  let t = 0
  let allTAvailable = entries.length > 0 || hasAnyDrawData(projection)

  for (const entry of entries) {
    const id = entry.group3.id
    const result = results.get(id)
    if (!result) {
      throw new SummaryV2Error('RESULT_NOT_FOUND', `Thiếu kết quả tính toán của thiết lập ${id}.`)
    }
    if (!Number.isFinite(result.d)) {
      throw new SummaryV2Error('INVALID_D_RESULT', `Kết quả D không hợp lệ: ${id}.`)
    }
    d += result.d

    // Different formulas have different draw scopes. A missing GĐB, for
    // example, leaves ĐA/ĐB unavailable even when 1–7 has already arrived.
    if (result.t === null) {
      allTAvailable = false
    } else if (Number.isFinite(result.t)) {
      t += result.t
    } else {
      throw new SummaryV2Error('INVALID_T_RESULT', `Kết quả T không hợp lệ: ${id}.`)
    }
  }

  const totalT = allTAvailable ? t : null
  return {
    settingCount: entries.length,
    d,
    t: totalT,
    difference: totalT === null ? null : totalT - d,
  }
}

/** Summarize per setting type and for the whole selected A4 page. */
export function buildA4SummaryV2(
  projection: A4ProjectionV2,
  results: ReadonlyMap<EntityId, SettingCalculationResult>,
): A4SummaryV2 {
  const sections = projection.sections.map((section) => ({
    settingTypeId: section.settingTypeId,
    title: section.title,
    totals: sumEntries(section, projection, results),
  }))
  const totals = sumEntries(null, projection, results)

  return { mode: projection.mode, sections, totals }
}
