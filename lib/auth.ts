import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Configure the development Supabase project.')
  return { url, key }
}

export async function database(writable = false) {
  const jar = await cookies()
  const { url, key } = config()
  return createServerClient(url, key, { cookies: {
    getAll: () => jar.getAll(),
    setAll: (updates) => {
      if (writable) for (const { name, value, options } of updates) jar.set(name, value, options)
    }
  } })
}

export async function member() {
  const db = await database()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await db.from('memberships').select('workspace_id,role').eq('user_id', user.id).maybeSingle()
  if (error) throw new Error('Workspace lookup failed.')
  if (!data) redirect('/access')
  return { db, membership: data }
}
