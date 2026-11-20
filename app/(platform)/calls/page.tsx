import { member } from '../../../lib/auth'
import { latestCalls } from '../../../lib/calls'
import { formatDuration, formatTime, plainWords } from '../../../lib/format'
import { callTone, capitalise } from '../../../lib/status'

export default async function Calls() {
  const {db, membership} = await member()
  const calls = await latestCalls(db, membership.workspace_id, 100)
  return <div className="stack">
    <header className="page-head"><div><h1>Call History</h1><p>The 100 most recent calls, newest first. Times are UK time.</p></div></header>
    <div className="panel">{calls.length === 0
      ? <div className="empty"><strong>No calls yet</strong><p>Calls appear here after an owner imports them from Retell on My Agents.</p></div>
      : <div className="table-scroll"><table>
          <thead><tr><th>Started</th><th>Agent</th><th>Client</th><th>Status</th><th>Type</th><th className="num">Length</th><th>Ended because</th></tr></thead>
          <tbody>{calls.map(call => <tr key={call.id}>
            <td>{formatTime(call.started_at)}</td>
            <td className="primary-cell">{call.agent_name}</td>
            <td className={call.client_name ? '' : 'unlinked'}>{call.client_name ?? 'No client'}</td>
            <td><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></td>
            <td>{call.call_type === 'web_call' ? 'Web' : call.direction ? capitalise(plainWords(call.direction)) : 'Unknown'}</td>
            <td className="num">{formatDuration(call.duration_ms)}</td>
            <td className="muted">{capitalise(plainWords(call.disconnection_reason))}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
  </div>
}
