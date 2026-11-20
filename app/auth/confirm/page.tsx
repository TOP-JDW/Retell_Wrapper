import Link from 'next/link'
import { acceptInvite } from './actions'

// The invitation email links here. The token is only used when the person presses the button,
// because email security scanners open links automatically and would otherwise use it up.
export const metadata = { title: 'Accept invitation · Voice Operations', referrer: 'no-referrer' }

export default async function Confirm({searchParams}: {searchParams: Promise<{token_hash?: string; type?: string}>}) {
  const {token_hash, type} = await searchParams
  if (!token_hash || type !== 'invite') return <main className="card"><h1>Invitation not valid</h1>
    <p>This link is incomplete. Ask an owner to send a new invitation.</p><Link href="/login">Go to sign-in</Link></main>
  return <main className="card"><small>VOICE OPERATIONS</small><h1>Accept your invitation</h1>
    <p>Continue to choose a password and join the workspace.</p>
    <form action={acceptInvite}><input type="hidden" name="token_hash" value={token_hash}/><button>Accept invitation</button></form></main>
}
