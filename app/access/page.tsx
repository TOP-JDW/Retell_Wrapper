import { AuthShell } from '../components/AuthShell'
import { signOut } from '../login/actions'
import { SubmitButton } from '../components/SubmitButton'

export const metadata = { title: 'Access needed' }

export default function Access() {
  return <AuthShell>
    <header><h1>You need access</h1><p>Your account is not part of a workspace yet. Ask an owner to invite you.</p></header>
    <form action={signOut}><SubmitButton className="quiet" pending="Signing out…">Back to sign-in</SubmitButton></form>
  </AuthShell>
}
