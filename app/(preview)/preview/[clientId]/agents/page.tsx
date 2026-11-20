import { DataTable } from '../../../../components/DataTable'
import { loadPreview } from '../../../../../lib/preview'

export default async function PreviewAgents({params}: {params: Promise<{clientId: string}>}) {
  const {agents} = await loadPreview((await params).clientId)
  return <div className="stack">
    <header className="page-head"><div><h1>Agents</h1><p>The voice agents answering your calls.</p></div></header>
    <div className="panel">{agents.length === 0
      ? <div className="empty"><strong>No agents yet</strong></div>
      : <DataTable label="Agents" searchHint="Search agents" columns={[{label: 'Name'}, {label: 'Status'}]}
          rows={agents.map(agent => ({key: agent.id, cells: [
            {value: agent.name, className: 'primary-cell', content: agent.name},
            {value: agent.is_suspended ? 'Paused' : 'Active', content: <span className={`pill ${agent.is_suspended ? 'warn' : 'ok'}`}>{agent.is_suspended ? 'Paused' : 'Active'}</span>}]}))}/>}
    </div>
  </div>
}
