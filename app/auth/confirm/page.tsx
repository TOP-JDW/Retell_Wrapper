import Link from 'next/link'
import { AuthShell } from '../../components/AuthShell'
import { acceptInvite } from './actions'
import { SubmitButton } from '../../components/SubmitButton'

// The invitation email links here. The token is only used when the person presses the button,
// because email security scanners open links automatically and would otherwise use it up.
export const metadata = { title: 'Accept invitation', referrer: 'no-referrer' }

export default async function Confirm({searchParams}: {searchParams: Promise<{token_hash?: string; type?: string}>}) {
  const {token_hash, type} = await searchParams
  if (!token_hash || type !== 'invite') return <AuthShell>
    <header><h1>This link does not work</h1><p>The invitation link is incomplete. Ask an owner to send a new invitation.</p></header>
    <Link className="button" href="/login">Go to sign-in</Link>
  </AuthShell>
  return <AuthShell>
    <header><h1>Accept your invitation</h1><p>Next, you choose a password and join the workspace.</p></header>
    <form action={acceptInvite}><input type="hidden" name="token_hash" value={token_hash}/><SubmitButton pending="Accepting…">Accept invitation</SubmitButton></form>
  </AuthShell>
}
