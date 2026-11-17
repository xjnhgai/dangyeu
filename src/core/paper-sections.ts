import type { A4ProjectionSectionV2 } from './a4-v2'
import { splitSeparatedValuesV2, parseSettingNumberListV2 } from './workspace-calculator-v2'

export const PAPER_COLUMN_WIDTH = 14.88 * 96 / 25.4
const TITLE_HEIGHT = 24
const RESULTS_HEIGHT = 30
const NUMBER_HEIGHT = 9.5
const ENTRY_PADDING = 8

/** A column budget includes its title and all three aligned result rows. */
export function paperSections(sections: A4ProjectionSectionV2[], columnHeight = 294, titleHeights: Record<string, number> = {}) {
  return sections.flatMap(section => {
    const titleHeight = titleHeights[section.settingTypeId] ?? TITLE_HEIGHT
    const budget = Math.max(NUMBER_HEIGHT + ENTRY_PADDING, columnHeight - titleHeight - RESULTS_HEIGHT)
    const chunks: { entries: { entry: A4ProjectionSectionV2['entries'][number]; start: number; end: number; showPoint: boolean }[]; used: number }[] = [{ entries: [], used: 0 }]
    for (const entry of section.entries) {
      const count = entry.group3.specialListing ? 1 : Math.max(1, splitSeparatedValuesV2(entry.group3.listing).length)
      const entryHeight = count * NUMBER_HEIGHT + ENTRY_PADDING
      if (chunks.at(-1)!.used && entryHeight <= budget && chunks.at(-1)!.used + entryHeight > budget) chunks.push({ entries: [], used: 0 })
      for (let start = 0; start < count;) {
        if (budget - chunks.at(-1)!.used < NUMBER_HEIGHT + ENTRY_PADDING) chunks.push({ entries: [], used: 0 })
        const chunk = chunks.at(-1)!
        const end = Math.min(count, start + Math.max(1, Math.floor((budget - chunk.used - ENTRY_PADDING) / NUMBER_HEIGHT)))
        chunk.entries.push({ entry, start, end, showPoint: (count - 1) / 2 >= start && (count - 1) / 2 < end })
        chunk.used += (end - start) * NUMBER_HEIGHT + ENTRY_PADDING
        start = end
      }
    }
    return chunks.map((chunk, index) => ({
      ...section, ...chunk, index, last: index === chunks.length - 1, newRow: false,
      height: titleHeight + chunk.used + RESULTS_HEIGHT,
      pointTotal: section.entries.reduce((sum, entry) => sum + (['xa', 'xb'].includes(entry.settingType.formulaId) ? 1 : parseSettingNumberListV2(entry.group3.listing, entry.settingType.formulaId).length) * (Number(entry.group3.point) || 0), 0),
    }))
  })
}

/** Extra content becomes extra fixed-size sheets, never a taller or wider sheet. */
export function paperPages(sections: A4ProjectionSectionV2[], width: number, height: number, contentTop: number, titleHeights: Record<string, number> = {}) {
  const contentBottom = Math.min(height * 0.9, height - 50)
  const columnHeight = Math.max(72, contentBottom - contentTop)
  const columns = Math.max(1, Math.floor((width - 20) / PAPER_COLUMN_WIDTH))
  const chunks = paperSections(sections, columnHeight, titleHeights)
  const pages = Array.from({ length: Math.max(1, Math.ceil(chunks.length / columns)) }, (_, index) => chunks.slice(index * columns, (index + 1) * columns))
  return { pages, columns, columnHeight, contentBottom }
}
