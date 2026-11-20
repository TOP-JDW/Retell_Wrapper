import Link from 'next/link'
import { member } from '../../../lib/auth'
import { formatTime } from '../../../lib/format'
import { retellConfigured } from '../../../lib/retell-server'
import { maximumCalls } from '../../../lib/retell'
import { importFromRetell } from './actions'

const problems: Record<string, string> = {
  owner: 'Only owners can import from Retell.',
  not_configured: 'Retell is not connected. Add RETELL_API_KEY to the app settings and restart the app.',
  retell_rejected: 'Retell refused the key. Check that it is correct and allows reading agents and call history.',
  retell_rate: 'Retell is limiting requests right now. Wait a minute and try again.',
  retell_unavailable: 'Retell could not be reached. Try again shortly.',
  retell_unexpected: 'Retell sent a reply the app did not expect. Nothing was saved.',
  save: 'The data could not be saved. Try again.'
}
const count = (value?: string) => Math.min(Number.parseInt(value ?? '', 10) || 0, 1_000_000)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default async function Agents({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const query = await searchParams
  const {db, membership} = await member()
  const isOwner = membership.role === 'owner'
  const showTransfers = query.transfers === '1'
  let agentQuery = db.from('agents').select('id,name,is_suspended,is_transfer_agent,retell_modified_at')
    .eq('workspace_id', membership.workspace_id).order('name', {ascending: true}).limit(100)
  if (!showTransfers) agentQuery = agentQuery.eq('is_transfer_agent', false)
  const {data, error} = await agentQuery
  if (error) throw new Error('Agents could not load.')
  const {count: transferCount, error: transferError} = await db.from('agents').select('*', {count: 'exact', head: true})
    .eq('workspace_id', membership.workspace_id).eq('is_transfer_agent', true)
  if (transferError) throw new Error('Agents could not load.')
  const transfers = transferCount ?? 0

  const problem = query.error && problems[query.error]
  const skipped = count(query.skipped)
  return <>
    <h1>My Agents</h1>
    {query.notice === 'imported' && <p role="status" className="notice">
      Imported {plural(count(query.agents), 'agent')} and {plural(count(query.calls), 'call')} from Retell.
      {skipped > 0 && ` ${plural(skipped, 'item')} could not be used and ${skipped === 1 ? 'was' : 'were'} skipped.`}
      {query.more === '1' && ` Retell has more data than one import reads. Only the ${maximumCalls.toLocaleString('en-GB')} most recent calls are imported.`}
    </p>}
    {problem && <p role="alert" className="notice problem">{problem}</p>}
    {data.length === 0 ? <p>{transfers > 0 && !showTransfers ? 'No agents to show.' : 'No agents have been imported.'}</p> :
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Last changed in Retell</th></tr></thead>
        <tbody>{data.map(agent => <tr key={agent.id}>
          <td>{agent.name}{agent.is_transfer_agent && ' (transfer agent)'}</td><td>{agent.is_suspended ? 'Suspended' : 'Active'}</td><td>{formatTime(agent.retell_modified_at)}</td>
        </tr>)}</tbody>
      </table>}
    {transfers > 0 && <p>{showTransfers
      ? <Link href="/agents">Hide transfer agents</Link>
      : <Link href="/agents?transfers=1">Show transfer agents ({transfers} hidden)</Link>}</p>}
    {isOwner ? <section aria-labelledby="import">
      <h2 id="import">Import from Retell</h2>
      <p>Reads your voice agents and the {maximumCalls.toLocaleString('en-GB')} most recent calls, and saves a copy here. Running it again updates the copy. Nothing is changed in Retell, and phone numbers, transcripts and recordings are not saved.</p>
      {retellConfigured() ? <form action={importFromRetell}><button>Import from Retell</button></form>
        : <p className="notice problem">Retell is not connected. Add RETELL_API_KEY to the app settings and restart the app.</p>}
    </section> : <p>Only owners can import from Retell.</p>}
  </>
}
