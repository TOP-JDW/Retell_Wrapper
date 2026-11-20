import Link from 'next/link'
import { notFound } from 'next/navigation'
import { parseId } from '../../../../../../lib/clients'
import { formatDuration, formatTime, plainWords } from '../../../../../../lib/format'
import { loadPreview } from '../../../../../../lib/preview'
import { callTone, capitalise } from '../../../../../../lib/status'
import { CallInsight } from '../../../../../components/CallInsight'

// One call as the client would see it. Opens only when the client's recordings setting is on, and only
// for a call taken by one of this client's own agents.
export default async function PreviewCall({params}: {params: Promise<{clientId: string; callId: string}>}) {
  const raw = await params
  const {db, membership, client, agents} = await loadPreview(raw.clientId)
  if (!client.recordings_for_client) notFound()
  const id = parseId(raw.callId)
  if (!id) notFound()
  const agentIds = agents.map(agent => agent.id)
  const {data: call, error} = agentIds.length === 0 ? {data: null, error: null} : await db.from('calls')
    .select('id,agent_id,retell_call_id,started_at,call_status,call_type,direction,disconnection_reason,duration_ms')
    .eq('id', id).eq('workspace_id', membership.workspace_id).in('agent_id', agentIds).maybeSingle()
  if (error) throw new Error('Call could not load.')
  if (!call) notFound()
  const agent = agents.find(a => a.id === call.agent_id)
  const finished = call.call_status === 'ended' || call.call_status === 'error' || call.call_status === 'not_connected'
  // In the preview, staff stand in for the client. Their own role still decides whether Retell is read.
  const isStaff = membership.role === 'owner' || membership.role === 'admin'

  return <div className="stack">
    <header className="page-head"><div>
      <p className="crumb"><Link href={`/preview/${client.id}/calls`}>Calls</Link></p>
      <h1>Call with {agent?.name ?? 'your agent'}</h1>
      <p>{formatTime(call.started_at)}, UK time.</p>
    </div></header>
    <section className="panel facts" aria-label="Call details">
      <div><span>Agent</span><b>{agent?.name ?? 'Unknown'}</b></div>
      <div><span>Status</span><b><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></b></div>
      <div><span>Length</span><b>{formatDuration(call.duration_ms)}</b></div>
      <div><span>Type</span><b>{call.call_type === 'web_call' ? 'Web' : call.direction ? capitalise(plainWords(call.direction)) : 'Unknown'}</b></div>
      <div><span>Ended because</span><b>{capitalise(plainWords(call.disconnection_reason))}</b></div>
    </section>
    {isStaff
      ? <CallInsight callId={call.id} retellCallId={call.retell_call_id} finished={finished} agentName={agent?.name ?? 'Agent'}/>
      : <p className="hint">The client would see the recording and transcript here. Your role is Viewer, so they are not shown to you.</p>}
  </div>
}
