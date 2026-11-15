import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { A4ProjectionV2 } from '../core/a4-v2'
import type { A4SummaryV2 } from '../core/summary-v2'
import type { SettingCalculationResult } from '../core/calculation'
import { splitSeparatedValuesV2 } from '../core/workspace-calculator-v2'
import '../styles/A4PageV2.css'

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
  const safeZoom = Math.max(0.03, Math.min(1, zoom))
  const pageRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomCallbackRef = useRef(onZoomChange)
  const currentZoomRef = useRef(safeZoom)
  const [paperSize, setPaperSize] = useState(() => ({ width: Math.min(794, window.innerWidth), minHeight: window.innerHeight - 12 }))
  const [pageHeight, setPageHeight] = useState(0)

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
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && initialDistance > 0) {
        event.preventDefault()
        const ratio = distance(event.touches) / initialDistance
        const nextZoom = Math.max(0.03, Math.min(1, initialZoom * ratio))
        currentZoomRef.current = nextZoom
        zoomCallbackRef.current?.(nextZoom)
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
      setPaperSize((current) => current.width === width ? current : { width, minHeight: window.innerHeight - 12 })
      const height = Math.max(page.scrollHeight, page.offsetHeight, paperSize.minHeight)
      setPageHeight(height)
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(page); observer?.observe(viewport)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update) }
  }, [projection, summary, showCalculation, fitRequest, paperSize])

  return (
    <div className={`a4-v2-scroll${centerInViewport ? ' is-fit-page' : ''}`} ref={viewportRef}>
      <div
        className="a4-v2-zoom-frame"
        style={{
          width: `${paperSize.width * safeZoom}px`,
          height: `${pageHeight * safeZoom}px`,
        }}
      >
        <article
          ref={pageRef}
          className="a4-v2-page"
          style={{ width: `${paperSize.width}px`, minHeight: `${paperSize.minHeight}px`, transform: `scale(${safeZoom})` }}
        >
          {onBack && <button type="button" className="paper-back" onClick={onBack} aria-label="Quay lại">←</button>}
          <header className="a4-v2-header">
            <h1>{projection.group1.dateLabel}</h1>
            {projection.mode === 'group2' && projection.group2 && (
              <h2>{projection.group2.name}</h2>
            )}
          </header>

          {projection.sections.length === 0 ? (
            <div className="a4-v2-empty">Chưa có thiết lập hoàn chỉnh để hiển thị.</div>
          ) : (
            <div className="a4-v2-sections">
              {projection.sections.map((section) => {
                const sectionSummary = summary?.sections.find((item) => item.settingTypeId === section.settingTypeId)
                const sectionPointTotal = section.entries.reduce((total, entry) => {
                  const point = Number(entry.group3.point)
                  return total + (Number.isFinite(point) ? point : 0)
                }, 0)
                const sectionResultsVisible = showCalculation && sectionSummary !== undefined
                return (
                  <section className="a4-v2-section" key={section.settingTypeId}>
                    <h3>{section.title}</h3>
                    <div className="a4-v2-entry-list">
                      {section.entries.map((entry) => {
                        const result = results.get(entry.group3.id)
                        const values = splitSeparatedValuesV2(entry.group3.listing)
                        return (
                          <div className="a4-v2-entry" key={entry.group3.id}>
                            <div className="a4-v2-entry-main">
                              <div className="a4-v2-listing" aria-label="Danh sách">
                                {values.length === 0 ? (
                                  <span className="a4-v2-muted">—</span>
                                ) : values.map((value, index) => (
                                  <span
                                    className={result?.listingMatchFlags[index] ? 'a4-v2-number is-matched' : 'a4-v2-number'}
                                    key={`${entry.group3.id}-${index}`}
                                  >
                                    {value}
                                  </span>
                                ))}
                              </div>
                              <span className="a4-v2-entry-divider" aria-hidden="true" />
                              <strong className="a4-v2-point">{entry.group3.point || '—'}</strong>
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

          <footer className={`a4-v2-total-area${showCalculation && summary ? '' : ' is-placeholder'}`} aria-hidden={!showCalculation || !summary}>
            <div><span>Tổng Đánh</span><strong>{showCalculation && summary ? formatAmount(summary.totals.d) : '\u00a0'}</strong></div>
            <div><span>Tổng Trúng</span><strong>{showCalculation && summary ? formatAmount(summary.totals.t) : '\u00a0'}</strong></div>
            <div className="a4-v2-difference" aria-label={showCalculation && summary ? `Trúng trừ Đánh: ${formatAmount(summary.totals.difference)}` : undefined}><strong>{showCalculation && summary ? formatAmount(summary.totals.difference) : '\u00a0'}</strong></div>
          </footer>
        </article>
      </div>
    </div>
  )
}
