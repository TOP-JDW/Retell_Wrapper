import { redirect } from 'next/navigation'
import { database } from '../../lib/auth'
import { minimumPasswordLength, maximumPasswordLength } from '../../lib/members'
import { setPassword } from './actions'
import { AuthShell } from '../components/AuthShell'
import { SubmitButton } from '../components/SubmitButton'

export const metadata = { title: 'Choose a password' }

const problems: Record<string, string> = {
  short: `Use at least ${minimumPasswordLength} characters.`,
  long: 'That password is too long.',
  mismatch: 'The two passwords do not match.',
  failed: 'The password could not be set. Try a longer or less common password.'
}

export default async function SetPassword({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const db = await database()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')
  const {error} = await searchParams
  return <AuthShell>
    <header><h1>Choose a password</h1><p>You will use it with your email address to sign in.</p></header>
    <form action={setPassword}>
      <label>New password<input type="password" name="password" autoComplete="new-password" required minLength={minimumPasswordLength} maxLength={maximumPasswordLength}/></label>
      <label>Confirm password<input type="password" name="confirm" autoComplete="new-password" required minLength={minimumPasswordLength} maxLength={maximumPasswordLength}/></label>
      {error && problems[error] && <p role="alert">{problems[error]}</p>}
      <SubmitButton pending="Saving…">Save password</SubmitButton>
    </form>
  </AuthShell>
}
