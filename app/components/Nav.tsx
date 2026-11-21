'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const draw = (children: ReactNode) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>

const icons: Record<string, ReactNode> = {
  dashboard: draw(<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>),
  agents: draw(<><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></>),
  calls: draw(<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>),
  clients: draw(<><path d="M4 21V6l8-3 8 3v15"/><path d="M9 21v-5h6v5M9 9h.01M15 9h.01M9 12.5h.01M15 12.5h.01"/></>),
  usage: draw(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>),
  permissions: draw(<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/></>),
  activity: draw(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  settings: draw(<><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.9 1.5-1.6 0-1.4-1-1.9-1-3 0-1 .8-1.9 2-1.9h2.3A4.2 4.2 0 0 0 21 10.3C21 6.2 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></>)
}

// Highlights the page you are on. Everything else in the shell is server-rendered.
export function Nav({ items }: { items: readonly (readonly [string, string])[] }) {
  const path = usePathname()
  return <nav className="nav" aria-label="Main">{items.map(([key, label]) => {
    const href = `/${key}`
    const current = path === href || path.startsWith(`${href}/`)
    return <Link key={key} href={href} className="nav-link" aria-current={current ? 'page' : undefined}>{icons[key]}<span>{label}</span></Link>
  })}</nav>
}
