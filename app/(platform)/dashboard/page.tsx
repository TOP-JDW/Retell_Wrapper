import Link from 'next/link'
import { CallTable } from '../../components/CallTable'
import { DataTable } from '../../components/DataTable'
import { member } from '../../../lib/auth'
import { agentNames, latestCalls } from '../../../lib/calls'
import { formatDuration, formatPercent, formatTalkTime, formatTime } from '../../../lib/format'
import { fillDays, parsePeriod, periodRange, periods, previousPeriodRange, shortDate, summarise, type DayStat } from '../../../lib/period'
import { agentWarnings, compare, type Change, type HourStat } from '../../../lib/insights'
import { loadHealth } from '../../../lib/health'
import { BusyHours } from '../../components/BusyHours'
import { chartColours } from '../../../lib/chart'
import { CallsChart } from '../../components/CallsChart'

type AgentStat = { agent_id: string; total: number; connected: number; connected_ms: number; timed: number }

export default async function Dashboard({searchParams}: {searchParams: Promise<{days?: string; transfers?: string}>}) {
  const query = await searchParams
  const days = parsePeriod(query.days)
  // Transfer calls are left out unless asked for, as on Call History.
  const transfers = query.transfers === '1'
  const link = (p: number, t: boolean) => `/dashboard?days=${p}${t ? '&transfers=1' : ''}`
  const {db, membership} = await member()
  const range = periodRange(days)
  const args = {from_ts: range.fromTs, to_ts: range.toTs, ...(transfers ? {include_transfers: true} : {})}
  const before = previousPeriodRange(days)
  const [daily, byAgent, earlier, hours, allAgents, health] = await Promise.all([
    db.rpc('call_daily_stats', args), db.rpc('call_agent_stats', args),
    db.rpc('call_daily_stats', {...args, from_ts: before.fromTs, to_ts: before.toTs}), db.rpc('call_hour_stats', args),
    db.from('agents').select('id,name,is_suspended,is_transfer_agent').eq('workspace_id', membership.workspace_id).limit(1000),
    loadHealth(db, membership.workspace_id)
  ])
  if (daily.error || byAgent.error || earlier.error || hours.error || allAgents.error) throw new Error('Dashboard could not load.')
  const {measuredAt, byAgent: healthByAgent} = health
  const attention = allAgents.data.flatMap(agent => agentWarnings(healthByAgent.get(agent.id), agent).map(warning => ({agent, warning})))
  const previous = summarise((earlier.data ?? []) as DayStat[])
  const series = fillDays((daily.data ?? []) as DayStat[], range.dates)
  const totals = summarise(series)
  const topAgents = ((byAgent.data ?? []) as AgentStat[]).slice(0, 10)
  const {agents, clients} = await agentNames(db, topAgents.map(row => row.agent_id))
  const shownAgents = transfers ? undefined : allAgents.data.filter(agent => !agent.is_transfer_agent).map(agent => agent.id)
  const recent = await latestCalls(db, membership.workspace_id, 5, shownAgents)
  const busiest = series.reduce((best, d) => (d.total > best.total ? d : best), series[0])
  const span = `${days} days`
  const changes = {
    total: compare(totals.total, previous.total, 'percent', span), rate: compare(totals.rate, previous.rate, 'points', span),
    average: compare(totals.averageMs, previous.averageMs, 'percent', span), talk: compare(totals.talkMs, previous.talkMs, 'percent', span)
  }
  const chartDays = series.map(d => ({day: d.day, label: shortDate(d.day), connected: d.connected, other: d.total - d.connected}))

  return <div className="stack">
    <header className="page-head">
      <div><h1>Dashboard</h1><p>Calls in the last {days} days. Days follow UK time.{' '}
        {transfers ? <>Transfer calls are counted. <Link href={link(days, false)}>Leave them out</Link></> : <>Transfer calls are left out. <Link href={link(days, true)}>Count them</Link></>}</p></div>
      <nav className="segmented" aria-label="Time period">{periods.map(p =>
        <Link key={p} href={link(p, transfers)} aria-current={p === days ? 'true' : undefined}>{p} days</Link>)}</nav>
    </header>

    <section className="panel stats four" aria-label={`Figures for the last ${days} days`}>
      <div className="stat"><span>Calls</span><strong>{totals.total.toLocaleString('en-GB')}</strong><Delta change={changes.total}/></div>
      <div className="stat"><span>Connected</span><strong>{formatPercent(totals.rate)}</strong><Delta change={changes.rate} good="up"/>
        {totals.total > 0 && <small>{totals.connected.toLocaleString('en-GB')} of {totals.total.toLocaleString('en-GB')} calls</small>}</div>
      <div className="stat"><span>Average length</span><strong>{totals.averageMs === null ? 'None yet' : formatDuration(totals.averageMs)}</strong>
        <Delta change={changes.average}/><small>Connected calls</small></div>
      <div className="stat"><span>Talk time</span><strong>{formatTalkTime(totals.talkMs)}</strong><Delta change={changes.talk}/><small>Connected calls</small></div>
    </section>

    {attention.length > 0 && <section className="panel attention" aria-labelledby="attention-title">
      <div className="attention-head"><h2 id="attention-title">Needs attention</h2>
        <span className="hint">Measured up to the newest imported call{measuredAt ? `, ${formatTime(measuredAt)}` : ''}.</span></div>
      <ul>{attention.map(({agent, warning}) => <li key={`${agent.id}-${warning.kind}`}>
        <span className={`pill ${warning.kind === 'errors' ? 'bad' : 'warn'}`}>{warning.kind === 'errors' ? 'Failing calls' : 'Quiet'}</span>
        <Link href={`/agents/${agent.id}`}>{agent.name}</Link><span className="muted">{warning.text}</span>
      </li>)}</ul>
    </section>}

    {totals.total === 0
      ? <div className="panel"><div className="empty"><strong>No calls in the last {days} days</strong>
          <p>Calls appear after an owner imports them from Retell on My Agents. Try a longer period if you expected some.</p>
          <Link className="button" href="/agents">Go to My Agents</Link></div></div>
      : <>
        <section className="panel panel-body">
          <div className="chart-head">
            <h2>Calls per day</h2>
            <ul className="legend" aria-label="Legend">
              <li><i style={{background: chartColours.connected}}/>Connected</li>
              <li><i style={{background: chartColours.other}}/>Not connected</li>
            </ul>
          </div>
          <CallsChart days={chartDays}
            summary={`Calls per day for the last ${days} days: ${totals.total} calls, ${totals.connected} connected. Busiest day ${shortDate(busiest.day)} with ${busiest.total} calls.`}/>
          <details className="table-view">
            <summary>Show as a table</summary>
            <DataTable label="Calls per day" search="never" columns={[{label: 'Day', first: 'desc'}, {label: 'Calls', className: 'num', first: 'desc'}, {label: 'Connected', className: 'num', first: 'desc'}, {label: 'Not connected', className: 'num', first: 'desc'}]}
              rows={series.filter(d => d.total > 0).map(d => ({key: d.day, cells: [
                {value: d.day, text: shortDate(d.day), content: shortDate(d.day)}, {value: d.total, className: 'num', content: d.total},
                {value: d.connected, className: 'num', content: d.connected}, {value: d.total - d.connected, className: 'num', content: d.total - d.connected}]}))}/>
          </details>
        </section>
        <section className="panel panel-body">
          <div className="chart-head"><h2>Busy hours</h2><span className="hint">UK time</span></div>
          <BusyHours rows={(hours.data ?? []) as HourStat[]} period={span}/>
        </section>

        <section>
          <div className="section-head"><h2>Busiest agents</h2></div>
          <div className="panel"><DataTable label="Busiest agents" searchHint="Search agents or clients"
            columns={[{label: 'Agent'}, {label: 'Calls', className: 'num', first: 'desc'}, {label: 'Connected', className: 'num', first: 'desc'}, {label: 'Average length', className: 'num', first: 'desc'}]}
            rows={topAgents.map(row => {
              const agent = agents.get(row.agent_id)
              const client = agent?.client_id ? clients.get(agent.client_id) : null
              const sub = agent?.is_transfer_agent ? 'Transfer agent' : client ?? 'No client'
              const rate = row.total > 0 ? row.connected / row.total : null
              const average = row.timed > 0 ? row.connected_ms / row.timed : null
              return {key: row.agent_id, cells: [
                {value: agent?.name ?? 'Unknown', text: `${agent?.name ?? 'Unknown'} ${sub}`, className: 'primary-cell',
                  content: <>{agent ? <Link className="row-link" href={`/agents/${row.agent_id}`}>{agent.name}</Link> : 'Unknown'}<span className="sub">{sub}</span></>},
                {value: row.total, text: '', className: 'num', content: row.total.toLocaleString('en-GB')},
                {value: rate, text: '', className: 'num', content: formatPercent(rate)},
                {value: average, text: '', className: 'num', content: average === null ? 'None yet' : formatDuration(average)}]}
            })}/></div>
        </section>
      </>}

    <section>
      <div className="section-head"><h2>Latest calls</h2>{recent.length > 0 && <Link href={transfers ? "/calls?transfers=1" : "/calls"}>All calls</Link>}</div>
      <div className="panel">{recent.length === 0
        ? <div className="empty"><strong>No calls yet</strong><p>Calls appear here after an owner imports them from Retell on My Agents.</p></div>
        : <CallTable label="Latest calls" calls={recent} columns={['started', 'agent', 'client', 'status', 'length']}/>}
      </div>
    </section>
  </div>
}

// A small change label under a figure. Only the connected rate is coloured, because more is clearly better there;
// for the others, up or down is not good or bad in itself.
function Delta({change, good}: {change: Change | null; good?: 'up'}) {
  if (!change) return null
  const tone = good && (change.direction === 'up' || change.direction === 'down') ? (change.direction === good ? 'ok' : 'bad') : 'neutral'
  return <span className={`delta ${tone}`} title={change.words}><span aria-hidden="true">{change.label}</span><span className="visually-hidden">{change.words}</span></span>
}
