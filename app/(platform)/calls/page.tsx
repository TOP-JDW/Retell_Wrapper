import Link from 'next/link'
import { member } from '../../../lib/auth'
import { findCalls } from '../../../lib/calls'
import { callSorts, filterQuery, isFiltered, pageSize, parseCallFilters, scopeCalls, type CallSort } from '../../../lib/filters'
import { addDays, londonMidnight } from '../../../lib/period'
import { CallTable } from '../../components/CallTable'
import { SubmitButton } from '../../components/SubmitButton'

const sortSummary: Record<CallSort, Record<'asc' | 'desc', string>> = {
  started: {desc: 'Newest first.', asc: 'Oldest first.'}, length: {desc: 'Longest first.', asc: 'Shortest first.'},
  status: {asc: 'By status, A to Z.', desc: 'By status, Z to A.'}, type: {asc: 'By type, A to Z.', desc: 'By type, Z to A.'},
  ended: {asc: 'By end reason, A to Z.', desc: 'By end reason, Z to A.'}
}

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

  const {agentIds, hiddenIds} = scopeCalls(agents, filters)

  const range = {
    fromTs: filters.from ? londonMidnight(filters.from).toISOString() : undefined,
    toTs: filters.to ? londonMidnight(addDays(filters.to, 1)).toISOString() : undefined
  }
  const [{rows, count}, hidden] = await Promise.all([
    findCalls(db, workspace, {limit: pageSize, offset: (filters.page - 1) * pageSize, agentIds, count: true, order: {column: callSorts[filters.sort], ascending: filters.dir === 'asc'}, ...range}),
    hiddenIds.length > 0 ? findCalls(db, workspace, {limit: 1, agentIds: hiddenIds, count: true, ...range}).then(r => r.count) : Promise.resolve(0)
  ])
  const first = count === 0 ? 0 : (filters.page - 1) * pageSize + 1
  const last = Math.min(count, filters.page * pageSize)
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const newestFirst = filters.sort === 'started' && filters.dir === 'desc'

  return <div className="stack">
    <header className="page-head"><div><h1>Call History</h1><p>{sortSummary[filters.sort][filters.dir]} Click a column heading to sort. Times and dates are UK time.</p></div>
      {(membership.role === 'owner' || membership.role === 'admin') && count > 0 &&
        <a className="button quiet-link" href={`/calls/export${filterQuery({...filters, page: 1})}`} download>Export to Excel</a>}
    </header>

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
      <label className="check filter-check"><input type="checkbox" name="transfers" value="1" defaultChecked={filters.transfers}/>Show transfer calls</label>
      {(filters.sort !== 'started' || filters.dir !== 'desc') && <><input type="hidden" name="sort" value={filters.sort}/><input type="hidden" name="dir" value={filters.dir}/></>}
      <div className="filter-actions"><SubmitButton pending="Applying…">Apply</SubmitButton>{isFiltered(filters) && <Link href="/calls">Clear</Link>}</div>
    </form>

    <p className="result-count" role="status">
      {count === 0 ? 'No calls match.' : `Showing ${first.toLocaleString('en-GB')} to ${last.toLocaleString('en-GB')} of ${count.toLocaleString('en-GB')} calls.`}
      {hidden > 0 && <> {hidden.toLocaleString('en-GB')} transfer {hidden === 1 ? 'call is' : 'calls are'} hidden. <Link href={`/calls${filterQuery(filters, {transfers: true, page: 1})}`}>Show them</Link></>}
    </p>

    <div className="panel">{rows.length === 0
      ? <div className="empty"><strong>{isFiltered(filters) ? 'No calls match these filters' : 'No calls yet'}</strong>
          <p>{isFiltered(filters) ? 'Try a wider date range or a different client or agent.' : 'Calls appear here after an owner imports them from Retell on My Agents.'}</p>
          {isFiltered(filters) && <Link className="button" href="/calls">Clear filters</Link>}</div>
      : <CallTable calls={rows} columns={['started', 'agent', 'client', 'status', 'type', 'length', 'ended']} searchHint="Search this page"
          server={Object.fromEntries((Object.keys(callSorts) as CallSort[]).map(key => [key, {
            asc: `/calls${filterQuery(filters, {sort: key, dir: 'asc', page: 1})}`, desc: `/calls${filterQuery(filters, {sort: key, dir: 'desc', page: 1})}`,
            active: filters.sort === key ? filters.dir : undefined}]))}/>}
    </div>

    {pages > 1 && <nav className="pager" aria-label="Pages">
      {filters.page > 1 ? <Link className="button quiet-link" href={`/calls${filterQuery(filters, {page: filters.page - 1})}`}>{newestFirst ? 'Newer calls' : 'Previous page'}</Link> : <span/>}
      <span>Page {filters.page} of {pages}</span>
      {filters.page < pages ? <Link className="button quiet-link" href={`/calls${filterQuery(filters, {page: filters.page + 1})}`}>{newestFirst ? 'Older calls' : 'Next page'}</Link> : <span/>}
    </nav>}
  </div>
}
