import { member } from '../../../lib/auth'
import { formatDuration, formatTime, plainWords } from '../../../lib/format'

export default async function Calls() {
  const {db, membership} = await member()
  const {data, error} = await db.from('calls')
    .select('id,agent_id,started_at,call_status,call_type,direction,disconnection_reason,duration_ms')
    .eq('workspace_id', membership.workspace_id).order('started_at', {ascending: false}).limit(100)
  if (error) throw new Error('Calls could not load.')

  const agentIds = [...new Set(data.map(call => call.agent_id))]
  const names = new Map<string, string>()
  if (agentIds.length > 0) {
    const {data: agents, error: agentError} = await db.from('agents').select('id,name').in('id', agentIds)
    if (agentError) throw new Error('Calls could not load.')
    for (const agent of agents) names.set(agent.id, agent.name)
  }

  return <>
    <h1>Call History</h1>
    {data.length === 0 ? <p>No calls have been imported.</p> : <>
      <p>The 100 most recent calls. Times are UK time.</p>
      <table>
        <thead><tr><th>Started</th><th>Agent</th><th>Status</th><th>Type</th><th>Length</th><th>Ended because</th></tr></thead>
        <tbody>{data.map(call => <tr key={call.id}>
          <td>{formatTime(call.started_at)}</td>
          <td>{names.get(call.agent_id) ?? 'Unknown'}</td>
          <td>{plainWords(call.call_status)}</td>
          <td>{call.call_type === 'web_call' ? 'Web' : call.direction ? plainWords(call.direction) : 'Unknown'}</td>
          <td>{formatDuration(call.duration_ms)}</td>
          <td>{plainWords(call.disconnection_reason)}</td>
        </tr>)}</tbody>
      </table></>}
  </>
}
