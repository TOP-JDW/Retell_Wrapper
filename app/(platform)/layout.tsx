import type { ReactNode } from 'react'
import { member } from '../../lib/auth'
import { sections } from '../../lib/sections'
import { capitalise } from '../../lib/status'
import { Nav } from '../components/Nav'
import { signOut } from '../login/actions'

export const dynamic = 'force-dynamic'

export default async function Platform({children}: {children: ReactNode}) {
  const {membership} = await member()
  return <div className="shell">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/brand/logo-reverse.png" alt="The One Point" width={200} height={122}/>
        <p>AI Voice</p>
      </div>
      <Nav items={sections}/>
      <div className="sidebar-foot">
        <div className="sidebar-user"><strong>{membership.email ?? 'Signed in'}</strong><span>{capitalise(membership.role)}</span></div>
        <form action={signOut}><button>Sign out</button></form>
      </div>
    </aside>
    <main className="content">{children}</main>
  </div>
}
