import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cleanListingInput } from '../core/input-text'

export default function EntryDock({ rowId, title, listing, point, saved, onListing, onPoint, onCommit, onClose, error, initialField = 'listing' }: {
  rowId: string
  title: string
  listing: string
  point: string
  saved: boolean
  onListing: (value: string) => void
  onPoint: (value: string) => void
  onCommit: () => void
  onClose: () => void
  error: string
  initialField?: 'listing' | 'point'
}) {
  const listingRef = useRef<HTMLTextAreaElement>(null)
  const pointRef = useRef<HTMLInputElement>(null)
  const dockRef = useRef<HTMLElement>(null)
  const [field, setField] = useState<'listing' | 'point'>(initialField)

  useLayoutEffect(() => {
    ;(initialField === 'point' ? pointRef.current : listingRef.current)?.focus({ preventScroll: true })
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

  function listingKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    pointRef.current?.focus({ preventScroll: true })
  }

  return <section ref={dockRef} className="entry-dock" aria-label="Nhập trực tiếp trên A4">
    <div className="entry-dock-heading"><strong>{title}</strong><span>{field === 'listing' ? 'Enter → Điểm' : `Enter → ${saved ? 'Lưu' : 'Thêm'}`}</span><button type="button" onClick={onClose} aria-label="Đóng thanh nhập">×</button></div>
    <div className="entry-dock-fields">
      <label>Liệt kê<textarea ref={listingRef} rows={2} value={listing} inputMode="decimal" enterKeyHint="next" autoComplete="off" autoCorrect="off" spellCheck={false} onFocus={() => setField('listing')} onChange={(event) => onListing(cleanListingInput(event.target.value))} onKeyDown={listingKey} aria-label="Liệt kê đang nhập" /></label>
      <label>Điểm<input ref={pointRef} type="text" inputMode="numeric" enterKeyHint="done" maxLength={4} value={point} onFocus={() => setField('point')} onChange={(event) => onPoint(event.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onCommit() } }} aria-label="Điểm đang nhập" /></label>
      <button className="button-primary" type="button" onClick={onCommit}>{saved ? 'Lưu' : 'Thêm'}</button>
    </div>
    {error && <p className="settings-error" role="alert">{error}</p>}
  </section>
}
