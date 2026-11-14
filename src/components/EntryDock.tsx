import { useLayoutEffect, useRef } from 'react'
import type { FormulaId } from '../core/models-v2'
import { cleanListingInput } from '../core/input-text'

export default function EntryDock({ rowId, title, listing, point, saved, onListing, onPoint, onCommit, onClose, formulaId, onListingTap, initialField = 'listing' }: {
  rowId: string
  title: string
  listing: string
  point: string
  saved: boolean
  onListing: (value: string) => void
  onPoint: (value: string) => void
  onCommit: () => void
  onClose: () => void
  formulaId: FormulaId
  onListingTap?: () => void
  initialField?: 'listing' | 'point'
}) {
  const listingRef = useRef<HTMLTextAreaElement>(null)
  const pointRef = useRef<HTMLInputElement>(null)
  const dockRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const input = initialField === 'point' ? pointRef.current : listingRef.current
    input?.focus({ preventScroll: true })
    input?.setSelectionRange(input.value.length, input.value.length)
  }, [rowId, initialField])

  useLayoutEffect(() => {
    const dock = dockRef.current
    const update = () => document.documentElement.style.setProperty('--entry-dock-height', `${dock?.getBoundingClientRect().height ?? 130}px`)
    update()
    if (!dock || typeof ResizeObserver === 'undefined') return () => document.documentElement.style.removeProperty('--entry-dock-height')
    const observer = new ResizeObserver(update)
    observer.observe(dock)
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--entry-dock-height') }
  }, [])


  function changeListing(raw: string) {
    const next = cleanListingInput(raw)
    const values = next.trim().split(/[\s,]+/).filter(Boolean)
    const width = formulaId === 'da' || formulaId === 'db' ? 3 : 2
    const completed = /[\s,]$/.test(next) ? values : values.slice(0, -1)
    if (values.some((value) => value.length > width) || completed.some((value) => value.length < 2)) { window.alert('Nhập sai số'); return }
    onListing(next)
  }
  return <section ref={dockRef} className="entry-dock" aria-label="Nhập trực tiếp trên A4">
    <div className="entry-dock-heading"><strong>{title}</strong><button type="button" onClick={onClose} aria-label="Đóng thanh nhập">×</button></div>
    <div className="entry-dock-fields">
      <label>Liệt kê<textarea onPointerDown={onListingTap} ref={listingRef} rows={2} value={listing} inputMode="decimal" enterKeyHint="enter" autoComplete="off" autoCorrect="off" spellCheck={false} onFocus={(event) => { const input = event.currentTarget; input.setSelectionRange(input.value.length, input.value.length) }} onChange={(event) => changeListing(event.target.value)} aria-label="Liệt kê đang nhập" /></label>
      <label>Điểm<input ref={pointRef} type="text" inputMode="numeric" enterKeyHint="done" maxLength={4} value={point} onFocus={(event) => { const input = event.currentTarget; input.setSelectionRange(input.value.length, input.value.length) }} onChange={(event) => onPoint(event.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onCommit() } }} aria-label="Điểm đang nhập" /></label>
      <button className="button-primary" type="button" onClick={onCommit}>{saved ? 'Lưu' : 'Thêm'}</button>
    </div>
  </section>
}
