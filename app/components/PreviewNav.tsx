'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The client portal's menu inside the preview. Highlights the page you are on.
export function PreviewNav({ base }: { base: string }) {
  const path = usePathname()
  const items = [['', 'Dashboard'], ['/calls', 'Calls'], ['/agents', 'Agents']] as const
  return <nav className="cp-nav" aria-label="Client portal">{items.map(([suffix, label]) => {
    const href = `${base}${suffix}`
    return <Link key={label} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>
  })}</nav>
}
