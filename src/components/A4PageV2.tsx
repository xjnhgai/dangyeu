import { paperPages, PAPER_COLUMN_WIDTH } from '../core/paper-sections'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { A4ProjectionV2 } from '../core/a4-v2'
import type { A4SummaryV2 } from '../core/summary-v2'
import type { SettingCalculationResult } from '../core/calculation'
import { splitSeparatedValuesV2 } from '../core/workspace-calculator-v2'
import '../styles/A4PageV2.css'
import { clampPaperZoom } from '../core/paper-zoom'

function formatAmount(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(value)
}

interface A4PageV2Props {
  projection: A4ProjectionV2
  summary?: A4SummaryV2
  results: ReadonlyMap<string, SettingCalculationResult>
  showCalculation?: boolean
  zoom?: number
  onZoomChange?: (nextZoom: number) => void
  centerInViewport?: boolean
  onBack?: () => void
  fitRequest?: number
}

export default function A4PageV2({ projection, summary, results, showCalculation = true, zoom = 1, onZoomChange, centerInViewport = false, fitRequest = 0, onBack }: A4PageV2Props) {
  const safeZoom = clampPaperZoom(zoom)
  const pageRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomCallbackRef = useRef(onZoomChange)
  const currentZoomRef = useRef(safeZoom)
  const [paperSize, setPaperSize] = useState(() => ({ width: Math.min(794, window.innerWidth), minHeight: window.innerHeight - 61 }))
  const headerRef = useRef<HTMLElement>(null)
  const initializedSize = useRef(false)
  const lastWindowWidth = useRef(window.innerWidth)
  const [contentTop, setContentTop] = useState(projection.mode === 'group2' ? 82 : 64)
  const [titleHeights, setTitleHeights] = useState<Record<string, number>>({})
  const layout = paperPages(projection.sections, paperSize.width, paperSize.minHeight, contentTop, titleHeights)
  const pageHeight = layout.pages.length * (paperSize.minHeight + 12) - 12
  const pendingAnchorRef = useRef<{ x: number; y: number; clientX: number; clientY: number; zoom: number } | null>(null)
  const alignPinchRef = useRef<() => void>(() => {})
  useLayoutEffect(() => {
    const align = () => {
      const anchor = pendingAnchorRef.current
      const page = pageRef.current
      const viewport = viewportRef.current
      if (!anchor || !page || !viewport || anchor.zoom !== safeZoom) return
      const rect = page.getBoundingClientRect()
      viewport.scrollLeft += rect.left + anchor.x * safeZoom - anchor.clientX
      viewport.scrollTop += rect.top + anchor.y * safeZoom - anchor.clientY
      pendingAnchorRef.current = null
    }
    alignPinchRef.current = align
    align()
  }, [safeZoom])

  useLayoutEffect(() => {
    if (fitRequest > 0) {
      currentZoomRef.current = 1
      zoomCallbackRef.current?.(1)
    }
  }, [fitRequest])

  useEffect(() => {
    zoomCallbackRef.current = onZoomChange
    currentZoomRef.current = safeZoom
  }, [onZoomChange, safeZoom])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    let initialDistance = 0
    let initialZoom = currentZoomRef.current
    let anchor = { x: 0, y: 0 }

    const distance = (touches: TouchList) => {
      const dx = touches[0]!.clientX - touches[1]!.clientX
      const dy = touches[0]!.clientY - touches[1]!.clientY
      return Math.hypot(dx, dy)
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault()
        initialDistance = distance(event.touches)
        initialZoom = currentZoomRef.current
        const rect = pageRef.current?.getBoundingClientRect()
        const midX = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2
        const midY = (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2
        anchor = { x: (midX - (rect?.left ?? 0)) / initialZoom, y: (midY - (rect?.top ?? 0)) / initialZoom }
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && initialDistance > 0) {
        event.preventDefault()
        const ratio = distance(event.touches) / initialDistance
        const nextZoom = clampPaperZoom(initialZoom * ratio)
        pendingAnchorRef.current = { ...anchor, clientX: (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2, clientY: (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2, zoom: nextZoom }
        currentZoomRef.current = nextZoom
        zoomCallbackRef.current?.(nextZoom)
        requestAnimationFrame(() => alignPinchRef.current())
      }
    }

    const handleTouchEnd = () => {
      initialDistance = 0
    }

    viewport.addEventListener('touchstart', handleTouchStart, { passive: false })
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false })
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true })
    viewport.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart)
      viewport.removeEventListener('touchmove', handleTouchMove)
      viewport.removeEventListener('touchend', handleTouchEnd)
      viewport.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  useLayoutEffect(() => {
    const page = pageRef.current
    const viewport = viewportRef.current
    if (!page || !viewport) return
    const update = () => {
      const width = Math.min(794, viewport.clientWidth || window.innerWidth)
      const establishHeight = !initializedSize.current || lastWindowWidth.current !== window.innerWidth
      initializedSize.current = true
      lastWindowWidth.current = window.innerWidth
      const visibleHeight = Math.max(240, viewport.clientHeight || window.innerHeight - 61)
      setPaperSize(current => {
        // Data, scrollbar and keyboard changes never resize the physical sheet.
        const minHeight = establishHeight ? visibleHeight : current.minHeight
        return current.width === width && current.minHeight === minHeight ? current : { width, minHeight }
      })
      const header = headerRef.current
      const top = header?.offsetHeight ? header.offsetTop + header.offsetHeight + 20 : projection.mode === 'group2' ? 82 : 64
      setContentTop(current => current === top ? current : top)
      const measured: Record<string, number> = {}
      viewport.querySelectorAll<HTMLElement>('[data-paper-type-title]').forEach(title => {
        if (!title.offsetHeight) return
        const style = getComputedStyle(title)
        measured[title.dataset.paperTypeTitle!] = title.offsetHeight + parseFloat(style.marginBottom || '0') + parseFloat(style.marginTop || '0')
      })
      setTitleHeights(current => JSON.stringify(current) === JSON.stringify(measured) ? current : measured)
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(page); observer?.observe(viewport)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update) }
  }, [projection, summary, showCalculation, fitRequest, paperSize])

  return (
    <div className={`a4-v2-scroll${centerInViewport && safeZoom === 1 ? ' is-fit-page' : ''}`} ref={viewportRef}>
      <div
        className="a4-v2-zoom-frame"
        style={{
          width: `${paperSize.width * safeZoom}px`,
          height: `${pageHeight * safeZoom}px`,
        }}
      >
        {layout.pages.map((sections, pageIndex) => <article
          key={pageIndex}
          ref={pageIndex === 0 ? pageRef : undefined}
          className="a4-v2-page"
          style={{ width: `${paperSize.width}px`, height: `${paperSize.minHeight}px`, minHeight: `${paperSize.minHeight}px`, top: `${pageIndex * (paperSize.minHeight + 12) * safeZoom}px`, transform: `scale(${safeZoom})` }}
        >
          {onBack && pageIndex === 0 && <button type="button" className="paper-back" onClick={onBack} aria-label="Quay lại">←</button>}
          <header ref={pageIndex === 0 ? headerRef : undefined} className="a4-v2-header">
            <h1>{projection.group1.dateLabel}</h1>
            {projection.mode === 'group2' && projection.group2 && (
              <h2>{projection.group2.name}</h2>
            )}
          </header>

          {projection.sections.length === 0 ? (
            <div className="a4-v2-empty">Chưa có thiết lập hoàn chỉnh để hiển thị.</div>
          ) : (
            <div className="a4-v2-sections" style={{ gridTemplateColumns: `repeat(${layout.columns}, ${PAPER_COLUMN_WIDTH}px)`, height: `${layout.columnHeight}px` }}>
              {sections.map((section) => {
                const sectionSummary = summary?.sections.find((item) => item.settingTypeId === section.settingTypeId)
                const sectionPointTotal = section.pointTotal
                const sectionResultsVisible = showCalculation && sectionSummary !== undefined && section.last
                return (
                  <section className={`a4-v2-section${section.newRow ? " continuation-start" : ""}`} key={`${section.settingTypeId}-${section.index}`}>
                    <h3 data-paper-type-title={section.settingTypeId}>{section.title}</h3>
                    <div className="a4-v2-entry-list">
                      {section.entries.map(({entry,start,end,showPoint}) => {
                        const result = results.get(entry.group3.id)
                        const values = entry.group3.specialListing ? [`kép ${entry.settingType.formulaId === 'da' ? 'A' : 'B'}`] : splitSeparatedValuesV2(entry.group3.listing).slice(start,end)
                        return (
                          <div className="a4-v2-entry" key={`${entry.group3.id}-${start}`}>
                            <div className="a4-v2-entry-main">
                              <div className="a4-v2-listing" aria-label="Danh sách">
                                {values.length === 0 ? (
                                  <span className="a4-v2-muted">—</span>
                                ) : values.map((value, index) => (
                                  <span
                                    className={(entry.group3.specialListing ? result?.listingMatchFlags.some(Boolean) : result?.listingMatchFlags[start+index]) ? 'a4-v2-number is-matched' : 'a4-v2-number'}
                                    key={`${entry.group3.id}-${index}`}
                                  >
                                    {value}
                                  </span>
                                ))}
                              </div>
                              <span className="a4-v2-entry-divider" aria-hidden="true" />
                              <strong className="a4-v2-point">{showPoint ? entry.group3.point || '—' : ''}</strong>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div
                      className={`a4-v2-section-results${sectionResultsVisible ? ' is-visible' : ''}`}
                      aria-label={`Tổng Điểm, Đánh và Trúng của nhóm ${section.title}`}
                      aria-hidden={!sectionResultsVisible}
                    >
                      <span className="a4-v2-result-point"><span className="a4-v2-result-label">Điểm:</span><b>{sectionResultsVisible ? formatAmount(sectionPointTotal) : '\u00a0'}</b></span>
                      <span className="a4-v2-result-d"><span className="a4-v2-result-label">Đánh:</span><b>{sectionResultsVisible ? formatAmount(sectionSummary.totals.d) : '\u00a0'}</b></span>
                      <span className="a4-v2-result-t"><span className="a4-v2-result-label">Trúng:</span><b>{sectionResultsVisible ? formatAmount(sectionSummary.totals.t) : '\u00a0'}</b></span>
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {pageIndex === layout.pages.length - 1 && <footer className={`a4-v2-total-area${showCalculation && summary ? '' : ' is-placeholder'}`} aria-hidden={!showCalculation || !summary}>
            <div><span>Tổng Đánh</span><strong>{showCalculation && summary ? formatAmount(summary.totals.d) : '\u00a0'}</strong></div>
            <div><span>Tổng Trúng</span><strong>{showCalculation && summary ? formatAmount(summary.totals.t) : '\u00a0'}</strong></div>
            <div className="a4-v2-difference" aria-label={showCalculation && summary ? `Trúng trừ Đánh: ${formatAmount(summary.totals.difference)}` : undefined}><strong>{showCalculation && summary ? formatAmount(summary.totals.difference) : '\u00a0'}</strong></div>
          </footer>}
        </article>)}
      </div>
    </div>
  )
}
