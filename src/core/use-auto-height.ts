import { useLayoutEffect, type RefObject } from 'react'

export function useAutoHeight(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const input = ref.current
    if (!input) return
    const resize = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight + 2}px` }
    resize()
    if (typeof ResizeObserver === 'undefined') return
    let width = input.clientWidth
    const observer = new ResizeObserver(() => { if (width !== input.clientWidth) { width = input.clientWidth; resize() } })
    observer.observe(input)
    return () => observer.disconnect()
  }, [ref, value])
}
