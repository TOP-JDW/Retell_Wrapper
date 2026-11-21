'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Typing in a box, or using a modifier key, never triggers a shortcut.
export const typing = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  return event.metaKey || event.ctrlKey || event.altKey || !!target?.closest('input, textarea, select, [contenteditable="true"]')
}

// Newer and older call buttons, with P and N as shortcuts.
export function CallNav({ newer, older }: { newer: string | null; older: string | null }) {
  const router = useRouter()
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (typing(event)) return
      const to = event.key === 'n' || event.key === 'N' ? older : event.key === 'p' || event.key === 'P' ? newer : null
      if (to) { event.preventDefault(); router.push(to) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [newer, older, router])
  return <nav className="call-nav" aria-label="Other calls">
    {newer ? <Link className="button quiet-link" href={newer} aria-keyshortcuts="P">‹ Newer call <kbd>P</kbd></Link> : <span className="button quiet-link disabled" aria-disabled="true">‹ Newer call</span>}
    {older ? <Link className="button quiet-link" href={older} aria-keyshortcuts="N">Older call <kbd>N</kbd> ›</Link> : <span className="button quiet-link disabled" aria-disabled="true">Older call ›</span>}
  </nav>
}
