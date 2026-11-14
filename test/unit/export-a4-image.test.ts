import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportA4Images } from '../../src/core/export-a4-image'
import { buildA4ProjectionV2 } from '../../src/core/a4-v2'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import type { A4SummaryV2 } from '../../src/core/summary-v2'

interface DrawCall { text?: string; x: number; y: number; font?: string; color?: unknown; divider?: boolean }
function canvasRecorder() {
  const pages: DrawCall[][] = []
  vi.stubGlobal('document', { createElement: () => {
    const calls: DrawCall[] = []; pages.push(calls)
    const context = {
      font: '10px sans-serif', fillStyle: '',
      fillRect() {}, beginPath() {}, lineTo() {}, stroke() {},
      moveTo(x: number, y: number) { calls.push({ x, y, divider: true }) },
      measureText(text: string) { return { width: text.length * Number(/(\d+)px/.exec(this.font)?.[1] ?? 10) * .55 } },
      fillText(text: string, x: number, y: number) { calls.push({ text, x, y, font: this.font, color: this.fillStyle }) },
    }
    return { getContext: () => context, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })) }
  } })
  return pages
}
function projection(listing = '123, 456') {
  const data = createCalculationDataV2()
  data.groups1.push({ kind: 'group1', id: 'a4', dateLabel: '14/11/2026', drawData: { oneToSeven: [], gdb: '' }, groups2: [{ kind: 'group2', id: 'g2', name: 'Lan', groups3: [{ kind: 'group3', id: 'row', settingTypeId: 'setting-type-3', listing, point: '7', coefficientD: '1', coefficientT: '2' }] }] })
  return buildA4ProjectionV2(data, { mode: 'combined', group1Id: 'a4' })
}
const summary: A4SummaryV2 = { mode: 'combined', sections: [{ settingTypeId: 'setting-type-3', title: 'ĐA', totals: { settingCount: 1, d: 7, t: 0, difference: -7 } }], totals: { settingCount: 1, d: 7, t: 0, difference: -7 } }
afterEach(() => vi.unstubAllGlobals())

describe('A4 JPEG export', () => {
  it('draws three-digit listings before the divider using their actual font width', async () => {
    const pages = canvasRecorder()
    await exportA4Images(projection(), summary, new Map(), true)
    const number = pages[0].find((call) => call.text === '123')!
    const divider = pages[0].find((call) => call.divider)!
    expect(number.font).toContain('22px')
    expect(number.x + 3 * 22 * .55).toBeLessThan(divider.x)
  })
  it('includes the same section Point/D/T fields as the on-screen projection', async () => {
    const pages = canvasRecorder()
    const files = await exportA4Images(projection(), summary, new Map(), true)
    const texts = pages.flat().map((call) => call.text)
    expect(texts).toContain('Điểm:')
    expect(texts).toContain('Đánh:')
    expect(texts).toContain('Trúng:')
    const label = pages[0].find((call) => call.text === 'Điểm:')!
    expect(pages[0].find((call) => call.y === label.y && call.x > label.x)?.text).toBe('7')
    expect(files[0].name).toBe('A4-14-11-2026.jpg')
    expect(files[0].type).toBe('image/jpeg')
  })
  it('exports a long list across pages without dropping entries or drawing hidden results', async () => {
    const pages = canvasRecorder()
    const listing = Array.from({ length: 200 }, (_, index) => String(index % 100).padStart(2, '0')).join(', ')
    const files = await exportA4Images(projection(listing), undefined, new Map(), false)
    expect(files.length).toBeGreaterThan(1)
    const numbers = pages.flat().filter((call) => /^\d{2}$/.test(call.text ?? ''))
    expect(numbers.map((call) => call.text)).toEqual(listing.split(', '))
    expect(pages.flat().some((call) => call.text === 'Điểm:')).toBe(false)
    expect(pages.flat().some((call) => call.text === 'Đánh:')).toBe(false)
    expect(files[0].name).toBe('A4-14-11-2026-01.jpg')
  })
})
