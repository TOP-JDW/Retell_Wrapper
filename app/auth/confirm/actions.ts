'use server'
import { redirect } from 'next/navigation'
import { database } from '../../../lib/auth'

export async function acceptInvite(form: FormData) {
  const tokenHash = String(form.get('token_hash') ?? '')
  if (!tokenHash || tokenHash.length > 512) redirect('/login?error=invite')
  const db = await database(true)
  const { error } = await db.auth.verifyOtp({ type: 'invite', token_hash: tokenHash })
  if (error) redirect('/login?error=invite')
  redirect('/set-password')
}
