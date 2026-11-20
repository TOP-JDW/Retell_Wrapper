import Link from 'next/link'
import { member } from '../../../lib/auth'
import { agentNames, latestCalls } from '../../../lib/calls'
import { formatDuration, formatPercent, formatTalkTime, formatTime, plainWords } from '../../../lib/format'
import { fillDays, parsePeriod, periodRange, periods, shortDate, summarise, type DayStat } from '../../../lib/period'
import { callTone, capitalise } from '../../../lib/status'
import { chartColours } from '../../../lib/chart'
import { CallsChart } from '../../components/CallsChart'

type AgentStat = { agent_id: string; total: number; connected: number; connected_ms: number; timed: number }

export default async function Dashboard({searchParams}: {searchParams: Promise<{days?: string}>}) {
  const days = parsePeriod((await searchParams).days)
  const {db, membership} = await member()
  const range = periodRange(days)
  const args = {from_ts: range.fromTs, to_ts: range.toTs}
  const [daily, byAgent] = await Promise.all([db.rpc('call_daily_stats', args), db.rpc('call_agent_stats', args)])
  if (daily.error || byAgent.error) throw new Error('Dashboard could not load.')
  const series = fillDays((daily.data ?? []) as DayStat[], range.dates)
  const totals = summarise(series)
  const topAgents = ((byAgent.data ?? []) as AgentStat[]).slice(0, 10)
  const {agents, clients} = await agentNames(db, topAgents.map(row => row.agent_id))
  const recent = await latestCalls(db, membership.workspace_id, 5)
  const busiest = series.reduce((best, d) => (d.total > best.total ? d : best), series[0])
  const chartDays = series.map(d => ({day: d.day, label: shortDate(d.day), connected: d.connected, other: d.total - d.connected}))

  return <div className="stack">
    <header className="page-head">
      <div><h1>Dashboard</h1><p>Calls in the last {days} days. Days follow UK time.</p></div>
      <nav className="segmented" aria-label="Time period">{periods.map(p =>
        <Link key={p} href={`/dashboard?days=${p}`} aria-current={p === days ? 'true' : undefined}>{p} days</Link>)}</nav>
    </header>

    <section className="panel stats four" aria-label={`Figures for the last ${days} days`}>
      <div className="stat"><span>Calls</span><strong>{totals.total.toLocaleString('en-GB')}</strong></div>
      <div className="stat"><span>Connected</span><strong>{formatPercent(totals.rate)}</strong>
        {totals.total > 0 && <small>{totals.connected.toLocaleString('en-GB')} of {totals.total.toLocaleString('en-GB')} calls</small>}</div>
      <div className="stat"><span>Average length</span><strong>{totals.averageMs === null ? 'None yet' : formatDuration(totals.averageMs)}</strong>
        <small>Connected calls</small></div>
      <div className="stat"><span>Talk time</span><strong>{formatTalkTime(totals.talkMs)}</strong><small>Connected calls</small></div>
    </section>

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
            <div className="table-scroll"><table>
              <thead><tr><th>Day</th><th className="num">Calls</th><th className="num">Connected</th><th className="num">Not connected</th></tr></thead>
              <tbody>{series.filter(d => d.total > 0).map(d => <tr key={d.day}>
                <td>{shortDate(d.day)}</td><td className="num">{d.total}</td><td className="num">{d.connected}</td><td className="num">{d.total - d.connected}</td>
              </tr>)}</tbody>
            </table></div>
          </details>
        </section>

        <section>
          <div className="section-head"><h2>Busiest agents</h2></div>
          <div className="panel"><div className="table-scroll"><table>
            <thead><tr><th>Agent</th><th className="num">Calls</th><th className="num">Connected</th><th className="num">Average length</th></tr></thead>
            <tbody>{topAgents.map(row => {
              const agent = agents.get(row.agent_id)
              const client = agent?.client_id ? clients.get(agent.client_id) : null
              return <tr key={row.agent_id}>
                <td className="primary-cell">{agent?.name ?? 'Unknown'}
                  <span className="sub">{agent?.is_transfer_agent ? 'Transfer agent' : client ?? 'No client'}</span></td>
                <td className="num">{row.total.toLocaleString('en-GB')}</td>
                <td className="num">{formatPercent(row.total > 0 ? row.connected / row.total : null)}</td>
                <td className="num">{row.timed > 0 ? formatDuration(row.connected_ms / row.timed) : 'None yet'}</td>
              </tr>
            })}</tbody>
          </table></div></div>
        </section>
      </>}

    <section>
      <div className="section-head"><h2>Latest calls</h2>{recent.length > 0 && <Link href="/calls">All calls</Link>}</div>
      <div className="panel">{recent.length === 0
        ? <div className="empty"><strong>No calls yet</strong><p>Calls appear here after an owner imports them from Retell on My Agents.</p></div>
        : <div className="table-scroll"><table>
            <thead><tr><th>Started</th><th>Agent</th><th>Client</th><th>Status</th><th className="num">Length</th></tr></thead>
            <tbody>{recent.map(call => <tr key={call.id}>
              <td><Link className="row-link" href={`/calls/${call.id}`}>{formatTime(call.started_at)}</Link></td><td className="primary-cell">{call.agent_name}</td>
              <td className={call.client_name ? '' : 'unlinked'}>{call.client_name ?? 'No client'}</td>
              <td><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></td>
              <td className="num">{formatDuration(call.duration_ms)}</td>
            </tr>)}</tbody>
          </table></div>}
      </div>
    </section>
  </div>
}
