import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import AppIcon from './AppIcon'

type Item = { id: string; label: string; configured: boolean }
export default function DrawerPicker({ items, selected, hidden, onHidden, onSelect, onReorder, kind, listLabel, actions, leading }: {
  items: Item[]; selected: string; hidden: string[]; onHidden: (ids: string[]) => void
  onSelect: (id: string) => void; onReorder: (source: string, target: string) => void
  kind: 'group2' | 'type'; listLabel: string; actions: ReactNode; leading?: ReactNode
}) {
  const row = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState('')
  const suppress = useRef(false)
  const drag = useRef<{ source: string; target: string; zone: 'hidden' | 'visible' | null; x: number; y: number; moving: boolean } | null>(null)
  useEffect(() => {
    const update = () => {
      const width = row.current?.clientWidth ?? 0
      let used = 0
      const next: string[] = []
      for (const item of items) {
        if (hidden.includes(item.id)) continue
        const button = [...(measure.current?.querySelectorAll<HTMLElement>('[data-measure-id]') ?? [])].find((element) => element.dataset.measureId === item.id)
        const size = button?.getBoundingClientRect().width ?? 60
        const need = size + (next.length ? 5 : 0)
        if (width > 0 && used + need <= width) { next.push(item.id); used += need }
      }
      setVisible((current) => current.join('\0') === next.join('\0') ? current : next)
    }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (row.current) observer?.observe(row.current)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [items, hidden])

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || (!current.moving && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7)) return
    event.preventDefault()
    current.moving = true
    setMoving(current.source)
    const hit = document.elementFromPoint(event.clientX, event.clientY)
    const picker = hit?.closest<HTMLElement>('[data-picker-kind]')
    if (picker?.dataset.pickerKind !== kind) { current.zone = null; current.target = current.source; return }
    const target = hit?.closest<HTMLElement>('[data-picker-item]')
    if (hit?.closest('[data-drawer-trigger]')) { current.zone = 'hidden'; current.target = current.source; setOpen(true) }
    else if (target) { current.target = target.dataset.pickerItem ?? current.source; current.zone = target.dataset.itemZone === 'hidden' ? 'hidden' : 'visible' }
    else if (hit?.closest('[data-drawer-body]')) { current.zone = 'hidden'; current.target = current.source }
    else if (hit?.closest('[data-visible-row]')) { current.zone = 'visible'; current.target = visible.find((id) => id !== current.source) ?? current.source }
    else { current.zone = null; current.target = current.source }
  }
  function finish(cancelled = false) {
    const current = drag.current
    drag.current = null; setMoving('')
    if (!current?.moving) return
    suppress.current = true
    if (cancelled || !current.zone) return
    if (current.zone === 'hidden') onHidden([...new Set([...hidden, current.source])])
    else onHidden(hidden.filter((id) => id !== current.source))
    const alreadyBeforeFirst = current.zone === 'visible' && current.target === visible[0] && items.findIndex((item) => item.id === current.source) < items.findIndex((item) => item.id === current.target)
    if (current.source !== current.target && !alreadyBeforeFirst) onReorder(current.source, current.target)
  }
  const chip = (item: Item, measuring = false, zone: 'visible' | 'hidden' = 'visible') => <button
    key={item.id} type="button" className={`choice-chip ${kind === 'type' ? 'setting-type-chip' : 'group2-draggable'}${selected === item.id ? ' is-selected' : item.configured ? ' is-configured' : ''}${moving === item.id ? ' is-dragging' : ''}`}
    data-measure-id={measuring ? item.id : undefined} data-picker-item={measuring ? undefined : item.id} data-item-zone={zone}
    data-group2-drag-key={!measuring && kind === 'group2' ? item.id : undefined} data-drag-type={!measuring && kind === 'type' ? item.id : undefined}
    aria-pressed={selected === item.id} tabIndex={measuring ? -1 : undefined}
    onPointerDown={measuring ? undefined : (event) => { if (event.button !== 0 || (event.pointerType === 'touch' && event.isPrimary === false)) return; suppress.current = false; drag.current = { source: item.id, target: item.id, zone: null, x: event.clientX, y: event.clientY, moving: false }; event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerMove={measuring ? undefined : move} onPointerUp={measuring ? undefined : () => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
    onContextMenu={(event) => event.preventDefault()}
    onKeyDown={measuring ? undefined : (event) => { if (event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const next = items[items.findIndex((value) => value.id === item.id) + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1)]; if (next) onReorder(item.id, next.id) } }}
    onClick={measuring ? undefined : () => { if (suppress.current) { suppress.current = false; return }; onSelect(item.id); setOpen(false) }}
  >{item.label}</button>
  return <div className={`drawer-picker drawer-${kind}`} data-picker-kind={kind}>
    <div className={`drawer-picker-row${leading ? " has-leading" : ""}`}>
      {leading}
      <div className="compact-chip-list drawer-visible" data-visible-row ref={row}>{items.filter((item) => visible.includes(item.id)).map((item) => chip(item))}</div>
      <button type="button" className={`icon-button drawer-trigger ${kind === 'type' ? 'type-overflow-trigger' : 'group2-overflow-trigger'}`} data-drawer-trigger aria-label={listLabel} aria-expanded={open} onClick={() => setOpen((value) => !value)}><AppIcon name="list" /></button>
      {actions}
    </div>
    {open && <div className="drawer-body" data-drawer-body aria-label={kind === 'type' ? 'Các nhóm thiết lập còn lại' : 'Tên nhóm còn lại'}>{items.filter((item) => !visible.includes(item.id)).map((item) => chip(item, false, 'hidden'))}{items.every((item) => visible.includes(item.id)) && <span className="drawer-empty">Kéo tên vào đây để cất</span>}</div>}
    <div className="type-chip-measure" aria-hidden="true" ref={measure}>{items.map((item) => chip(item, true))}</div>
  </div>
}
