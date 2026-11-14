import { useEffect } from 'react'

/** Keep fixed sheets above the keyboard without disabling manual page zoom. */
export function useEditorViewport(): void {
  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return
      const visibleHeight = viewport?.height ?? window.innerHeight
      const keyboardInset = Math.max(0, window.innerHeight - visibleHeight - (viewport?.offsetTop ?? 0))
      document.documentElement.style.setProperty('--visible-height', `${visibleHeight}px`)
      document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`)
      document.documentElement.style.setProperty('--editor-bottom', `${keyboardInset + (keyboardInset > 100 ? 8 : 61)}px`)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      for (const name of ['--visible-height', '--keyboard-inset', '--editor-bottom']) document.documentElement.style.removeProperty(name)
    }
  }, [])
}
