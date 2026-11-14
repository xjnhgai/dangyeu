import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPinCredential, expiredA4Ids } from '../core/app-preferences'
import { useAppPreferences } from '../core/preferences-context'
import type { CalculationDataV2 } from '../core/models-v2'

export function PinSettings() {
  const { preferences, updatePreferences, lockApp, verifyAccess } = useAppPreferences()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const submittingRef = useRef(false)

  useEffect(() => {
    const clearSecrets = () => { setCurrent(''); setNext(''); setConfirm('') }
    const onHidden = () => { if (document.visibilityState === 'hidden') clearSecrets() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', clearSecrets)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', clearSecrets)
    }
  }, [])

  async function submit(remove = false) {
    if (submittingRef.current) return
    submittingRef.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      if (!remove && (!/^\d{4}$/.test(next) || next !== confirm)) throw new Error('Nhập PIN mới gồm 4 số và xác nhận trùng khớp.')
      let verified = preferences
      if (preferences.pin) {
        if (!/^\d{4}$/.test(current)) throw new Error('Nhập PIN hiện tại gồm đúng 4 số.')
        const result = await verifyAccess(current)
        if (!result.ok) throw new Error('PIN hiện tại chưa đúng.')
        verified = { ...preferences, failedAttempts: 0, blockedUntil: 0, wipePending: false }
      }
      const pin = remove ? null : await createPinCredential(next)
      await updatePreferences({ ...verified, pin, failedAttempts: 0, blockedUntil: 0 })
      setCurrent(''); setNext(''); setConfirm('')
      setMessage(remove ? 'Đã tắt PIN.' : 'Đã lưu PIN. Ứng dụng sẽ khóa khi mở lại hoặc chuyển nền.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu PIN.')
    } finally { submittingRef.current = false; setBusy(false) }
  }

  const pinInput = (value: string, change: (value: string) => void, label: string) => (
    <label>{label}<input type="text" inputMode="numeric" maxLength={4} value={value} onChange={(event) => change(event.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="off" /></label>
  )
  return <form className="sheet-content compact-form home-settings-detail" onSubmit={(event: FormEvent) => { event.preventDefault(); void submit() }}>
    <p className="management-hint">{preferences.pin ? 'PIN đang bật.' : 'PIN đang tắt.'} PIN khóa truy cập trên thiết bị này. PIN nhà phát hành vẫn mở được app.</p>
    {preferences.pin && pinInput(current, setCurrent, 'PIN hiện tại')}
    {pinInput(next, setNext, preferences.pin ? 'PIN mới (4 số)' : 'Đặt PIN (4 số)')}
    {pinInput(confirm, setConfirm, 'Nhập lại PIN mới')}
    {error && <p className="settings-error" role="alert">{error}</p>}
    {message && <p className="settings-success" role="status">{message}</p>}
    <div className="privacy-actions">
      <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : preferences.pin ? 'Đổi PIN' : 'Bật PIN'}</button>
      {preferences.pin && <button className="button-secondary" type="button" disabled={busy} onClick={() => void submit(true)}>Tắt PIN</button>}
      {preferences.pin && <button className="button-secondary" type="button" disabled={busy} onClick={lockApp}>Khóa ngay</button>}
    </div>
  </form>
}

export function RetentionSettings({ data }: { data: CalculationDataV2 }) {
  const { preferences, updatePreferences } = useAppPreferences()
  const [enabled, setEnabled] = useState(preferences.retention.enabled)
  const [days, setDays] = useState(String(preferences.retention.days))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const submittingRef = useRef(false)
  const parsed = /^\d+$/.test(days) ? Number(days) : NaN
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 3650
  const count = valid && enabled ? expiredA4Ids(data, parsed).size : 0

  async function save(event: FormEvent) {
    event.preventDefault()
    if (submittingRef.current) return
    setError(''); setMessage('')
    if (!valid) { setError('Số ngày phải là số nguyên từ 1 đến 3650.'); return }
    if (enabled && !window.confirm(`Bật tự xóa, giữ ${parsed} ngày kể cả hôm nay, tính theo ngày trên A4. ${count} A4 hiện tại sẽ bị xóa. A4 hết hạn sau này cũng sẽ được tự xóa khi ứng dụng hoạt động. Không thể hoàn tác. Áp dụng?`)) return
    submittingRef.current = true; setBusy(true)
    try {
      await updatePreferences({ ...preferences, retention: { enabled, days: parsed } })
      setMessage(enabled ? `Đã bật giữ ${parsed} ngày. Ứng dụng đang kiểm tra A4 hết hạn.` : 'Đã tắt tự xóa A4.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu thời hạn lưu trữ.') }
    finally { submittingRef.current = false; setBusy(false) }
  }

  return <form className="sheet-content compact-form home-settings-detail storage-settings-detail" onSubmit={(event) => void save(event)}>
    <label className="retention-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Tự xóa A4 hết hạn</label>
    <label>Số ngày giữ lại<input type="number" inputMode="numeric" min="1" max="3650" step="1" value={days} onChange={(event) => setDays(event.target.value)} /></label>
    <p className="management-hint">Tính theo ngày ghi trên A4, gồm hôm nay. Ví dụ giữ 13 ngày thì giữ hôm nay và 12 ngày trước. Chỉ xóa khi ứng dụng đang hoạt động; lần mở tiếp theo sẽ dọn dữ liệu hết hạn. Tên nhóm nhập nhanh và hệ số được giữ lại.</p>
    <p className="retention-preview">{enabled ? `Có ${count} A4 hết hạn theo lựa chọn này.` : 'Tự xóa đang tắt.'}</p>
    {error && <p className="settings-error" role="alert">{error}</p>}
    {message && <p className="settings-success" role="status">{message}</p>}
    <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Áp dụng'}</button>
    <section className="manual-calculation-save"><strong>Lưu trữ dữ liệu A4</strong><p>A4 và nội dung nhập dở được tự lưu trên thiết bị. Nút Lưu trên thanh công cụ dùng để xuất ảnh JPG.</p></section>
  </form>
}
