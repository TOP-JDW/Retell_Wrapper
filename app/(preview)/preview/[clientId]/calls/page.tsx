import { latestCalls } from '../../../../../lib/calls'
import { formatDuration, formatTime, plainWords } from '../../../../../lib/format'
import { loadPreview } from '../../../../../lib/preview'
import { callTone, capitalise } from '../../../../../lib/status'

export default async function PreviewCalls({params}: {params: Promise<{clientId: string}>}) {
  const {db, membership, agents} = await loadPreview((await params).clientId)
  const calls = await latestCalls(db, membership.workspace_id, 100, agents.map(agent => agent.id))
  return <div className="stack">
    <header className="page-head"><div><h1>Calls</h1><p>Your 100 most recent calls, newest first. Times are UK time.</p></div></header>
    <div className="panel">{calls.length === 0
      ? <div className="empty"><strong>No calls yet</strong></div>
      : <div className="table-scroll"><table>
          <thead><tr><th>Started</th><th>Agent</th><th>Status</th><th>Type</th><th className="num">Length</th><th>Ended because</th></tr></thead>
          <tbody>{calls.map(call => <tr key={call.id}>
            <td>{formatTime(call.started_at)}</td><td className="primary-cell">{call.agent_name}</td>
            <td><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></td>
            <td>{call.call_type === 'web_call' ? 'Web' : call.direction ? capitalise(plainWords(call.direction)) : 'Unknown'}</td>
            <td className="num">{formatDuration(call.duration_ms)}</td>
            <td className="muted wrap">{capitalise(plainWords(call.disconnection_reason))}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    <p className="hint">In the preview, calls do not open. Whether clients can play recordings is still to be decided.</p>
  </div>
}
