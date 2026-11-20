import Link from 'next/link'
import { member } from '../../../lib/auth'
import { formatTime } from '../../../lib/format'
import { retellConfigured } from '../../../lib/retell-server'
import { maximumCalls } from '../../../lib/retell'
import { importFromRetell } from './actions'
import { linkAgent } from '../clients/actions'

const problems: Record<string, string> = {
  owner: 'Only owners can import from Retell.',
  not_configured: 'Retell is not connected. Add RETELL_API_KEY to the app settings and restart the app.',
  retell_rejected: 'Retell refused the key. Check that it is correct and allows reading agents and call history.',
  retell_rate: 'Retell is limiting requests right now. Wait a minute and try again.',
  retell_unavailable: 'Retell could not be reached. Try again shortly.',
  retell_unexpected: 'Retell sent a reply the app did not expect. Nothing was saved.',
  save: 'The data could not be saved. Try again.',
  link: 'The client link could not be saved. Try again.',
  staff: 'Only owners and admins can link agents to clients.'
}
const count = (value?: string) => Math.min(Number.parseInt(value ?? '', 10) || 0, 1_000_000)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default async function Agents({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const query = await searchParams
  const {db, membership} = await member()
  const isOwner = membership.role === 'owner'
  const isStaff = isOwner || membership.role === 'admin'
  const showTransfers = query.transfers === '1'
  let agentQuery = db.from('agents').select('id,name,client_id,is_suspended,is_transfer_agent,retell_modified_at')
    .eq('workspace_id', membership.workspace_id).order('name', {ascending: true}).limit(100)
  if (!showTransfers) agentQuery = agentQuery.eq('is_transfer_agent', false)
  const {data, error} = await agentQuery
  if (error) throw new Error('Agents could not load.')
  const {count: transferCount, error: transferError} = await db.from('agents').select('*', {count: 'exact', head: true})
    .eq('workspace_id', membership.workspace_id).eq('is_transfer_agent', true)
  if (transferError) throw new Error('Agents could not load.')
  const transfers = transferCount ?? 0
  const {data: clients, error: clientError} = await db.from('clients').select('id,name')
    .eq('workspace_id', membership.workspace_id).order('name', {ascending: true}).limit(500)
  if (clientError) throw new Error('Agents could not load.')
  const clientNames = new Map(clients.map(client => [client.id, client.name]))

  const problem = query.error && problems[query.error]
  const skipped = count(query.skipped)
  const connected = retellConfigured()
  return <div className="stack">
    <header className="page-head">
      <div><h1>My Agents</h1><p>Your voice agents from Retell. A copy is kept here and refreshed when an owner imports.</p></div>
      {isOwner && connected && <form action={importFromRetell}><button>Import from Retell</button></form>}
    </header>
    {query.notice === 'imported' && <p role="status" className="notice success">
      Imported {plural(count(query.agents), 'agent')} and {plural(count(query.calls), 'call')} from Retell.
      {skipped > 0 && ` ${plural(skipped, 'item')} could not be used and ${skipped === 1 ? 'was' : 'were'} skipped.`}
      {query.more === '1' && ` Retell has more data than one import reads. Only the ${maximumCalls.toLocaleString('en-GB')} most recent calls are imported.`}
    </p>}
    {query.notice === 'linked' && <p role="status" className="notice success">Client link saved.</p>}
    {problem && <p role="alert" className="notice problem">{problem}</p>}
    {isOwner && !connected && <p className="notice problem">Retell is not connected. Add RETELL_API_KEY to the app settings and restart the app.</p>}
    <div className="panel">{data.length === 0
      ? <div className="empty"><strong>{transfers > 0 && !showTransfers ? 'No agents to show' : 'No agents yet'}</strong>
          <p>{isOwner ? 'Use Import from Retell to bring in your voice agents.' : 'An owner can import your voice agents from Retell.'}</p></div>
      : <div className="table-scroll"><table>
          <thead><tr><th>Name</th><th>Client</th><th>Status</th><th>Last changed in Retell</th></tr></thead>
          <tbody>{data.map(agent => <tr key={agent.id}>
            <td className="primary-cell"><Link className="row-link" href={`/agents/${agent.id}`}>{agent.name}</Link>{agent.is_transfer_agent && <span className="sub">Transfer agent</span>}</td>
            {isStaff
              ? <td><form action={linkAgent} className="inline"><input type="hidden" name="agent_id" value={agent.id}/>
                  <select name="client_id" defaultValue={agent.client_id ?? ''} aria-label={`Client for ${agent.name}`}>
                    <option value="">No client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select><button className="quiet small">Save</button></form></td>
              : <td className={agent.client_id ? '' : 'unlinked'}>{(agent.client_id && clientNames.get(agent.client_id)) || 'No client'}</td>}
            <td><span className={`pill ${agent.is_suspended ? 'warn' : 'ok'}`}>{agent.is_suspended ? 'Suspended' : 'Active'}</span></td>
            <td className="muted">{formatTime(agent.retell_modified_at)}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    {transfers > 0 && <p className="hint">{showTransfers
      ? <Link href="/agents">Hide transfer agents</Link>
      : <Link href="/agents?transfers=1">Show transfer agents ({transfers} hidden)</Link>}</p>}
    <p className="hint">{isOwner
      ? `The import reads your voice agents and the ${maximumCalls.toLocaleString('en-GB')} most recent calls. Nothing is changed in Retell, and phone numbers, transcripts and recordings are not saved.`
      : 'Only owners can import from Retell.'}</p>
  </div>
}
