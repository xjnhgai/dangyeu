// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import EntryDock from '../../src/components/EntryDock'
import ResultsEditor from '../../src/components/ResultsEditor'
afterEach(cleanup)
function Dock() {
  const [listing, setListing] = useState('12,34')
  return <EntryDock rowId="test" title="Test" listing={listing} point="1" saved={false} onListing={setListing} onPoint={() => {}} onCommit={() => {}} onClose={() => {}} formulaId="la" />
}
function Results() {
  const [value, setValue] = useState('')
  return <ResultsEditor oneToSeven={value} gdb="" onOneToSeven={setValue} onGdb={() => {}} onOneToSevenBlur={() => {}} onGdbBlur={() => {}} count={0} valid enabled={false} gdbValid onToggle={() => {}} onClear={() => {}} />
}
describe('editing position and expansion', () => {
  it('replaces selected listing characters and retains the insertion position', async () => {
    render(<Dock />)
    const input = screen.getByLabelText('Liệt kê đang nhập') as HTMLTextAreaElement
    input.setSelectionRange(0, 2)
    fireEvent.click(screen.getByRole('button', { name: 'Nhập 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nhập 6' }))
    expect(input.value).toBe('56,34')
    await waitFor(() => expect(input.selectionStart).toBe(2))
  })
  it('groups keypad input, preserves leading zeros and expands the results textarea', () => {
    const getter = vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(320)
    render(<Results />)
    const input = screen.getByLabelText('1–7') as HTMLTextAreaElement
    fireEvent.focus(input)
    for (const key of ',7001234') fireEvent.click(screen.getByRole('button', { name: key === ',' ? 'Phân cách kết quả' : `Nhập kết quả ${key}` }))
    expect(input.value).toBe(',7 00 12 34 ')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa ký tự kết quả' }))
    expect(input.value).toBe(',7 00 12 34')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa ký tự kết quả' }))
    expect(input.value).toBe(',7 00 12 3')
    expect(input.readOnly).toBe(false)
    expect(input.style.height).toBe('322px')
    getter.mockRestore()
  })
})
