import type { A4ProjectionV2 } from './a4-v2'
import type { SettingCalculationResult } from './calculation'
import type { A4SummaryV2 } from './summary-v2'
import { splitSeparatedValuesV2 } from './workspace-calculator-v2'

const WIDTH = 2480
const HEIGHT = 3508
const MARGIN_X = 142
const MARGIN_TOP = 150
const MARGIN_BOTTOM = 160
const COLUMN_STEP = (24.8 / 25.4) * 300
const COLUMN_COUNT = Math.max(1, Math.floor((WIDTH - MARGIN_X * 2) / COLUMN_STEP))
const ROW_GAP = 12
const CONTENT_BOTTOM = HEIGHT - MARGIN_BOTTOM

interface ExportPage {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  columnY: number[]
  nextColumn: number
  contentTop: number
}

function amount(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(value)
}

function createPage(projection: A4ProjectionV2): ExportPage {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không hỗ trợ xuất ảnh A4.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  context.fillStyle = '#1d2734'
  context.textBaseline = 'top'
  context.textAlign = 'center'
  context.font = '700 66px Arial, Helvetica, sans-serif'
  context.fillText(projection.group1.dateLabel, WIDTH / 2, MARGIN_TOP)
  let contentTop = MARGIN_TOP + 112
  if (projection.mode === 'group2' && projection.group2) {
    context.font = '600 49px Arial, Helvetica, sans-serif'
    context.fillText(projection.group2.name, WIDTH / 2, contentTop)
    contentTop += 85
  }
  return { canvas, context, columnY: Array.from({ length: COLUMN_COUNT }, () => contentTop), nextColumn: 0, contentTop }
}

function drawSectionTitle(context: CanvasRenderingContext2D, x: number, y: number, title: string): number {
  context.textAlign = 'left'
  context.fillStyle = '#1d2734'
  context.font = '700 43px Arial, Helvetica, sans-serif'
  context.fillText(title, x, y)
  y += 61
  return y + 20
}

const ENTRY_LINE_HEIGHT = 45
const SECTION_RESULT_HEIGHT = 84

function drawEntrySlice(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  entry: A4ProjectionV2['entries'][number],
  result: SettingCalculationResult | undefined,
  values: string[],
  startIndex: number,
  endIndex: number,
  pointCenterIndex: number,
): number {
  const lineCount = Math.max(1, endIndex - startIndex)
  const listingHeight = lineCount * ENTRY_LINE_HEIGHT
  const listingWidth = Math.max(context.measureText('00').width, context.measureText('—').width)
  const characterGap = context.measureText('0').width
  const dividerX = x + listingWidth + characterGap * 0.35

  for (let index = startIndex; index < endIndex; index += 1) {
    const value = values[index]
    if (value === undefined) continue
    const isMatched = result?.listingMatchFlags[index] ?? false
    context.fillStyle = isMatched ? '#c62828' : '#1d2734'
    context.font = isMatched ? '700 35px Arial, Helvetica, sans-serif' : '500 35px Arial, Helvetica, sans-serif'
    context.textAlign = 'left'
    context.fillText(value, x, y + (index - startIndex) * ENTRY_LINE_HEIGHT)
  }

  if (!values.length) {
    context.fillStyle = '#9ba4b0'
    context.font = '35px Arial, Helvetica, sans-serif'
    context.textAlign = 'left'
    context.fillText('—', x, y)
  }

  context.strokeStyle = '#cfd6df'
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(dividerX, y - 2)
  context.lineTo(dividerX, y + (lineCount - 1) * ENTRY_LINE_HEIGHT + 38)
  context.stroke()

  if (pointCenterIndex >= startIndex && pointCenterIndex < endIndex) {
    context.fillStyle = '#1d2734'
    context.font = '28px Arial, Helvetica, sans-serif'
    context.textAlign = 'left'
    context.fillText(entry.group3.point || '—', dividerX + characterGap * 0.35, y + (pointCenterIndex - startIndex) * ENTRY_LINE_HEIGHT + 4)
  }

  return y + listingHeight + 12
}

function drawSectionTotals(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  summary: A4SummaryV2['sections'][number] | undefined,
  showCalculation: boolean,
): number {
  // Reserve the exact same slot when calculation is hidden to prevent reflow.
  if (showCalculation && summary) {
    context.textAlign = 'left'
    context.font = '32px Arial, Helvetica, sans-serif'
    context.fillStyle = '#1769aa'
    const valueX = x + context.measureText('Trúng:').width + context.measureText(' ').width
    context.fillText('Đánh:', x, y)
    context.fillText(amount(summary.totals.d), valueX, y)
    context.fillText('Trúng:', x, y + 40)
    context.fillText(amount(summary.totals.t), valueX, y + 40)
  }
  return y + SECTION_RESULT_HEIGHT
}

function drawPageTotals(context: CanvasRenderingContext2D, y: number, summary: A4SummaryV2): void {
  const cells = [
    { label: 'Đánh', value: amount(summary.totals.d), showLabel: true },
    { label: 'Trúng', value: amount(summary.totals.t), showLabel: true },
    { label: '', value: amount(summary.totals.difference), showLabel: false },
  ]
  const cellWidth = (WIDTH - MARGIN_X * 2) / 3
  cells.forEach((cell, index) => {
    const cx = MARGIN_X + index * cellWidth + cellWidth / 2
    context.textAlign = 'center'
    if (cell.showLabel) {
      context.fillStyle = '#697689'
      context.font = '30px Arial, Helvetica, sans-serif'
      context.fillText(cell.label, cx, y + 24)
    }
    context.fillStyle = '#1d2734'
    context.font = '700 43px Arial, Helvetica, sans-serif'
    context.fillText(cell.value, cx, y + 66)
  })
}

async function canvasToFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Không thể tạo tệp ảnh A4.')), 'image/jpeg', 0.96)
  })
  return new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() })
}

/**
 * Export the full A4 content as one or more 2480×3508 JPEG files.
 * Each file represents one A4 page at a 300-DPI pixel size.
 */
export async function exportA4Images(
  projection: A4ProjectionV2,
  summary: A4SummaryV2 | undefined,
  results: ReadonlyMap<string, SettingCalculationResult>,
  showCalculation: boolean,
): Promise<File[]> {
  const pages: ExportPage[] = [createPage(projection)]
  let page = pages[0]!

  if (!projection.sections.length) {
    page.context.fillStyle = '#8994a3'
    page.context.font = '36px Arial, Helvetica, sans-serif'
    page.context.textAlign = 'center'
    page.context.fillText('Chưa có thiết lập hoàn chỉnh để hiển thị.', WIDTH / 2, page.contentTop + 100)
  }

  for (const section of projection.sections) {
    if (page.nextColumn >= COLUMN_COUNT) {
      const nextRowTop = Math.max(...page.columnY) + ROW_GAP
      if (nextRowTop + ENTRY_LINE_HEIGHT > CONTENT_BOTTOM) {
        page = createPage(projection)
        pages.push(page)
      } else {
        page.columnY = Array.from({ length: COLUMN_COUNT }, () => nextRowTop)
        page.nextColumn = 0
      }
    }
    let column = page.nextColumn
    page.nextColumn += 1
    let x = MARGIN_X + column * COLUMN_STEP
    let y = page.columnY[column]!
    y = drawSectionTitle(page.context, x, y, section.title)

    for (const entry of section.entries) {
      const values = splitSeparatedValuesV2(entry.group3.listing)
      const totalRows = Math.max(1, values.length)
      const pointCenterIndex = values.length ? (values.length - 1) / 2 : 0
      let nextIndex = 0

      while (nextIndex < totalRows) {
        const availableRows = Math.floor((CONTENT_BOTTOM - y - 12) / ENTRY_LINE_HEIGHT)
        if (availableRows <= 0) {
          page.columnY[column] = y
          page = createPage(projection)
          pages.push(page)
          column = 0
          page.nextColumn = 1
          x = MARGIN_X
          y = drawSectionTitle(page.context, x, page.contentTop, section.title)
          continue
        }

        const entryResult = results.get(entry.group3.id)
        const rowsRemaining = totalRows - nextIndex
        const rowsToDraw = Math.min(rowsRemaining, availableRows)
        const endIndex = Math.min(totalRows, nextIndex + rowsToDraw)
        y = drawEntrySlice(
          page.context,
          x,
          y,
          entry,
          entryResult,
          values,
          nextIndex,
          endIndex,
          pointCenterIndex,
        )
        nextIndex = endIndex

        if (nextIndex < totalRows) {
          page.columnY[column] = y
          page = createPage(projection)
          pages.push(page)
          column = 0
          page.nextColumn = 1
          x = MARGIN_X
          y = drawSectionTitle(page.context, x, page.contentTop, section.title)
        }
      }
    }

    const sectionSummary = summary?.sections.find((item) => item.settingTypeId === section.settingTypeId)
    if (y + SECTION_RESULT_HEIGHT > CONTENT_BOTTOM) {
      page.columnY[column] = y
      page = createPage(projection)
      pages.push(page)
      column = 0
      page.nextColumn = 1
      x = MARGIN_X
      y = drawSectionTitle(page.context, x, page.contentTop, section.title)
    }
    y = drawSectionTotals(page.context, x, y, sectionSummary, showCalculation)
    page.columnY[column] = y + 16
  }

  if (showCalculation && summary) {
    let footerY = Math.max(...page.columnY) + 45
    if (footerY + 125 > CONTENT_BOTTOM) {
      page = createPage(projection)
      pages.push(page)
      footerY = page.contentTop + 45
    }
    drawPageTotals(page.context, footerY, summary)
  }

  const safeDate = projection.group1.dateLabel.replaceAll('/', '-')
  return Promise.all(pages.map((item, index) => {
    const suffix = pages.length > 1 ? `-${String(index + 1).padStart(2, '0')}` : ''
    return canvasToFile(item.canvas, `A4-${safeDate}${suffix}.jpg`)
  }))
}
