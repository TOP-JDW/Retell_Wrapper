import Link from 'next/link'
import type { ReactNode } from 'react'
import { member } from '../../lib/auth'
import { sections } from '../../lib/sections'
import { signOut } from '../login/actions'
export const dynamic = 'force-dynamic'
export default async function Platform({children}: {children: ReactNode}) {
  await member()
  return <div className="shell"><aside><strong>Voice Operations</strong><nav aria-label="Workspace">{sections.map(([url,label]) => <Link key={url} href={'/'+url}>{label}</Link>)}</nav>
    <form action={signOut}><button>Sign out</button></form></aside><main>{children}</main></div>
}
