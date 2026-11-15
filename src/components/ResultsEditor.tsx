import { useEffect, useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react'
import { cleanListingInput } from '../core/input-text'
import AppIcon from './AppIcon'

export default function ResultsEditor({ oneToSeven, gdb, onOneToSeven, onGdb, onOneToSevenBlur, onGdbBlur, count, valid, gdbValid, enabled, onToggle, onClear }: {
  oneToSeven: string; gdb: string; onOneToSeven: (value: string) => void; onGdb: (value: string) => void
  onOneToSevenBlur: () => void; onGdbBlur: () => void
  count: number; valid: boolean; gdbValid: boolean; enabled: boolean; onToggle: () => void; onClear: (field: 'list' | 'gdb') => void
}) {
  const clipboardGeneration = useRef(0)
  useEffect(() => () => { clipboardGeneration.current += 1 }, [])
  const [field, setField] = useState<'list' | 'gdb'>('list')
  const [pasteError, setPasteError] = useState('')
  const pending = useRef<{ target: string; value: string; position: number } | null>(null)
  const listRef = useRef<HTMLTextAreaElement>(null)
  const gdbRef = useRef<HTMLInputElement>(null)
  function insert(key: string, target = field) {
    clipboardGeneration.current += 1
    const input = target === 'list' ? listRef.current : gdbRef.current
    const value = target === 'list' ? oneToSeven : gdb
    const waiting = pending.current?.target === target && pending.current.value === value ? pending.current : null
    const start = waiting?.position ?? input?.selectionStart ?? value.length
    const end = waiting?.position ?? input?.selectionEnd ?? value.length
    const remove = key === 'Backspace'
    const from = remove && start === end ? Math.max(0, start - 1) : start
    const next = value.slice(0, from) + (remove ? '' : key) + value.slice(end)
    if (target === 'gdb' && (!/^\d*$/.test(next) || next.length > 5)) return
    const change = target === 'list' ? onOneToSeven : onGdb
    change(target === 'list' ? cleanListingInput(next) : next)
    const caret = from + (remove ? 0 : key.length)
    pending.current = { target, value: next, position: caret }
    requestAnimationFrame(() => { if (pending.current?.target === target && pending.current.value === next) { input?.setSelectionRange(caret, caret); pending.current = null } })
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.currentTarget === gdbRef.current ? 'gdb' : 'list'
    if (event.key === 'Backspace' || /^[0-9,. ]$/.test(event.key) || (event.key === 'Enter' && target === 'list')) {
      event.preventDefault(); insert(event.key === 'Enter' ? '\n' : event.key === '.' ? ',' : event.key, target)
    }
  }
  function paste(event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>, target: 'list' | 'gdb') {
    event.preventDefault()
    const text = event.clipboardData.getData('text')
    insert(target === 'list' ? cleanListingInput(text) : text.replace(/\D/g, ''), target)
  }
  async function pasteFromClipboard(target: 'list' | 'gdb') {
    const generation = ++clipboardGeneration.current
    setPasteError('')
    try {
      if (!navigator.clipboard?.readText) { setPasteError('Thiết bị chưa hỗ trợ dán nhanh.'); return }
      const text = await navigator.clipboard.readText()
      if (generation !== clipboardGeneration.current) return
      const value = target === 'list' ? cleanListingInput(text) : text.replace(/\D/g, '')
      if (target === 'gdb' && value.length > 5) { setPasteError('GĐB phải gồm đúng 5 chữ số.'); return }
      pending.current = null
      setField(target)
      if (target === 'list') onOneToSeven(value); else onGdb(value)
      requestAnimationFrame(() => { const input = target === 'list' ? listRef.current : gdbRef.current; input?.setSelectionRange(value.length, value.length) })
    } catch { if (generation === clipboardGeneration.current) setPasteError('Chưa dán được. Hãy cho phép truy cập bộ nhớ tạm.') }
  }
  function clearField(target: 'list' | 'gdb') {
    clipboardGeneration.current += 1
    pending.current = null
    setPasteError(''); setField(target); onClear(target)
  }
  return <div className="sheet-content results-editor">
    <div className="results-fields">
      <div className="result-field"><div className="result-label-row"><label htmlFor="result-one-to-seven">1–7</label><button type="button" onClick={() => void pasteFromClipboard('list')} aria-label="Dán kết quả 1–7"><AppIcon name="clipboard" /></button><button type="button" aria-label="Xóa hết kết quả 1–7" onClick={() => clearField('list')}><AppIcon name="trash" /></button></div><textarea id="result-one-to-seven" aria-label="1–7" ref={listRef} rows={3} readOnly inputMode="none" value={oneToSeven} onChange={(event) => onOneToSeven(cleanListingInput(event.target.value))} onFocus={() => setField('list')} onBlur={onOneToSevenBlur} onKeyDown={keyDown} onPaste={(event) => paste(event, 'list')} aria-invalid={!valid} /></div>
      <div className={`draw-count-status${valid ? '' : ' is-invalid'}`}><span>{count}/26 số</span><strong>{!oneToSeven.trim() ? 'Chưa nhập' : valid ? 'Hợp lệ' : 'Không hợp lệ'}</strong></div>
      <div className="result-field"><div className="result-label-row"><label htmlFor="result-gdb">GĐB</label><button type="button" onClick={() => void pasteFromClipboard('gdb')} aria-label="Dán GĐB"><AppIcon name="clipboard" /></button><button type="button" aria-label="Xóa hết GĐB" onClick={() => clearField('gdb')}><AppIcon name="trash" /></button></div><input id="result-gdb" aria-label="GĐB" ref={gdbRef} readOnly inputMode="none" value={gdb} maxLength={5} onFocus={() => setField('gdb')} onChange={(event) => onGdb(event.target.value.replace(/\D/g, '').slice(0, 5))} onBlur={onGdbBlur} onKeyDown={keyDown} onPaste={(event) => paste(event, 'gdb')} aria-invalid={!gdbValid} /></div>
      {!gdbValid && <div className="draw-count-status is-invalid"><strong>GĐB phải gồm đúng 5 chữ số.</strong></div>}
    </div>
    {pasteError && <p className="settings-error" role="status">{pasteError}</p>}
    <div className="entry-keypad results-keypad" role="group" aria-label="Bàn phím kết quả">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Backspace', '0', ','].map((key) => <button type="button" key={key} disabled={key === ',' && field === 'gdb'} aria-label={key === 'Backspace' ? 'Xóa ký tự kết quả' : key === ',' ? 'Phân cách kết quả' : `Nhập kết quả ${key}`} onPointerDown={(event) => event.preventDefault()} onClick={() => insert(key)}>{key === 'Backspace' ? '⌫' : key}</button>)}
    </div>
    <div className="results-footer"><button className={`calculation-toggle${enabled ? ' is-on' : ''}`} type="button" onClick={onToggle} aria-pressed={enabled}><AppIcon name="calculator" /><span>Tính Toán</span><span className="calculation-status" aria-hidden="true">{enabled ? 'Bật' : 'Tắt'}</span></button></div>
  </div>
}
