import Link from 'next/link'
import { CallTable } from '../../../components/CallTable'
import { notFound } from 'next/navigation'
import { member } from '../../../../lib/auth'
import { findCalls } from '../../../../lib/calls'
import { chartColours } from '../../../../lib/chart'
import { parseId } from '../../../../lib/clients'
import { formatDuration, formatPercent, formatTalkTime, formatTime } from '../../../../lib/format'
import { fillDays, parsePeriod, periodRange, periods, shortDate, summarise, type DayStat } from '../../../../lib/period'
import { CallsChart } from '../../../components/CallsChart'

export default async function Agent({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{days?: string}>}) {
  const id = parseId((await params).id)
  if (!id) notFound()
  const days = parsePeriod((await searchParams).days)
  const {db, membership} = await member()
  const {data: agent, error} = await db.from('agents').select('id,name,client_id,is_suspended,is_transfer_agent,retell_modified_at')
    .eq('id', id).eq('workspace_id', membership.workspace_id).maybeSingle()
  if (error) throw new Error('Agent could not load.')
  if (!agent) notFound()
  const range = periodRange(days)
  const [daily, client, recent] = await Promise.all([
    db.rpc('call_agent_daily_stats', {target_agent: id, from_ts: range.fromTs, to_ts: range.toTs}),
    agent.client_id ? db.from('clients').select('id,name').eq('id', agent.client_id).maybeSingle() : Promise.resolve({data: null, error: null}),
    findCalls(db, membership.workspace_id, {limit: 25, agentIds: [id]})
  ])
  if (daily.error || client.error) throw new Error('Agent could not load.')
  const series = fillDays((daily.data ?? []) as DayStat[], range.dates)
  const totals = summarise(series)
  const busiest = series.reduce((best, d) => (d.total > best.total ? d : best), series[0])

  return <div className="stack">
    <header className="page-head">
      <div>
        <p className="crumb"><Link href="/agents">My Agents</Link></p>
        <h1>{agent.name}</h1>
        <p className="agent-meta">
          <span className={`pill ${agent.is_suspended ? 'warn' : 'ok'}`}>{agent.is_suspended ? 'Suspended' : 'Active'}</span>
          {agent.is_transfer_agent && <span className="pill">Transfer agent</span>}
          {client.data ? <Link href={`/clients/${client.data.id}`}>{client.data.name}</Link> : <span>No client</span>}
          <span>Last changed in Retell {formatTime(agent.retell_modified_at)}</span>
        </p>
      </div>
      <nav className="segmented" aria-label="Time period">{periods.map(p =>
        <Link key={p} href={`/agents/${id}?days=${p}`} aria-current={p === days ? 'true' : undefined}>{p} days</Link>)}</nav>
    </header>

    <section className="panel stats four" aria-label={`Figures for the last ${days} days`}>
      <div className="stat"><span>Calls</span><strong>{totals.total.toLocaleString('en-GB')}</strong></div>
      <div className="stat"><span>Connected</span><strong>{formatPercent(totals.rate)}</strong>
        {totals.total > 0 && <small>{totals.connected.toLocaleString('en-GB')} of {totals.total.toLocaleString('en-GB')} calls</small>}</div>
      <div className="stat"><span>Average length</span><strong>{totals.averageMs === null ? 'None yet' : formatDuration(totals.averageMs)}</strong><small>Connected calls</small></div>
      <div className="stat"><span>Talk time</span><strong>{formatTalkTime(totals.talkMs)}</strong><small>Connected calls</small></div>
    </section>

    {totals.total > 0 && <section className="panel panel-body">
      <div className="chart-head"><h2>Calls per day</h2>
        <ul className="legend" aria-label="Legend">
          <li><i style={{background: chartColours.connected}}/>Connected</li>
          <li><i style={{background: chartColours.other}}/>Not connected</li>
        </ul></div>
      <CallsChart days={series.map(d => ({day: d.day, label: shortDate(d.day), connected: d.connected, other: d.total - d.connected}))}
        summary={`${agent.name}: ${totals.total} calls in the last ${days} days, ${totals.connected} connected. Busiest day ${shortDate(busiest.day)} with ${busiest.total} calls.`}/>
    </section>}

    <section>
      <div className="section-head"><h2>Latest calls</h2>{recent.rows.length > 0 && <Link href={`/calls?agent=${id}`}>All calls for this agent</Link>}</div>
      <div className="panel">{recent.rows.length === 0
        ? <div className="empty"><strong>No calls yet</strong><p>This agent's calls appear here after an import.</p></div>
        : <CallTable label={`Latest calls for ${agent.name}`} calls={recent.rows} columns={['started', 'status', 'type', 'length', 'ended']}/>}
      </div>
    </section>
  </div>
}
