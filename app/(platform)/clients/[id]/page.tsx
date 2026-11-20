import Link from 'next/link'
import { notFound } from 'next/navigation'
import { member } from '../../../../lib/auth'
import { latestCalls } from '../../../../lib/calls'
import { maximumClientName, parseId } from '../../../../lib/clients'
import { formatDuration, formatTime, plainWords } from '../../../../lib/format'
import { callTone, capitalise } from '../../../../lib/status'
import { ConfirmButton } from '../../../components/ConfirmButton'
import { ClientBrandingForm } from '../../../components/ClientBrandingForm'
import { defaultAccent, logoUrl } from '../../../../lib/branding'
import { deleteClient, renameClient, saveClientBranding } from '../actions'
import { clientNotices, clientProblems } from '../messages'

export default async function Client({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{notice?: string; error?: string}>}) {
  const id = parseId((await params).id)
  if (!id) notFound()
  const {notice, error} = await searchParams
  const {db, membership} = await member()
  const isStaff = membership.role === 'owner' || membership.role === 'admin'
  const {data: client, error: loadError} = await db.from('clients').select('id,name')
    .eq('id', id).eq('workspace_id', membership.workspace_id).maybeSingle()
  if (loadError) throw new Error('Client could not load.')
  if (!client) notFound()
  const {data: agents, error: agentError} = await db.from('agents').select('id,name,is_suspended,is_transfer_agent')
    .eq('workspace_id', membership.workspace_id).eq('client_id', id).order('name', {ascending: true}).limit(200)
  if (agentError) throw new Error('Client could not load.')
  const {data: branding, error: brandingError} = await db.from('client_branding').select('display_name,accent_colour,logo_mime,logo_base64')
    .eq('client_id', id).eq('workspace_id', membership.workspace_id).maybeSingle()
  if (brandingError) throw new Error('Client could not load.')
  const logo = logoUrl(branding?.logo_mime, branding?.logo_base64)
  const calls = await latestCalls(db, membership.workspace_id, 50, agents.map(agent => agent.id))
  const visible = agents.filter(agent => !agent.is_transfer_agent)

  return <div className="stack">
    <header className="page-head"><div>
      <p className="crumb"><Link href="/clients">Client Management</Link></p>
      <div className="client-head">
        {logo && <div className="logo-tile"><img src={logo} alt={`${client.name} logo`}/></div>}
        <div><h1>{client.name}</h1><p>{visible.length === 1 ? '1 agent' : `${visible.length} agents`} linked to this client.</p></div>
      </div>
    </div></header>
    {notice && clientNotices[notice] && <p role="status" className="notice success">{clientNotices[notice]}</p>}
    {error && clientProblems[error] && <p role="alert" className="notice problem">{clientProblems[error]}</p>}

    <section>
      <div className="section-head"><h2>Agents</h2>{isStaff && <Link href="/agents">Link agents</Link>}</div>
      <div className="panel">{visible.length === 0
        ? <div className="empty"><strong>No agents linked</strong><p>{isStaff ? 'Choose this client for an agent on My Agents.' : 'An owner or admin can link agents to this client.'}</p></div>
        : <table>
            <thead><tr><th>Name</th><th>Status</th></tr></thead>
            <tbody>{visible.map(agent => <tr key={agent.id}>
              <td className="primary-cell"><Link className="row-link" href={`/agents/${agent.id}`}>{agent.name}</Link></td>
              <td><span className={`pill ${agent.is_suspended ? 'warn' : 'ok'}`}>{agent.is_suspended ? 'Suspended' : 'Active'}</span></td>
            </tr>)}</tbody>
          </table>}
      </div>
    </section>

    <section id="branding" className="panel panel-body" aria-labelledby="branding-title">
      <div className="section-head"><h2 id="branding-title">Branding</h2></div>
      {isStaff
        ? <ClientBrandingForm clientId={client.id} action={saveClientBranding}
            initial={{displayName: branding?.display_name ?? client.name, accent: branding?.accent_colour ?? defaultAccent, logo}}/>
        : <p className="hint">{branding ? `Shown to this client as ${branding.display_name}, in ${branding.accent_colour}.` : 'No branding set yet. An owner or admin can set it.'}</p>}
    </section>

    <section>
      <div className="section-head"><h2>Latest calls</h2></div>
      <div className="panel">{calls.length === 0
        ? <div className="empty"><strong>No calls yet</strong><p>Calls taken by this client's agents appear here after an import.</p></div>
        : <div className="table-scroll"><table>
            <thead><tr><th>Started</th><th>Agent</th><th>Status</th><th className="num">Length</th><th>Ended because</th></tr></thead>
            <tbody>{calls.map(call => <tr key={call.id}>
              <td><Link className="row-link" href={`/calls/${call.id}`}>{formatTime(call.started_at)}</Link></td><td className="primary-cell">{call.agent_name}</td>
              <td><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></td>
              <td className="num">{formatDuration(call.duration_ms)}</td>
              <td className="muted">{capitalise(plainWords(call.disconnection_reason))}</td>
            </tr>)}</tbody>
          </table></div>}
      </div>
    </section>

    {isStaff && <section className="panel panel-body" aria-labelledby="manage">
      <div className="section-head"><h2 id="manage">Manage client</h2></div>
      <form action={renameClient} className="add-row">
        <input type="hidden" name="client_id" value={client.id}/>
        <label>Client name<input name="name" defaultValue={client.name} required maxLength={maximumClientName} autoComplete="off"/></label>
        <button className="quiet">Save name</button>
      </form>
      <form action={deleteClient} className="danger-row">
        <input type="hidden" name="client_id" value={client.id}/>
        <p className="hint">Deleting the client keeps its agents and calls. The agents are no longer linked to a client.</p>
        <ConfirmButton className="danger" message={`Delete ${client.name}? Its agents and calls are kept.`}>Delete client</ConfirmButton>
      </form>
    </section>}
  </div>
}
