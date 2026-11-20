import Link from 'next/link'
import { notFound } from 'next/navigation'
import { member } from '../../../lib/auth'
import { latestCalls } from '../../../lib/calls'
import { formatDuration, formatTime, plainWords } from '../../../lib/format'
import { sections } from '../../../lib/sections'
import { callTone, capitalise } from '../../../lib/status'

export default async function Section({params}: {params: Promise<{section: string}>}) {
  const {section} = await params
  const entry = sections.find(([key]) => key === section)
  if (!entry) notFound()
  const {db, membership} = await member()
  const workspace = membership.workspace_id
  if (section === 'dashboard') {
    const totals = await Promise.all(['agents','calls','clients'].map(async table => {
      let counting = db.from(table).select('*',{count:'exact',head:true}).eq('workspace_id', workspace)
      if (table === 'agents') counting = counting.eq('is_transfer_agent', false) // transfer agents are hidden from the agent list
      const {count,error} = await counting
      if (error) throw new Error('Dashboard could not load.')
      return count ?? 0
    }))
    const recent = await latestCalls(db, workspace, 5)
    const stats = [['Agents', '/agents'], ['Calls', '/calls'], ['Clients', '/clients']] as const
    return <div className="stack">
      <header className="page-head"><div><h1>Dashboard</h1><p>Your voice agents and the calls they have handled.</p></div></header>
      <section className="panel stats" aria-label="Totals">
        {stats.map(([label, href], i) => <Link key={label} href={href} className="stat"><span>{label}</span><strong>{totals[i].toLocaleString('en-GB')}</strong></Link>)}
      </section>
      <section>
        <div className="section-head"><h2>Latest calls</h2>{recent.length > 0 && <Link href="/calls">All calls</Link>}</div>
        <div className="panel">{recent.length === 0
          ? <div className="empty"><strong>No calls yet</strong><p>Calls appear here after an owner imports them from Retell on My Agents.</p><Link className="button" href="/agents">Go to My Agents</Link></div>
          : <div className="table-scroll"><table>
              <thead><tr><th>Started</th><th>Agent</th><th>Status</th><th className="num">Length</th></tr></thead>
              <tbody>{recent.map(call => <tr key={call.id}>
                <td>{formatTime(call.started_at)}</td><td className="primary-cell">{call.agent_name}</td>
                <td><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></td>
                <td className="num">{formatDuration(call.duration_ms)}</td>
              </tr>)}</tbody>
            </table></div>}
        </div>
      </section>
    </div>
  }
  const lists = {
    clients: ['clients','name','No clients yet','Clients are the businesses your agents work for. Adding and editing clients comes next.'],
    settings: ['branding','display_name','No branding set','Branding for each client comes with client logins.']
  } as const
  const list = lists[section as keyof typeof lists]
  if (!list) notFound()
  const [table,column,emptyTitle,emptyText] = list
  const {data,error} = await db.from(table).select('*').eq('workspace_id',workspace).order(column,{ascending:true}).limit(100)
  if (error) throw new Error('Workspace data could not load.')
  return <div className="stack">
    <header className="page-head"><div><h1>{entry[1]}</h1></div></header>
    <div className="panel">{data.length === 0
      ? <div className="empty"><strong>{emptyTitle}</strong><p>{emptyText}</p></div>
      : <ul className="rows">{data.map(row => <li key={row.id ?? workspace}>{String(row[column])}</li>)}</ul>}
    </div>
  </div>
}
