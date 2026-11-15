import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FormulaId } from '../core/models-v2'
import { cleanListingInput } from '../core/input-text'

export default function EntryDock({ rowId, title, listing, point, saved, onListing, onPoint, onCommit, onClose, formulaId, initialField = 'listing' }: {
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
  initialField?: 'listing' | 'point'
}) {
  const [field, setField] = useState<'listing' | 'point'>(initialField)
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
  function pressKey(key: string, target = field) {
    if (target === 'listing') {
      if (key === 'Backspace') onListing(listing.slice(0, -1))
      else if (/^[0-9,\n ]$/.test(key)) changeListing(listing + key)
    } else {
      if (key === 'Backspace') onPoint(point.slice(0, -1))
      else if (/^\d$/.test(key) && point.length < 4) onPoint(point + key)
    }
  }
  function physicalKey(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.currentTarget === pointRef.current ? 'point' : 'listing'
    if (event.key === 'Enter') {
      event.preventDefault()
      if (target === 'point') onCommit()
      else pressKey('\n', target)
    } else if (event.key === 'Backspace' || event.key === 'Delete' || /^[0-9,. ]$/.test(event.key)) {
      event.preventDefault()
      pressKey(event.key === 'Delete' ? 'Backspace' : event.key === '.' ? ',' : event.key, target)
    }
  }
  return <section ref={dockRef} className="entry-dock" aria-label="Nhập trực tiếp trên A4">
    <div className="entry-dock-heading"><strong>{title}</strong><button type="button" onClick={onClose} aria-label="Đóng thanh nhập">×</button></div>
    <div className="entry-dock-fields">
      <label>Liệt kê<textarea ref={listingRef} rows={2} value={listing} readOnly inputMode="none" autoComplete="off" autoCorrect="off" spellCheck={false}
        onFocus={(event) => { setField('listing'); const input = event.currentTarget; input.setSelectionRange(input.value.length, input.value.length) }}
        onKeyDown={physicalKey} onPaste={(event) => { event.preventDefault(); changeListing(listing + event.clipboardData.getData('text')) }}
        onChange={(event) => changeListing(event.target.value)} aria-label="Liệt kê đang nhập" /></label>
      <label>Điểm<input ref={pointRef} type="text" readOnly inputMode="none" maxLength={4} value={point}
        onFocus={(event) => { setField('point'); const input = event.currentTarget; input.setSelectionRange(input.value.length, input.value.length) }}
        onKeyDown={physicalKey} onPaste={(event) => { event.preventDefault(); onPoint((point + event.clipboardData.getData('text')).replace(/\D/g, '').slice(0, 4)) }}
        onChange={(event) => onPoint(event.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Điểm đang nhập" /></label>
      <button className="button-primary" type="button" onClick={onCommit}>{saved ? 'Lưu' : 'Thêm'}</button>
    </div>
    <div className="entry-keypad" role="group" aria-label="Bàn phím số">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Backspace', '0', ','].map((key) => <button
        key={key} type="button" disabled={key === ',' && field === 'point'}
        aria-label={key === 'Backspace' ? 'Xóa một ký tự' : key === ',' ? 'Dấu phẩy' : `Nhập ${key}`}
        onPointerDown={(event) => event.preventDefault()} onClick={() => pressKey(key)}
      >{key === 'Backspace' ? '⌫' : key}</button>)}
    </div>
  </section>
}
