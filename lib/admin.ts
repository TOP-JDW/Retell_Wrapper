import 'server-only'
import { createClient } from '@supabase/supabase-js'

// The only place the Supabase secret key is read. It bypasses row-level security, so it is used solely
// to create and delete sign-in accounts for the owner-checked actions in app/(platform)/permissions/actions.ts.
// All workspace data is still read and written with the signed-in user's own session.
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Member management is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
