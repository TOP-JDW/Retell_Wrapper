import { latestCalls } from '../../../../../lib/calls'
import { loadPreview } from '../../../../../lib/preview'
import { CallTable } from '../../../../components/CallTable'

export default async function PreviewCalls({params}: {params: Promise<{clientId: string}>}) {
  const {db, membership, agents} = await loadPreview((await params).clientId)
  const calls = await latestCalls(db, membership.workspace_id, 100, agents.map(agent => agent.id))
  return <div className="stack">
    <header className="page-head"><div><h1>Calls</h1><p>Your 100 most recent calls, newest first. Times are UK time.</p></div></header>
    <div className="panel">{calls.length === 0
      ? <div className="empty"><strong>No calls yet</strong></div>
      : <CallTable calls={calls} link={false} columns={['started', 'agent', 'status', 'type', 'length', 'ended']}/>}
    </div>
    <p className="hint">In the preview, calls do not open. Whether clients can play recordings is still to be decided.</p>
  </div>
}
