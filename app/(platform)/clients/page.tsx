import Link from 'next/link'
import { member } from '../../../lib/auth'
import { maximumClientName } from '../../../lib/clients'
import { addClient } from './actions'
import { clientNotices, clientProblems } from './messages'

export default async function Clients({searchParams}: {searchParams: Promise<{notice?: string; error?: string}>}) {
  const {notice, error} = await searchParams
  const {db, membership} = await member()
  const isStaff = membership.role === 'owner' || membership.role === 'admin'
  const {data: clients, error: loadError} = await db.from('clients').select('id,name')
    .eq('workspace_id', membership.workspace_id).order('name', {ascending: true}).limit(500)
  if (loadError) throw new Error('Clients could not load.')
  const {data: links, error: linkError} = await db.from('agents').select('client_id')
    .eq('workspace_id', membership.workspace_id).eq('is_transfer_agent', false).not('client_id', 'is', null).limit(5000)
  if (linkError) throw new Error('Clients could not load.')
  const agentCounts = new Map<string, number>()
  for (const {client_id} of links) agentCounts.set(client_id, (agentCounts.get(client_id) ?? 0) + 1)

  return <div className="stack">
    <header className="page-head"><div><h1>Client Management</h1>
      <p>The businesses your agents work for. Open a client to see its agents and calls.</p></div></header>
    {notice && clientNotices[notice] && <p role="status" className="notice success">{clientNotices[notice]}</p>}
    {error && clientProblems[error] && <p role="alert" className="notice problem">{clientProblems[error]}</p>}
    <div className="panel">{clients.length === 0
      ? <div className="empty"><strong>No clients yet</strong>
          <p>{isStaff ? 'Add your first client below, then link its agents on My Agents.' : 'An owner or admin can add clients.'}</p></div>
      : <div className="table-scroll"><table>
          <thead><tr><th>Client</th><th className="num">Agents</th></tr></thead>
          <tbody>{clients.map(client => <tr key={client.id}>
            <td className="primary-cell"><Link className="row-link" href={`/clients/${client.id}`}>{client.name}</Link></td>
            <td className="num">{agentCounts.get(client.id) ?? 0}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    {isStaff && <section className="panel panel-body" aria-labelledby="add-client">
      <div className="section-head"><h2 id="add-client">Add a client</h2></div>
      <form action={addClient} className="add-row">
        <label>Client name<input name="name" required maxLength={maximumClientName} autoComplete="off"/></label>
        <button>Add client</button>
      </form>
    </section>}
  </div>
}
