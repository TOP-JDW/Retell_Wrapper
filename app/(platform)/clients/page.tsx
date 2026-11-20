import Link from 'next/link'
import { member } from '../../../lib/auth'
import { maximumClientName } from '../../../lib/clients'
import { addClient } from './actions'
import { clientNotices, clientProblems } from './messages'
import { DataTable } from '../../components/DataTable'
import { Flash } from '../../components/Flash'
import { SubmitButton } from '../../components/SubmitButton'

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
  const {data: colours, error: colourError} = await db.from('client_branding').select('client_id,accent_colour')
    .eq('workspace_id', membership.workspace_id).limit(500)
  if (colourError) throw new Error('Clients could not load.')
  const accentOf = new Map(colours.map(row => [row.client_id, row.accent_colour]))
  const agentCounts = new Map<string, number>()
  for (const {client_id} of links) agentCounts.set(client_id, (agentCounts.get(client_id) ?? 0) + 1)

  return <div className="stack">
    <header className="page-head"><div><h1>Client Management</h1>
      <p>The businesses your agents work for. Open a client to see its agents and calls.</p></div></header>
    <Flash success={notice && clientNotices[notice]} problem={error && clientProblems[error]}/>
    <div className="panel">{clients.length === 0
      ? <div className="empty"><strong>No clients yet</strong>
          <p>{isStaff ? 'Add your first client below, then link its agents on My Agents.' : 'An owner or admin can add clients.'}</p></div>
      : <DataTable label="Clients" searchHint="Search clients" columns={[{label: 'Client'}, {label: 'Agents', className: 'num', first: 'desc'}]}
          rows={clients.map(client => ({key: client.id, cells: [
            {value: client.name, className: 'primary-cell', content: <span className="client-name">
              <i className="swatch" style={{background: accentOf.get(client.id) ?? 'transparent'}} title={accentOf.has(client.id) ? `Brand colour ${accentOf.get(client.id)}` : 'No branding yet'}/>
              <Link className="row-link" href={`/clients/${client.id}`}>{client.name}</Link></span>},
            {value: agentCounts.get(client.id) ?? 0, text: '', className: 'num', content: agentCounts.get(client.id) ?? 0}
          ]}))}/>}
    </div>
    {isStaff && <section className="panel panel-body" aria-labelledby="add-client">
      <div className="section-head"><h2 id="add-client">Add a client</h2></div>
      <form action={addClient} className="add-row">
        <label>Client name<input name="name" required maxLength={maximumClientName} autoComplete="off"/></label>
        <SubmitButton pending="Adding…">Add client</SubmitButton>
      </form>
    </section>}
  </div>
}
