'use client'
import { useEffect } from 'react'

// While a form has unsaved changes, ask before the user leaves: closing or reloading the tab,
// or clicking a link inside the app.
export function useUnsavedWarning(dirty: boolean, message = 'You have unsaved changes. Leave without saving?') {
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const to = new URL(link.href, window.location.href)
      if (to.origin !== window.location.origin || (to.pathname === window.location.pathname && to.search === window.location.search)) return
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true) }
  }, [dirty, message])
}
