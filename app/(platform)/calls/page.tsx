import Link from 'next/link'
import { member } from '../../../lib/auth'
import { findCalls } from '../../../lib/calls'
import { filterQuery, isFiltered, pageSize, parseCallFilters } from '../../../lib/filters'
import { formatDuration, formatTime, plainWords } from '../../../lib/format'
import { addDays, londonMidnight } from '../../../lib/period'
import { callTone, capitalise } from '../../../lib/status'

export default async function Calls({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const filters = parseCallFilters(await searchParams)
  const {db, membership} = await member()
  const workspace = membership.workspace_id
  const [clientList, agentList] = await Promise.all([
    db.from('clients').select('id,name').eq('workspace_id', workspace).order('name', {ascending: true}).limit(500),
    db.from('agents').select('id,name,client_id,is_transfer_agent').eq('workspace_id', workspace).order('name', {ascending: true}).limit(500)
  ])
  if (clientList.error || agentList.error) throw new Error('Calls could not load.')
  const clients = clientList.data
  const agents = agentList.data

  // Narrow to agents: the chosen agent, the chosen client's agents, or both.
  let agentIds: string[] | undefined
  if (filters.client) agentIds = agents.filter(agent => filters.client === 'none' ? !agent.client_id : agent.client_id === filters.client).map(agent => agent.id)
  if (filters.agent) agentIds = (agentIds ?? [filters.agent]).filter(id => id === filters.agent)
  const {rows, count} = await findCalls(db, workspace, {
    limit: pageSize, offset: (filters.page - 1) * pageSize, agentIds, count: true,
    fromTs: filters.from ? londonMidnight(filters.from).toISOString() : undefined,
    toTs: filters.to ? londonMidnight(addDays(filters.to, 1)).toISOString() : undefined
  })
  const first = count === 0 ? 0 : (filters.page - 1) * pageSize + 1
  const last = Math.min(count, filters.page * pageSize)
  const pages = Math.max(1, Math.ceil(count / pageSize))

  return <div className="stack">
    <header className="page-head"><div><h1>Call History</h1><p>Newest first. Times and dates are UK time.</p></div></header>

    <form className="panel filters" action="/calls" aria-label="Filter calls">
      <label>Client<select name="client" defaultValue={filters.client ?? ''}>
        <option value="">All clients</option><option value="none">No client</option>
        {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select></label>
      <label>Agent<select name="agent" defaultValue={filters.agent ?? ''}>
        <option value="">All agents</option>
        {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.is_transfer_agent ? ' (transfer)' : ''}</option>)}
      </select></label>
      <label>From<input type="date" name="from" defaultValue={filters.from ?? ''}/></label>
      <label>To<input type="date" name="to" defaultValue={filters.to ?? ''}/></label>
      <div className="filter-actions"><button>Apply</button>{isFiltered(filters) && <Link href="/calls">Clear</Link>}</div>
    </form>

    <p className="result-count" role="status">{count === 0 ? 'No calls match.' : `Showing ${first.toLocaleString('en-GB')} to ${last.toLocaleString('en-GB')} of ${count.toLocaleString('en-GB')} calls`}</p>

    <div className="panel">{rows.length === 0
      ? <div className="empty"><strong>{isFiltered(filters) ? 'No calls match these filters' : 'No calls yet'}</strong>
          <p>{isFiltered(filters) ? 'Try a wider date range or a different client or agent.' : 'Calls appear here after an owner imports them from Retell on My Agents.'}</p>
          {isFiltered(filters) && <Link className="button" href="/calls">Clear filters</Link>}</div>
      : <div className="table-scroll"><table>
          <thead><tr><th>Started</th><th>Agent</th><th>Client</th><th>Status</th><th>Type</th><th className="num">Length</th><th>Ended because</th></tr></thead>
          <tbody>{rows.map(call => <tr key={call.id}>
            <td><Link className="row-link" href={`/calls/${call.id}`}>{formatTime(call.started_at)}</Link></td>
            <td className="primary-cell">{call.agent_name}</td>
            <td className={call.client_name ? '' : 'unlinked'}>{call.client_name ?? 'No client'}</td>
            <td><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></td>
            <td>{call.call_type === 'web_call' ? 'Web' : call.direction ? capitalise(plainWords(call.direction)) : 'Unknown'}</td>
            <td className="num">{formatDuration(call.duration_ms)}</td>
            <td className="muted">{capitalise(plainWords(call.disconnection_reason))}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>

    {pages > 1 && <nav className="pager" aria-label="Pages">
      {filters.page > 1 ? <Link className="button quiet-link" href={`/calls${filterQuery(filters, {page: filters.page - 1})}`}>Newer calls</Link> : <span/>}
      <span>Page {filters.page} of {pages}</span>
      {filters.page < pages ? <Link className="button quiet-link" href={`/calls${filterQuery(filters, {page: filters.page + 1})}`}>Older calls</Link> : <span/>}
    </nav>}
  </div>
}
