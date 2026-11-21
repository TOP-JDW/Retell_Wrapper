import Link from 'next/link'
import { notFound } from 'next/navigation'
import { member } from '../../../../lib/auth'
import { latestCalls } from '../../../../lib/calls'
import { maximumClientName, parseId } from '../../../../lib/clients'
import { CallTable } from '../../../components/CallTable'
import { DataTable } from '../../../components/DataTable'
import { Flash } from '../../../components/Flash'
import { SubmitButton } from '../../../components/SubmitButton'
import { ClientBrandingForm } from '../../../components/ClientBrandingForm'
import { defaultAccent, logoUrl } from '../../../../lib/branding'
import { deleteClient, renameClient, saveClientBranding, setClientRecordings } from '../actions'
import { clientNotices, clientProblems } from '../messages'

export default async function Client({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{notice?: string; error?: string}>}) {
  const id = parseId((await params).id)
  if (!id) notFound()
  const {notice, error} = await searchParams
  const {db, membership} = await member()
  const isStaff = membership.role === 'owner' || membership.role === 'admin'
  const {data: client, error: loadError} = await db.from('clients').select('id,name,recordings_for_client')
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
  // Setup steps for a new client. The recordings step counts as done once anyone has saved that setting.
  const {count: recordingChoices} = isStaff ? await db.from('activity_log').select('id', {count: 'exact', head: true})
    .eq('workspace_id', membership.workspace_id).eq('target_id', id).in('action', ['client.recordings_on', 'client.recordings_off']) : {count: 0}
  const steps = [
    {done: visible.length > 0, label: 'Link at least one agent', href: '/agents', action: 'Go to My Agents'},
    {done: Boolean(branding), label: 'Add a display name and colour', href: '#branding', action: 'Go to Branding'},
    {done: Boolean(logo), label: 'Upload a logo', href: '#branding', action: 'Go to Branding'},
    {done: client.recordings_for_client || (recordingChoices ?? 0) > 0, label: 'Choose whether they can play recordings', href: '#recordings', action: 'Go to Recordings'}
  ]
  const doneCount = steps.filter(step => step.done).length

  return <div className="stack">
    <header className="page-head"><div>
      <p className="crumb"><Link href="/clients">Client Management</Link></p>
      <div className="client-head">
        {logo && <div className="logo-tile"><img src={logo} alt={`${client.name} logo`}/></div>}
        <div><h1>{client.name}</h1><p>{visible.length === 1 ? '1 agent' : `${visible.length} agents`} linked to this client.</p></div>
      </div>
    </div>
    <Link className="button" href={`/preview/${client.id}`}>Preview as client</Link></header>
    <Flash success={notice && clientNotices[notice]} problem={error && clientProblems[error]}/>

    {isStaff && doneCount < steps.length && <section className="panel panel-body checklist" aria-labelledby="setup-title">
      <div className="checklist-head"><h2 id="setup-title">Set up {client.name}</h2><span className="muted">{doneCount} of {steps.length} done</span></div>
      <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}><i style={{width: `${(doneCount / steps.length) * 100}%`}}/></div>
      <ol>{steps.map(step => <li key={step.label} className={step.done ? 'done' : ''}>
        <span className="tick" aria-hidden="true">{step.done ? '✓' : ''}</span>
        <span>{step.label}<span className="visually-hidden">{step.done ? ' (done)' : ' (to do)'}</span></span>
        {!step.done && <Link href={step.href}>{step.action}</Link>}
      </li>)}</ol>
      <p className="hint">When all steps are done, check the result with Preview as client. This list then disappears.</p>
    </section>}

    <section>
      <div className="section-head"><h2>Agents</h2>{isStaff && <Link href="/agents">Link agents</Link>}</div>
      <div className="panel">{visible.length === 0
        ? <div className="empty"><strong>No agents linked</strong><p>{isStaff ? 'Choose this client for an agent on My Agents.' : 'An owner or admin can link agents to this client.'}</p></div>
        : <DataTable label="Agents for this client" searchHint="Search agents" columns={[{label: 'Name'}, {label: 'Status'}]}
            rows={visible.map(agent => ({key: agent.id, cells: [
              {value: agent.name, className: 'primary-cell', content: <Link className="row-link" href={`/agents/${agent.id}`}>{agent.name}</Link>},
              {value: agent.is_suspended ? 'Suspended' : 'Active', content: <span className={`pill ${agent.is_suspended ? 'warn' : 'ok'}`}>{agent.is_suspended ? 'Suspended' : 'Active'}</span>}
            ]}))}/>}
      </div>
    </section>

    <section id="branding" className="panel panel-body" aria-labelledby="branding-title">
      <div className="section-head"><h2 id="branding-title">Branding</h2></div>
      {isStaff
        ? <ClientBrandingForm clientId={client.id} action={saveClientBranding}
            initial={{displayName: branding?.display_name ?? client.name, accent: branding?.accent_colour ?? defaultAccent, logo}}/>
        : <p className="hint">{branding ? `Shown to this client as ${branding.display_name}, in ${branding.accent_colour}.` : 'No branding set yet. An owner or admin can set it.'}</p>}
    </section>

    <section id="recordings" className="panel panel-body" aria-labelledby="access-title">
      <div className="section-head"><h2 id="access-title">Recordings</h2></div>
      {isStaff
        ? <form action={setClientRecordings} className="stack-tight">
            <input type="hidden" name="client_id" value={client.id}/>
            <label className="check"><input type="checkbox" name="recordings" defaultChecked={client.recordings_for_client}/>
              Let {client.name} play call recordings and read transcripts</label>
            <p className="hint">Off by default. It applies when client logins arrive, and you can try it now with Preview as client. Recordings are always played through this portal, never as a Retell link.</p>
            <div><SubmitButton className="quiet" pending="Saving…">Save</SubmitButton></div>
          </form>
        : <p className="hint">{client.recordings_for_client ? `${client.name} can play call recordings and read transcripts.` : `${client.name} cannot play call recordings or read transcripts. An owner or admin can change this.`}</p>}
    </section>

    <section>
      <div className="section-head"><h2>Latest calls</h2></div>
      <div className="panel">{calls.length === 0
        ? <div className="empty"><strong>No calls yet</strong><p>Calls taken by this client's agents appear here after an import.</p></div>
        : <CallTable label="Latest calls for this client" calls={calls} columns={['started', 'agent', 'status', 'length', 'ended']}/>}
      </div>
    </section>

    {isStaff && <section className="panel panel-body" aria-labelledby="manage">
      <div className="section-head"><h2 id="manage">Manage client</h2></div>
      <form action={renameClient} className="add-row">
        <input type="hidden" name="client_id" value={client.id}/>
        <label>Client name<input name="name" defaultValue={client.name} required maxLength={maximumClientName} autoComplete="off"/></label>
        <SubmitButton className="quiet" pending="Saving…">Save name</SubmitButton>
      </form>
      <form action={deleteClient} className="danger-row">
        <input type="hidden" name="client_id" value={client.id}/>
        <p className="hint">Deleting the client keeps its agents and calls. The agents are no longer linked to a client.</p>
        <SubmitButton className="danger" pending="Deleting…" confirm={`Delete ${client.name}? Its agents and calls are kept.`}>Delete client</SubmitButton>
      </form>
    </section>}
  </div>
}
