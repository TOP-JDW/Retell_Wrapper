import { signOut } from '../login/actions'
export default function Access() {
  return <main className="card"><h1>Workspace access required</h1><p>Ask your administrator to assign your account to a workspace.</p><form action={signOut}><button>Return to sign-in</button></form></main>
}
