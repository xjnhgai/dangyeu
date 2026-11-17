// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { webcrypto } from 'node:crypto'
import { IDBFactory } from 'fake-indexeddb'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/App'
import AppGate from '../../src/components/AppGate'
import { PinSettings } from '../../src/components/PrivacySettings'
import { checkPin, createPinCredential, defaultAppPreferences } from '../../src/core/app-preferences'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { loadAppPreferences, loadCalculationWorkspace, loadQuickSettings, saveAppPreferences, saveCalculationWorkspace, type CalculationWorkspaceV2 } from '../../src/core/vault-storage'

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ offlineReady: [false, () => {}], needRefresh: [false, () => {}], updateServiceWorker: vi.fn() }) }))

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('crypto', webcrypto)
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} })
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function fixture(): CalculationWorkspaceV2 {
  const now = new Date()
  return { schemaVersion: 2, updatedAt: 1, data: {
    ...createCalculationDataV2(), settingTypes: createCalculationDataV2().settingTypes.map((type) => ({ ...type, defaultCoefficientD: '1', defaultCoefficientT: '2' })),
    groups1: [{ kind: 'group1', id: 'a4', dateLabel: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`, drawData: { oneToSeven: [], gdb: '' }, groups2: [
      { kind: 'group2', id: 'lan', name: 'Lan', groups3: [{ kind: 'group3', id: 'row', settingTypeId: 'setting-type-1', listing: '00', point: '1', coefficientD: '1', coefficientT: '2' }] },
      { kind: 'group2', id: 'mai', name: 'Mai', groups3: [] },
    ] }],
  }, editorState: { selectedGroup1Id: 'a4', selectedGroup2Id: 'lan', a4Mode: 'combined', activeSettingTypeId: 'setting-type-1', draftRowsByType: {}, savedRowDrafts: {}, drawOneToSeven: '', drawGdb: '', dateDraft: '', newGroupName: '', showNewGroupInput: false, calculationEnabled: false, activePanel: 'edit', managementPanel: null } }
}

async function openApp() {
  render(<StrictMode><AppGate><App /></AppGate></StrictMode>)
  await screen.findByRole('button', { name: 'Tạo A4 mới' })
  await waitFor(() => expect(screen.queryByText('Đang mở dữ liệu đã mã hóa…')).toBeNull())
}

describe('application integration', () => {
  it('never mounts protected content before unlocking and hides it again on pagehide', async () => {
    await saveAppPreferences({ ...defaultAppPreferences(), pin: await createPinCredential('0123') })
    render(<AppGate><div>Dữ liệu riêng tư</div></AppGate>)
    const input = await screen.findByLabelText('PIN mở khóa')
    expect(screen.queryByText('Dữ liệu riêng tư')).toBeNull()
    fireEvent.change(input, { target: { value: '9999' } })
    await screen.findByText('PIN chưa đúng.')
    expect(screen.queryByText('Dữ liệu riêng tư')).toBeNull()
    fireEvent.change(input, { target: { value: '0123' } })
    await screen.findByText('Dữ liệu riêng tư')
    expect(screen.queryByLabelText('PIN mở khóa')).toBeNull()
    fireEvent(window, new Event('pagehide'))
    await screen.findByLabelText('PIN mở khóa')
    expect(screen.getByText('Dữ liệu riêng tư').closest('[hidden]')).not.toBeNull()
  })
  it('sets, changes and disables PIN through settings, requiring the current PIN', async () => {
    render(<AppGate><PinSettings /></AppGate>)
    fireEvent.change(await screen.findByLabelText('Đặt PIN (4 số)'), { target: { value: '0123' } })
    fireEvent.change(screen.getByLabelText('Nhập lại PIN mới'), { target: { value: '0123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bật PIN' }))
    await screen.findByText(/Đã lưu PIN/)
    fireEvent.change(screen.getByLabelText('PIN hiện tại'), { target: { value: '9999' } })
    fireEvent.change(screen.getByLabelText('PIN mới (4 số)'), { target: { value: '4567' } })
    fireEvent.change(screen.getByLabelText('Nhập lại PIN mới'), { target: { value: '4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi PIN' }))
    await screen.findByText(/PIN hiện tại chưa đúng/)
    fireEvent.change(screen.getByLabelText('PIN hiện tại'), { target: { value: '0123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi PIN' }))
    await screen.findByText(/Đã lưu PIN/)
    fireEvent(window, new Event('pagehide'))
    fireEvent.change(await screen.findByLabelText('PIN mở khóa'), { target: { value: '4567' } })
    await waitFor(() => expect(screen.queryByLabelText('PIN mở khóa')).toBeNull())
    await screen.findByLabelText('PIN hiện tại')
    fireEvent.change(screen.getByLabelText('PIN hiện tại'), { target: { value: '4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tắt PIN' }))
    await screen.findByText('Đã tắt PIN.')
    fireEvent(window, new Event('pagehide'))
    expect(screen.queryByLabelText('PIN mở khóa')).toBeNull()
  })
  it('previews and applies retention on demand, keeping pages after cancellation', async () => {
    const workspace = fixture()
    workspace.data.groups1.push({ ...workspace.data.groups1[0], id: 'old', dateLabel: '01/01/2000', groups2: [] })
    await saveCalculationWorkspace(workspace)
    await openApp()
    fireEvent.click(screen.getByRole('button', { name: 'Mở cài đặt' }))
    fireEvent.click(screen.getByRole('button', { name: /Lưu trữ/ }))
    fireEvent.click(screen.getByLabelText('Tự xóa A4 hết hạn'))
    expect(screen.queryByText('Có 1 A4 hết hạn theo lựa chọn này.')).toBeNull()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect((await loadCalculationWorkspace())?.value.data.groups1).toHaveLength(2)
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(async () => expect((await loadCalculationWorkspace())?.value.data.groups1.map((page) => page.id)).toEqual(['a4']))
    await waitFor(() => expect(screen.queryByText('Đang dọn A4 hết hạn…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Đóng cài đặt' }))
    expect(screen.queryByRole('button', { name: 'Mở A4 ngày 01/01/2000' })).toBeNull()
  })
  it('reorders Group2 chips by direct pointer drag without selecting the dragged group', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách tên nhóm còn lại' }))
    const lan = screen.getByRole('button', { name: 'Lan', exact: true })
    const mai = screen.getByRole('button', { name: 'Mai', exact: true })
    HTMLElement.prototype.setPointerCapture = vi.fn()
    document.elementFromPoint = vi.fn().mockReturnValue(lan)
    fireEvent.pointerDown(mai, { pointerId: 1, button: 0, isPrimary: true, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(mai, { pointerId: 1, button: 0, isPrimary: true, clientX: 20, clientY: 100 })
    fireEvent.pointerUp(mai, { pointerId: 1, button: 0, isPrimary: true, clientX: 20, clientY: 100 })
    fireEvent.click(mai)
    await waitFor(async () => {
      const saved = (await loadCalculationWorkspace())!.value
      expect(saved.data.groups1[0].groups2.map((group) => group.name)).toEqual(['Mai', 'Lan'])
      expect(saved.editorState.selectedGroup2Id).toBe('lan')
    }, { timeout: 3000 })
  })
  it('reorders names with a drag handle in the Group2 manager', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa nhóm' }))
    const source = screen.getByRole('button', { name: 'Kéo để sắp xếp tên Mai' })
    const target = screen.getByRole('button', { name: 'Kéo để sắp xếp tên Lan' })
    HTMLElement.prototype.setPointerCapture = vi.fn()
    document.elementFromPoint = vi.fn().mockReturnValue(target)
    fireEvent.pointerDown(source, { pointerId: 2, button: 0, isPrimary: true })
    fireEvent.pointerMove(source, { pointerId: 2, button: 0, isPrimary: true, clientY: 5 })
    fireEvent.pointerUp(source, { pointerId: 2, button: 0, isPrimary: true })
    await waitFor(async () => expect((await loadQuickSettings())?.value.group2NameSuggestions.slice(0, 2)).toEqual(['Mai', 'Lan']), { timeout: 3000 })
  })
  it('wipes on the third failure after a background autosave and allows publisher recovery', async () => {
    await saveCalculationWorkspace(fixture())
    await saveAppPreferences({ ...defaultAppPreferences(), pin: await createPinCredential('0123') })
    render(<AppGate><App /></AppGate>)
    fireEvent.change(await screen.findByLabelText('PIN mở khóa'), { target: { value: '0123' } })
    await screen.findByRole('button', { name: 'Tạo A4 mới' })
    await waitFor(() => expect(screen.queryByText('Đang mở dữ liệu đã mã hóa…')).toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button',{name:'Mở Tin nhắn'}))
    fireEvent.change(screen.getByLabelText('Dữ liệu Tin nhắn'),{target:{value:'lô b 11.22.5đ'}})
    fireEvent.click(screen.getByRole('button',{name:'Đóng Tin nhắn'}))
    fireEvent(window, new Event('pagehide'))
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const input = await screen.findByLabelText('PIN mở khóa')
      expect(input.getAttribute('type')).toBe('text')
      fireEvent.change(input, { target: { value: '0000' } })
        if (attempt < 3) await waitFor(async () => expect((await loadAppPreferences()).failedAttempts).toBe(attempt))
    }
    await waitFor(async () => expect((await loadCalculationWorkspace())?.value.data.groups1).toEqual([]))
    await waitFor(() => expect((screen.getByLabelText('PIN mở khóa') as HTMLInputElement).disabled).toBe(false))
    expect((await loadCalculationWorkspace())?.value.data.groups1).toEqual([])
    expect((await loadQuickSettings())?.value.group2NameSuggestions).toEqual(['Lan', 'Mai'])
    await new Promise((resolve) => setTimeout(resolve, 750))
    expect((await loadCalculationWorkspace())?.value.data.groups1).toEqual([])
    fireEvent.change(screen.getByLabelText('PIN mở khóa'), { target: { value: '1495' } })
    await screen.findByText('Chưa có A4')
    expect(screen.queryByRole('button', { name: /Mở A4 ngày/ })).toBeNull()
    expect((await loadQuickSettings())?.value.settingTypes[0].defaultCoefficientT).toBe('2')
  })
  it('finishes an interrupted wipe before allowing publisher unlock on startup', async () => {
    await saveCalculationWorkspace(fixture())
    await saveAppPreferences({ ...defaultAppPreferences(), pin: await createPinCredential('0123'), failedAttempts: 3, wipePending: true })
    render(<AppGate><App /></AppGate>)
    const input = await screen.findByLabelText('PIN mở khóa')
    expect((await loadCalculationWorkspace())?.value.data.groups1).toEqual([])
    expect((await loadQuickSettings())?.value.group2NameSuggestions).toEqual(['Lan', 'Mai'])
    fireEvent.change(input, { target: { value: '1945' } })
    await screen.findByText('Chưa có A4')
  })
  it('drags formula chips directly and persists the catalog order', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách nhóm thiết lập khác' }))
    const source = screen.getByRole('button', { name: 'LA', exact: true })
    const target = screen.getByRole('button', { name: 'LB', exact: true })
    HTMLElement.prototype.setPointerCapture = vi.fn()
    document.elementFromPoint = vi.fn().mockReturnValue(target)
    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 20, clientY: 100 })
    fireEvent.pointerUp(source, { pointerId: 1 })
    await waitFor(async () => expect((await loadCalculationWorkspace())?.value.data.settingTypes.slice(0, 2).map((type) => type.name)).toEqual(['LA', 'LB']), { timeout: 3000 })
  })
  it('automatically verifies four visible digits once and has no unlock button', async () => {
    await saveAppPreferences({ ...defaultAppPreferences(), pin: await createPinCredential('0123') })
    render(<AppGate><div>Opened by developer</div></AppGate>)
    const input = await screen.findByLabelText('PIN mở khóa')
    expect(input.getAttribute('type')).toBe('text')
    expect(screen.queryByRole('button', { name: 'Mở khóa' })).toBeNull()
    fireEvent.change(input, { target: { value: '194' } })
    expect(screen.queryByText('Opened by developer')).toBeNull()
    fireEvent.change(input, { target: { value: '1945' } })
    await screen.findByText('Opened by developer')
    expect((await loadAppPreferences()).failedAttempts).toBe(0)
  })
  it('filters alphabetic input out of the 1–7 results field', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Kết Quả' }))
    const input = screen.getByLabelText('1–7') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ab00123, 45\n67xyz' } })
    expect(input.value).toBe('00123, 45\n67')
  })
  it('opens from the card surface and keeps the delete action separate', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    const card = document.querySelector('.a4-library-card') as HTMLElement
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(card.querySelector('.library-card-delete') as HTMLElement)
    expect(document.querySelector('.a4-v2-page')).toBeNull()
    expect(await loadCalculationWorkspace()).not.toBeNull()
    fireEvent.click(card.querySelector('.library-card-calculation') as HTMLElement)
    expect(document.querySelector('.a4-v2-page')).not.toBeNull()
  })
  it('persists large greeting text and illustrated icons without storing markup', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(screen.getByRole('button', { name: 'Mở cài đặt' }))
    fireEvent.click(screen.getByRole('button', { name: /Lời chào/ }))
    const input = screen.getByLabelText('Nội dung lời chào') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Chào' } })
    input.setSelectionRange(4, 4)
    fireEvent.change(screen.getByLabelText('Cỡ chữ'), { target: { value: '48' } })
    fireEvent.change(screen.getByLabelText('Font chữ'), { target: { value: "'DG Great Vibes', cursive" } })
    fireEvent.click(screen.getByRole('button', { name: 'Chèn icon 💖' }))
    await waitFor(async () => {
      const greeting = (await loadQuickSettings())!.value.greeting
      expect(greeting.text).toBe('Chào💖')
      expect(greeting.fontSize).toBe('48')
      expect(greeting.fontFamily).toBe("'DG Great Vibes', cursive")
      expect(greeting.illustratedIcons).toEqual(['💖'])
    }, { timeout: 3000 })
    cleanup()
    await openApp()
    const greeting = document.querySelector('.home-greeting') as HTMLElement
    expect(greeting.style.fontSize).toBe('48px')
    expect(greeting.querySelector<HTMLImageElement>('.greeting-sticker img')?.alt).toBe('💖')
    expect(greeting.textContent).toBe('Chào')
  })
  it('keeps result fields on an internal numeric keypad without resetting paper scroll', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Kết Quả' }))
    const viewport = document.querySelector('.a4-v2-scroll') as HTMLElement
    viewport.scrollTop = 88
    const input = screen.getByLabelText('1–7') as HTMLTextAreaElement
    const gdb = screen.getByLabelText('GĐB') as HTMLInputElement
    expect(input.readOnly).toBe(false)
    expect(gdb.inputMode).toBe('none')
    fireEvent.focus(input)
    fireEvent.focus(gdb)
    for (const key of ['1', '2', '3', '4', '5', '6']) fireEvent.click(screen.getByRole('button', { name: `Nhập kết quả ${key}` }))
    expect(gdb.value).toBe('12345')
    expect((screen.getByRole('button', { name: 'Phân cách kết quả' }) as HTMLButtonElement).disabled).toBe(true)
    expect(viewport.scrollTop).toBe(88)
    expect(screen.queryByRole('button', { name: 'Xóa nhóm thiết lập', exact: true })).toBeNull()
  })
  for (const kind of ['group2', 'type'] as const) it(`moves ${kind} chips into and out of the always-visible drawer and saves visibility`, async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    const picker = document.querySelector(`[data-picker-kind="${kind}"]`) as HTMLElement
    const visible = picker.querySelector('[data-visible-row]') as HTMLElement
    const measured = [...picker.querySelectorAll<HTMLElement>('[data-measure-id]')]
    for (const button of measured) button.getBoundingClientRect = () => ({ width: 60 } as DOMRect)
    Object.defineProperty(visible, 'clientWidth', { configurable: true, value: 100 })
    fireEvent(window, new Event('resize'))
    const source = visible.querySelector('[data-picker-item]') as HTMLElement
    expect(source).not.toBeNull()
    const id = source.dataset.pickerItem!
    const trigger = picker.querySelector('[data-drawer-trigger]') as HTMLElement
    HTMLElement.prototype.setPointerCapture = vi.fn()
    document.elementFromPoint = vi.fn().mockReturnValue(trigger)
    fireEvent.pointerDown(source, { pointerId: 1, button: 0, isPrimary: true, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(source, { pointerId: 1, button: 0, isPrimary: true, clientX: 30, clientY: 20 })
    fireEvent.pointerUp(source, { pointerId: 1 })
    expect([...visible.querySelectorAll<HTMLElement>('[data-picker-item]')].some((item) => item.dataset.pickerItem === id)).toBe(false)
    await waitFor(async () => {
      const quick = (await loadQuickSettings())!.value
      expect(kind === 'group2' ? quick.hiddenGroup2Names : quick.hiddenSettingTypeIds).toContain(id)
    }, { timeout: 3000 })
    const drawerSource = [...picker.querySelectorAll<HTMLElement>('[data-drawer-body] [data-picker-item]')].find((item) => item.dataset.pickerItem === id)!
    const target = visible.querySelector('[data-picker-item]') ?? visible
    document.elementFromPoint = vi.fn().mockReturnValue(target)
    fireEvent.pointerDown(drawerSource, { pointerId: 2, button: 0, isPrimary: true, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(drawerSource, { pointerId: 2, button: 0, isPrimary: true, clientX: 30, clientY: 20 })
    fireEvent.pointerUp(drawerSource, { pointerId: 2 })
    expect([...visible.querySelectorAll<HTMLElement>('[data-picker-item]')].some((item) => item.dataset.pickerItem === id)).toBe(true)
    await waitFor(async () => {
      const quick = (await loadQuickSettings())!.value
      expect(kind === 'group2' ? quick.hiddenGroup2Names : quick.hiddenSettingTypeIds).not.toContain(id)
    }, { timeout: 3000 })
  })
  it('anchors pinch zoom under the finger midpoint, including two-finger panning', async () => {
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    const viewport = document.querySelector('.a4-v2-scroll') as HTMLElement
    const paper = document.querySelector('.a4-v2-page') as HTMLElement
    paper.getBoundingClientRect = () => ({ left: -viewport.scrollLeft, top: -viewport.scrollTop } as DOMRect)
    fireEvent.touchStart(viewport, { touches: [{ clientX: 100, clientY: 200 }, { clientX: 200, clientY: 200 }] })
    fireEvent.touchMove(viewport, { touches: [{ clientX: 50, clientY: 200 }, { clientX: 250, clientY: 200 }] })
    expect(paper.style.transform).toBe('scale(2)')
    expect(viewport.scrollLeft).toBe(150)
    expect(viewport.scrollTop).toBe(200)
    fireEvent.touchMove(viewport, { touches: [{ clientX: 70, clientY: 220 }, { clientX: 270, clientY: 220 }] })
    await waitFor(() => { expect(viewport.scrollLeft).toBe(130); expect(viewport.scrollTop).toBe(180) })
  })
  it('fixes paper height at the initial viewport size and ignores later keyboard shrink', async () => {
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(640)
    await saveCalculationWorkspace(fixture())
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    const paper = document.querySelector('.a4-v2-page') as HTMLElement
    expect(paper.style.height).toBe('640px')
    height.mockReturnValue(300)
    fireEvent(window, new Event('resize'))
    expect(paper.style.height).toBe('640px')
    expect((document.querySelector('.a4-v2-zoom-frame') as HTMLElement).style.height).toBe('640px')
  })
  it('edits names in the catalog cards without reorder controls', async () => {
    await saveCalculationWorkspace(fixture()); await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt nhóm thiết lập' }))
    fireEvent.change(screen.getByLabelText('Tên thiết lập la'), {target:{value:'LA riêng'}})
    expect(screen.queryByRole('button',{name:'Kéo để sắp xếp LA'})).toBeNull()
    await waitFor(async()=>expect((await loadCalculationWorkspace())!.value.data.settingTypes[1].name).toBe('LA riêng'),{timeout:3000})
  })
  it('changes an existing user PIN using 1945 as the current credential', async () => {
    await saveAppPreferences({ ...defaultAppPreferences(), pin: await createPinCredential('0123') })
    render(<AppGate><PinSettings /></AppGate>)
    fireEvent.change(await screen.findByLabelText('PIN mở khóa'), { target: { value: '1945' } })
    fireEvent.change(await screen.findByLabelText('PIN hiện tại'), { target: { value: '1945' } })
    fireEvent.change(screen.getByLabelText('PIN mới (4 số)'), { target: { value: '4567' } })
    fireEvent.change(screen.getByLabelText('Nhập lại PIN mới'), { target: { value: '4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi PIN' }))
    await screen.findByText(/Đã lưu PIN/)
    const saved = await loadAppPreferences()
    expect((await checkPin(saved, '4567')).ok).toBe(true)
    expect((await checkPin(saved, '0123')).ok).toBe(false)
    expect(saved.failedAttempts).toBe(0)
  })
  it('pastes clipboard contents once per field and clears each stored result independently', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const list = Array.from({ length: 26 }, (_, index) => String(index).padStart(2, '0')).join(', ')
    const readText = vi.fn().mockResolvedValueOnce(list).mockResolvedValueOnce(list).mockResolvedValueOnce('01234')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText } })
    try {
      await saveCalculationWorkspace(fixture())
      await openApp()
      fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Kết Quả' }))
      const input = screen.getByLabelText('1–7') as HTMLTextAreaElement
      const gdb = screen.getByLabelText('GĐB') as HTMLInputElement
      fireEvent.click(screen.getByRole('button', { name: 'Dán kết quả 1–7' }))
      await waitFor(() => expect(input.value).toBe(list))
      fireEvent.click(screen.getByRole('button', { name: 'Dán kết quả 1–7' }))
      await waitFor(() => expect(readText).toHaveBeenCalledTimes(2))
      expect(input.value).toBe(list)
      fireEvent.blur(input)
      fireEvent.click(screen.getByRole('button', { name: 'Dán GĐB' }))
      await waitFor(() => expect(gdb.value).toBe('01234'))
      fireEvent.blur(gdb)
      await waitFor(async () => expect((await loadCalculationWorkspace())!.value.data.groups1[0].drawData).toEqual({ oneToSeven: list.split(', '), gdb: '01234' }), { timeout: 3000 })
      fireEvent.click(screen.getByRole('button', { name: 'Xóa hết kết quả 1–7' }))
      expect(input.value).toBe('')
      expect(gdb.value).toBe('01234')
      await waitFor(async () => expect((await loadCalculationWorkspace())!.value.data.groups1[0].drawData).toEqual({ oneToSeven: [], gdb: '01234' }), { timeout: 3000 })
      fireEvent.click(screen.getByRole('button', { name: 'Xóa hết GĐB' }))
      await waitFor(async () => expect((await loadCalculationWorkspace())!.value.data.groups1[0].drawData).toEqual({ oneToSeven: [], gdb: '' }), { timeout: 3000 })
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
  it('rejects invalid 1–7 data without showing the long parser warning', async () => {
    const data = fixture()
    data.data.groups1[0].drawData = { oneToSeven: Array.from({ length: 26 }, (_, index) => String(index).padStart(2, '0')), gdb: '01234' }
    await saveCalculationWorkspace(data)
    await openApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Kết Quả' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tính Toán' }))
    const input = screen.getByLabelText('1–7')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.blur(input)
    expect(document.querySelector('.feedback.is-error')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng', exact: true }))
    expect(document.querySelector('.feedback.is-error')).toBeNull()
    expect((await loadCalculationWorkspace())!.value.data.groups1[0].drawData.oneToSeven).toHaveLength(26)
  })
  it('applies enabled retention before showing the A4 archive and keeps current pages', async () => {
    const workspace = fixture()
    workspace.data.groups1.push({ ...workspace.data.groups1[0], id: 'old', dateLabel: '01/01/2000', groups2: [] })
    await saveCalculationWorkspace(workspace)
    await saveAppPreferences({ ...defaultAppPreferences(), retention: { enabled: true, days: 13 } })
    await openApp()
    expect(screen.queryByRole('button', { name: 'Mở A4 ngày 01/01/2000' })).toBeNull()
    expect((await loadCalculationWorkspace())?.value.data.groups1.map((page) => page.id)).toEqual(['a4'])
  })
})




it('keeps shared All settings outside the selected type and persists them on reload', async () => {
  await saveCalculationWorkspace(fixture())
  await openApp()
  fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt nhóm thiết lập' }))
  const markers=screen.getByLabelText('Ký tự xác định điểm') as HTMLInputElement
  const separators=screen.getByLabelText('Ký tự phân tách') as HTMLInputElement
  expect(markers.closest('.type-editor')).toBeNull()
  fireEvent.change(markers,{target:{value:'p&đ'}})
  fireEvent.change(separators,{target:{value:'-'}})
  fireEvent.focus(screen.getByLabelText('Tên thiết lập la'))
  expect(markers.value).toBe('p&đ')
  expect(separators.value).toBe('-')
  await waitFor(async()=>expect((await loadCalculationWorkspace())?.value.data.allInputConfig).toEqual({markers:'p&đ',separators:'-'}),{timeout:3000})
  cleanup()
  await openApp()
  fireEvent.click(await screen.findByRole('button', { name: /Mở A4 ngày/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt nhóm thiết lập' }))
  expect((screen.getByLabelText('Ký tự xác định điểm') as HTMLInputElement).value).toBe('p&đ')
  expect((screen.getByLabelText('Ký tự phân tách') as HTMLInputElement).value).toBe('-')
})

it('opens both coefficient settings without a publisher PIN and permits reset',async()=>{
 const f=fixture();f.data.settingTypes[0].name='LB riêng';await saveCalculationWorkspace(f)
 await openApp();fireEvent.click(await screen.findByRole('button',{name:/Mở A4 ngày/}))
 fireEvent.click(screen.getByRole('button',{name:'Cài đặt nhóm thiết lập'}))
 expect(screen.queryByLabelText('PIN cài đặt')).toBeNull()
 fireEvent.change(screen.getByLabelText('LB riêng Hệ số Đánh'),{target:{value:'3'}})
 fireEvent.change(screen.getByLabelText('LB riêng Hệ số Trúng'),{target:{value:'4'}})
 fireEvent.click(screen.getByRole('button',{name:'Đóng cửa sổ chỉnh sửa'}))
 fireEvent.click(screen.getByRole('button',{name:'Cài đặt nhóm thiết lập'}))
 fireEvent.click(screen.getAllByRole('button',{name:'Reset tên',exact:true})[0])
 fireEvent.click(screen.getByRole('button',{name:'Đóng cửa sổ chỉnh sửa'}))
 fireEvent.click(screen.getByRole('button',{name:'Cài đặt hệ số theo tên'}))
 const input=screen.getByLabelText('LB Hệ số Đánh');fireEvent.change(input,{target:{value:'7'}});fireEvent.blur(input)
 fireEvent.click(screen.getByRole('button',{name:'Đóng hệ số theo tên'}))
 await waitFor(async()=>{
  const data=(await loadCalculationWorkspace())!.value.data
  expect(data.settingTypes[0]).toMatchObject({name:'LB',defaultCoefficientD:'3',defaultCoefficientT:'4'})
  expect(data.nameCoefficientTypes!.lan[0].defaultCoefficientD).toBe('7')
 },{timeout:3000})
})

it('uses messages as the only entry UI, preserves old rows, and reloads invalid messages without calculating them',async()=>{
 await saveCalculationWorkspace(fixture());await openApp();fireEvent.click(await screen.findByRole('button',{name:/Mở A4 ngày/}))
 expect(screen.queryByLabelText('Liệt kê')).toBeNull()
 expect(screen.queryByLabelText('Danh sách thiết lập')).toBeNull()
 expect(screen.getByLabelText('Dữ liệu nhóm thiết lập').textContent).toBe('00 | 1 Điểm')
 const trigger=screen.getByRole('button',{name:'Mở Tin nhắn'})
 expect(trigger.parentElement?.firstElementChild).toBe(trigger)
 fireEvent.click(trigger)
 expect(screen.getByRole('dialog',{name:'Tin nhắn'}).classList.contains('message-editor')).toBe(true)
 fireEvent.change(screen.getByLabelText('Dữ liệu Tin nhắn'),{target:{value:'lô b 070.5đ'}})
 fireEvent.click(screen.getByRole('button',{name:'Đóng Tin nhắn'}))
 expect(screen.getByLabelText('Dữ liệu nhóm thiết lập').textContent).toContain('07, 70 | 5 Điểm')
 fireEvent.click(screen.getByRole('button',{name:'Mở Tin nhắn'}))
 fireEvent.change(screen.getByLabelText('Dữ liệu Tin nhắn'),{target:{value:'hdhdhh 11 22'}})
 fireEvent.click(screen.getByRole('button',{name:'Đóng Tin nhắn'}))
 await waitFor(async()=>{
  const g=(await loadCalculationWorkspace())!.value.data.groups1[0].groups2[0]
  expect(g.groups3).toHaveLength(1);expect(g.groups3[0].listing).toBe('00')
  expect(g.allEntries?.[0].text).toBe('hdhdhh 11 22')
 },{timeout:3000})
 cleanup();await openApp();fireEvent.click(await screen.findByRole('button',{name:/Mở A4 ngày/}))
 fireEvent.click(screen.getByRole('button',{name:'Mở Tin nhắn'}))
 expect((screen.getByLabelText('Dữ liệu Tin nhắn') as HTMLTextAreaElement).value).toBe('hdhdhh 11 22')
 fireEvent.change(screen.getByLabelText('Dữ liệu Tin nhắn'),{target:{value:''}})
 fireEvent.click(screen.getByRole('button',{name:'Đóng Tin nhắn'}))
 await waitFor(async()=>expect((await loadCalculationWorkspace())!.value.data.groups1[0].groups2[0].allEntries).toEqual([]),{timeout:3000})
})

it('toggles shared/private amounts for name and combined views and persists the choice',async()=>{
 const f=fixture();const type=f.data.settingTypes[0];type.defaultCoefficientD='2';type.defaultCoefficientT='3'
 f.data.groups1[0].groups2[0].groups3[0].listing='12';f.data.groups1[0].groups2[0].groups3[0].point='5'
 f.data.groups1[0].drawData.gdb='12312'
 f.data.nameCoefficientTypes={lan:f.data.settingTypes.map(t=>({...t,defaultCoefficientD:'7',defaultCoefficientT:'11'}))}
 f.editorState.calculationEnabled=true;f.editorState.drawGdb='12312'
 await saveCalculationWorkspace(f);await openApp();fireEvent.click(await screen.findByRole('button',{name:/Mở A4 ngày/}))
 const value=(name:string)=>document.querySelector(`.a4-v2-section-results.is-visible .a4-v2-result-${name} b`)?.textContent
 expect(value('d')).toBe('10');expect(value('t')).toBe('15')
 fireEvent.click(screen.getByRole('button',{name:'Xem'}))
 expect((screen.getByLabelText('Hệ số riêng') as HTMLInputElement).checked).toBe(false)
 fireEvent.click(screen.getByLabelText('Hệ số riêng'))
 expect(value('d')).toBe('10');expect(value('t')).toBe('15')
 fireEvent.click(screen.getByRole('button',{name:'Lan',exact:true}))
 expect(value('d')).toBe('35')
 fireEvent.click(screen.getAllByRole('button',{name:'Quay lại'})[0])
 fireEvent.click(screen.getByRole('button',{name:'Xem'}));fireEvent.click(screen.getByLabelText('Hệ số riêng'))
 expect(value('d')).toBe('10')
 fireEvent.click(screen.getByLabelText('Hệ số riêng'))
 await waitFor(async()=>expect((await loadCalculationWorkspace())!.value.editorState.usePrivateCoefficients).toBe(true),{timeout:3000})
 cleanup();await openApp();fireEvent.click(await screen.findByRole('button',{name:/Mở A4 ngày/}))
 expect(value('d')).toBe('10');expect(value('t')).toBe('15')
})
