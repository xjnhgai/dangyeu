import { describe, expect, it } from 'vitest'
import type { CalculationDataV2, Group1, Group3 } from '../../src/core/models-v2'
import { addGroup1V2, addGroup2V2, addGroup3V2, createCalculationDataV2 } from '../../src/core/tree-v2'
import { calculateWorkspaceForA4V2 } from '../../src/core/workspace-calculator-v2'
import { buildA4SummaryV2, SummaryV2Error } from '../../src/core/summary-v2'
import { buildA4ProjectionV2 } from '../../src/core/a4-v2'

function sample(drawData: Group1['drawData'] = { oneToSeven: ['0012', '0023'], gdb: '' }): CalculationDataV2 {
  let data = createCalculationDataV2()
  data = addGroup1V2(data, { kind: 'group1', id: 'date', dateLabel: '12/11', drawData, groups2: [] })
  data = addGroup2V2(data, 'date', { kind: 'group2', id: 'g1', name: 'Obito', groups3: [] })
  data = addGroup2V2(data, 'date', { kind: 'group2', id: 'g2', name: 'Obita', groups3: [] })
  const a: Group3 = { kind: 'group3', id: 'a', settingTypeId: 'setting-type-1', listing: '12', point: '2', coefficientD: '3', coefficientT: '5' }
  const b: Group3 = { kind: 'group3', id: 'b', settingTypeId: 'setting-type-1', listing: '23', point: '1', coefficientD: '4', coefficientT: '2' }
  data = addGroup3V2(data, 'date', 'g1', a)
  data = addGroup3V2(data, 'date', 'g2', b)
  return data
}

describe('A4 summary V2', () => {
  it('sums D and T by type and across all groups in combined mode', () => {
    const result = calculateWorkspaceForA4V2(sample(), { mode: 'combined', group1Id: 'date' })
    expect(result.summary.sections).toHaveLength(1)
    expect(result.summary.sections[0]!.title).toBe('LB')
    expect(result.summary.sections[0]!.totals).toEqual({ settingCount: 2, d: 10, t: 12, difference: 2 })
    expect(result.summary.totals).toEqual({ settingCount: 2, d: 10, t: 12, difference: 2 })
  })

  it('sums only the selected Group2 in individual mode', () => {
    const result = calculateWorkspaceForA4V2(sample(), { mode: 'group2', group1Id: 'date', group2Id: 'g2' })
    expect(result.summary.totals).toEqual({ settingCount: 1, d: 4, t: 2, difference: -2 })
  })

  it('keeps T and difference null when draw results are empty', () => {
    const result = calculateWorkspaceForA4V2(sample({ oneToSeven: [], gdb: '' }), { mode: 'combined', group1Id: 'date' })
    expect(result.summary.totals.d).toBe(10)
    expect(result.summary.totals.t).toBeNull()
    expect(result.summary.totals.difference).toBeNull()
  })

  it('keeps GĐB-only formulas unavailable when only 1–7 has arrived', () => {
    let data = sample({ oneToSeven: ['0012', '0023'], gdb: '' })
    data = addGroup3V2(data, 'date', 'g1', {
      kind: 'group3', id: 'da', settingTypeId: 'setting-type-3',
      listing: '12', point: '1', coefficientD: '1', coefficientT: '1',
    })
    data = addGroup3V2(data, 'date', 'g1', {
      kind: 'group3', id: 'db', settingTypeId: 'setting-type-4',
      listing: '23', point: '1', coefficientD: '1', coefficientT: '1',
    })

    const result = calculateWorkspaceForA4V2(data, { mode: 'combined', group1Id: 'date' })
    expect(result.settingResults.get('da')?.t).toBeNull()
    expect(result.settingResults.get('db')?.t).toBeNull()
    expect(result.summary.sections.find((section) => section.title === 'LB')?.totals.t).toBe(12)
    expect(result.summary.sections.find((section) => section.title === 'ĐA')?.totals.t).toBeNull()
    expect(result.summary.sections.find((section) => section.title === 'ĐB')?.totals.t).toBeNull()
    // Do not show an incomplete combined T as though all formula scopes were ready.
    expect(result.summary.totals.t).toBeNull()
    expect(result.summary.totals.difference).toBeNull()
  })

  it('rejects a missing calculation result instead of silently understating totals', () => {
    const result = calculateWorkspaceForA4V2(sample(), { mode: 'combined', group1Id: 'date' })
    const broken = new Map(result.settingResults)
    broken.delete('a')
    const projection = buildA4ProjectionV2(sample(), { mode: 'combined', group1Id: 'date' })
    expect(() => buildA4SummaryV2(projection, broken)).toThrow(SummaryV2Error)
  })
})
