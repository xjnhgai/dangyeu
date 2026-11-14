import { useState, type FormEvent } from 'react'
import { isPublisherSettingsPin } from '../core/app-preferences'

export default function PublisherPrompt({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isPublisherSettingsPin(pin)) { setError('PIN cài đặt chưa đúng.'); setPin(''); return }
    onUnlock()
  }
  return <div className="publisher-pin-backdrop">
    <form className="pin-card publisher-pin-card" role="dialog" aria-modal="true" aria-label="Mở cài đặt nhà phát hành" onSubmit={submit}>
      <h2>Cài đặt hệ số</h2><p>Nhập PIN nhà phát hành để sửa hệ số hoặc Reset tên thiết lập.</p>
      <label className="pin-label">PIN cài đặt<input type="text" inputMode="numeric" enterKeyHint="done" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="off" autoFocus /></label>
      {error && <p className="settings-error" role="alert">{error}</p>}
      <button className="button-primary" type="submit" disabled={pin.length !== 4}>Mở cài đặt</button>
      <button className="button-secondary" type="button" onClick={onClose}>Hủy</button>
    </form>
  </div>
}
