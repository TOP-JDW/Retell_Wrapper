'use server'
import { redirect } from 'next/navigation'
import { database } from '../../lib/auth'

export async function signIn(form: FormData) {
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '')
  if (!email || !password || email.length > 320 || password.length > 1024) redirect('/login?error=1')
  const db = await database(true)
  const { error } = await db.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=1')
  redirect('/dashboard')
}

export async function signOut() {
  const db = await database(true)
  const { error } = await db.auth.signOut({ scope: 'local' })
  if (error) throw new Error('Sign-out failed. Please try again.')
  redirect('/login')
}
