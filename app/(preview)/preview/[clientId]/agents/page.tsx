import { loadPreview } from '../../../../../lib/preview'

export default async function PreviewAgents({params}: {params: Promise<{clientId: string}>}) {
  const {agents} = await loadPreview((await params).clientId)
  return <div className="stack">
    <header className="page-head"><div><h1>Agents</h1><p>The voice agents answering your calls.</p></div></header>
    <div className="panel">{agents.length === 0
      ? <div className="empty"><strong>No agents yet</strong></div>
      : <table>
          <thead><tr><th>Name</th><th>Status</th></tr></thead>
          <tbody>{agents.map(agent => <tr key={agent.id}>
            <td className="primary-cell">{agent.name}</td>
            <td><span className={`pill ${agent.is_suspended ? 'warn' : 'ok'}`}>{agent.is_suspended ? 'Paused' : 'Active'}</span></td>
          </tr>)}</tbody>
        </table>}
    </div>
  </div>
}
