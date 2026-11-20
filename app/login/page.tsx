import { AuthShell } from '../components/AuthShell'
import { signIn } from './actions'

export const metadata = { title: 'Sign in' }

export default async function Login({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const {error} = await searchParams
  return <AuthShell>
    <header><h1>Sign in</h1><p>Use your work email and password.</p></header>
    <form action={signIn}>
      <label>Email address<input type="email" autoComplete="username" name="email" required maxLength={320}/></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={1024}/></label>
      {error && <p role="alert">{error === 'invite' ? 'That invitation link has expired or has already been used. Ask an owner to send a new one.' : 'Sign-in failed. Check your details and try again.'}</p>}
      <button>Sign in</button>
    </form>
  </AuthShell>
}
