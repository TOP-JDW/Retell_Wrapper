import Link from 'next/link'
import { notFound } from 'next/navigation'
import { member } from '../../../../lib/auth'
import { agentNames } from '../../../../lib/calls'
import { parseId } from '../../../../lib/clients'
import { formatDuration, formatTime, plainWords } from '../../../../lib/format'
import { callTone, capitalise } from '../../../../lib/status'
import { CallInsight } from '../../../components/CallInsight'

export default async function Call({params}: {params: Promise<{id: string}>}) {
  const id = parseId((await params).id)
  if (!id) notFound()
  const {db, membership} = await member()
  const isStaff = membership.role === 'owner' || membership.role === 'admin'
  const {data: call, error} = await db.from('calls')
    .select('id,agent_id,retell_call_id,started_at,ended_at,call_status,call_type,direction,disconnection_reason,duration_ms')
    .eq('id', id).eq('workspace_id', membership.workspace_id).maybeSingle()
  if (error) throw new Error('Call could not load.')
  if (!call) notFound()
  const {agents, clients} = await agentNames(db, [call.agent_id])
  const agent = agents.get(call.agent_id)
  const client = agent?.client_id ? clients.get(agent.client_id) ?? null : null

  const finished = call.call_status === 'ended' || call.call_status === 'error' || call.call_status === 'not_connected'

  return <div className="stack">
    <header className="page-head"><div>
      <p className="crumb"><Link href="/calls">Call History</Link></p>
      <h1>Call with {agent?.name ?? 'an unknown agent'}</h1>
      <p>{formatTime(call.started_at)}, UK time.</p>
    </div></header>

    <section className="panel facts" aria-label="Call details">
      <div><span>Agent</span><b>{agent ? <Link className="row-link" href={`/agents/${call.agent_id}`}>{agent.name}</Link> : 'Unknown'}</b></div>
      <div><span>Status</span><b><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></b></div>
      <div><span>Length</span><b>{formatDuration(call.duration_ms)}</b></div>
      <div><span>Type</span><b>{call.call_type === 'web_call' ? 'Web' : call.direction ? capitalise(plainWords(call.direction)) : 'Unknown'}</b></div>
      <div><span>Client</span><b>{client ?? 'No client'}</b></div>
      <div><span>Ended because</span><b>{capitalise(plainWords(call.disconnection_reason))}</b></div>
    </section>

    {isStaff
      ? <CallInsight callId={call.id} retellCallId={call.retell_call_id} finished={finished} agentName={agent?.name ?? 'Agent'}/>
      : <p className="hint">Only owners and admins can listen to recordings and read transcripts.</p>}
  </div>
}
