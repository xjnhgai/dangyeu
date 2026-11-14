import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { checkPin, type AppPreferences } from '../core/app-preferences'
import { PreferencesContext } from '../core/preferences-context'
import { loadAppPreferences, saveAppPreferences, wipeCalculationEntries } from '../core/vault-storage'

export default function AppGate({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences | null>(null)
  const [locked, setLocked] = useState(true)
  const [opened, setOpened] = useState(false)
  const [error, setError] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)
  const verifyingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void loadAppPreferences().then(async (loaded) => {
      const value = loaded.wipePending ? await wipeCalculationEntries(loaded) : loaded
      if (cancelled) return
      setPreferences(value)
      setLocked(Boolean(value.pin))
      setOpened(!value.pin)
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể mở cài đặt bảo vệ.')
    })
    return () => { cancelled = true }
  }, [])

  const lockApp = useCallback(() => {
    setLocked(true)
    setPin('')
    setError('')
  }, [])

  useEffect(() => {
    const onHidden = () => { if (preferences?.pin && document.visibilityState === 'hidden') lockApp() }
    const onPageHide = () => { if (preferences?.pin) lockApp() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [preferences?.pin, lockApp])

  const updatePreferences = useCallback(async (value: AppPreferences) => {
    await saveAppPreferences(value)
    setPreferences(value)
  }, [])

  const verifyAccess = useCallback(async (value: string): Promise<{ ok: boolean; wiped: boolean }> => {
    if (!preferences) throw new Error('Chưa mở cài đặt bảo vệ.')
    if (verifyingRef.current) throw new Error('Đang kiểm tra PIN hoặc dọn dữ liệu. Vui lòng đợi.')
    verifyingRef.current = true
    setBusy(true)
    try {
      let activePreferences = preferences
      if (activePreferences.wipePending) {
        setOpened(false); setLocked(true)
        activePreferences = await wipeCalculationEntries(activePreferences)
        setPreferences(activePreferences)
      }
      const result = await checkPin(activePreferences, value)
      if (result.wipeRequired) {
        // Unmount hidden editors before queuing the wipe so no stale autosave can restore rows.
        setOpened(false)
        setLocked(true)
        await updatePreferences(result.preferences)
        const cleared = await wipeCalculationEntries(result.preferences)
        setPreferences(cleared)
        setError('Đã nhập sai PIN 3 lần. Toàn bộ A4 và nội dung nhập đã được xóa; danh sách tên nhóm và hệ số được giữ lại.')
        return { ok: false, wiped: true }
      }
      await updatePreferences(result.preferences)
      return { ok: result.ok, wiped: false }
    } finally { verifyingRef.current = false; setBusy(false) }
  }, [preferences, updatePreferences])

  async function unlock(event: FormEvent) {
    event.preventDefault()
    if (!preferences?.pin || submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await verifyAccess(pin)
      setPin('')
      if (!result.ok) {
        if (!result.wiped) setError('PIN chưa đúng. Nhập sai 3 lần liên tiếp sẽ xóa dữ liệu A4.')
        return
      }
      setOpened(true)
      setLocked(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể mở khóa.')
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  if (!preferences) return (
    <main className="pin-screen"><section className="pin-card" role="status">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width="72" height="72" alt="" />
      <h1>ĐẹpGái</h1><p>{error || 'Đang mở dữ liệu…'}</p>
      {error && <button className="button-primary" type="button" onClick={() => window.location.reload()}>Thử lại</button>}
    </section></main>
  )

  return <PreferencesContext.Provider value={{ preferences, updatePreferences, lockApp, verifyAccess }}>
    {opened && <div hidden={locked} inert={locked}>{children}</div>}
    {locked && <main className="pin-screen">
      <form className="pin-card" onSubmit={(event) => void unlock(event)}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width="80" height="80" alt="" />
        <h1>ĐẹpGái</h1><p>Nhập PIN để mở ứng dụng</p><small className="pin-wipe-note">Sai 3 lần liên tiếp sẽ xóa dữ liệu A4, chỉ giữ danh sách tên nhóm và hệ số.</small>
        <label className="pin-label">Mã PIN
          <input type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="off" aria-label="PIN mở khóa" enterKeyHint="done" />
        </label>
        {error && <p className="settings-error" role="alert">{error}</p>}
        <button className="button-primary" type="submit" disabled={busy || pin.length !== 4}>{busy ? 'Đang kiểm tra…' : 'Mở khóa'}</button>
      </form>
    </main>}
  </PreferencesContext.Provider>
}
