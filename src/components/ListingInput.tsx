import { useImperativeHandle, useLayoutEffect, useRef, type Ref, type FocusEventHandler } from 'react'
import { cleanListingInput } from '../core/input-text'

export default function ListingInput({ value, onChange, onBlur, onFocus, label, inputRef }: {
  value: string
  onChange: (value: string) => void
  onBlur?: FocusEventHandler<HTMLTextAreaElement>
  onFocus?: FocusEventHandler<HTMLTextAreaElement>
  label: string
  inputRef?: Ref<HTMLTextAreaElement>
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null)
  useImperativeHandle(inputRef, () => localRef.current!, [])
  useLayoutEffect(() => {
    const input = localRef.current
    if (!input) return
    const resize = () => {
      input.style.height = 'auto'
      input.style.height = `${Math.max(44, input.scrollHeight + 2)}px`
    }
    resize()
    if (typeof ResizeObserver === 'undefined') return
    let width = input.clientWidth
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) { width = input.clientWidth; resize() }
    })
    observer.observe(input)
    return () => observer.disconnect()
  }, [value])
  return <textarea
    ref={localRef}
    className="listing-input" rows={1} value={value} readOnly={Boolean(onFocus)} inputMode={onFocus ? "none" : "decimal"} autoComplete="off" autoCorrect="off" spellCheck={false}
    onChange={(event) => onChange(cleanListingInput(event.target.value))} onBlur={onBlur} onFocus={onFocus} aria-label={label}
  />
}
