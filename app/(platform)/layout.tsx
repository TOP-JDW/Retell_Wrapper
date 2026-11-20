import type { ReactNode } from 'react'
import { member } from '../../lib/auth'
import { sections } from '../../lib/sections'
import { capitalise } from '../../lib/status'
import { Nav } from '../components/Nav'
import { QuickSearch } from '../components/QuickSearch'
import { signOut } from '../login/actions'
import { SubmitButton } from '../components/SubmitButton'
import { cookies } from 'next/headers'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { parseTheme, themeCookie } from '../../lib/theme'

export const dynamic = 'force-dynamic'

export default async function Platform({children}: {children: ReactNode}) {
  const {membership} = await member()
  const theme = parseTheme((await cookies()).get(themeCookie)?.value)
  return <div className="shell">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/brand/logo-reverse.png" alt="The One Point" width={200} height={122}/>
        <p>AI Voice</p>
      </div>
      <QuickSearch pages={sections}/>
      <Nav items={sections}/>
      <div className="sidebar-foot">
        <div className="sidebar-user"><strong>{membership.email ?? 'Signed in'}</strong><span>{capitalise(membership.role)}</span></div>
        <ThemeSwitch initial={theme}/>
        <form action={signOut}><SubmitButton pending="Signing out…">Sign out</SubmitButton></form>
      </div>
    </aside>
    <main className="content">{children}</main>
  </div>
}
