'use server'
import { redirect } from 'next/navigation'
import { database } from '../../lib/auth'
import { checkPassword } from '../../lib/members'

export async function setPassword(form: FormData) {
  const password = String(form.get('password') ?? '')
  const problem = checkPassword(password, String(form.get('confirm') ?? ''))
  if (problem !== 'ok') redirect(`/set-password?error=${problem}`)
  const db = await database(true)
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await db.auth.updateUser({ password })
  if (error) redirect('/set-password?error=failed')
  redirect('/dashboard')
}
