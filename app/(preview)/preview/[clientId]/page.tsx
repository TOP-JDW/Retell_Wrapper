import Link from 'next/link'
import { previewChartColours } from '../../../../lib/branding'
import { latestCalls } from '../../../../lib/calls'
import { formatDuration, formatPercent, formatTalkTime } from '../../../../lib/format'
import { mergeDays, parsePeriod, periodRange, periods, shortDate, summarise, type DayStat } from '../../../../lib/period'
import { loadPreview } from '../../../../lib/preview'
import { CallTable } from '../../../components/CallTable'
import { CallsChart } from '../../../components/CallsChart'

export default async function PreviewDashboard({params, searchParams}: {params: Promise<{clientId: string}>; searchParams: Promise<{days?: string}>}) {
  const {db, membership, client, agents, brand} = await loadPreview((await params).clientId)
  const days = parsePeriod((await searchParams).days)
  const range = periodRange(days)
  const perAgent = await Promise.all(agents.map(agent =>
    db.rpc('call_agent_daily_stats', {target_agent: agent.id, from_ts: range.fromTs, to_ts: range.toTs})))
  if (perAgent.some(result => result.error)) throw new Error('Preview could not load.')
  const series = mergeDays(perAgent.map(result => (result.data ?? []) as DayStat[]), range.dates)
  const totals = summarise(series)
  const recent = await latestCalls(db, membership.workspace_id, 5, agents.map(agent => agent.id))
  const colours = previewChartColours(brand.accent)
  const base = `/preview/${client.id}`

  return <div className="stack">
    <header className="page-head">
      <div><h1>Welcome, {brand.name}</h1><p>Your calls in the last {days} days. Times are UK time.</p></div>
      <nav className="segmented" aria-label="Time period">{periods.map(p =>
        <Link key={p} href={`${base}?days=${p}`} aria-current={p === days ? 'true' : undefined}>{p} days</Link>)}</nav>
    </header>
    <section className="panel stats four" aria-label={`Figures for the last ${days} days`}>
      <div className="stat"><span>Calls</span><strong>{totals.total.toLocaleString('en-GB')}</strong></div>
      <div className="stat"><span>Connected</span><strong>{formatPercent(totals.rate)}</strong></div>
      <div className="stat"><span>Average length</span><strong>{totals.averageMs === null ? 'None yet' : formatDuration(totals.averageMs)}</strong></div>
      <div className="stat"><span>Talk time</span><strong>{formatTalkTime(totals.talkMs)}</strong></div>
    </section>
    {totals.total === 0
      ? <div className="panel"><div className="empty"><strong>No calls in the last {days} days</strong>
          <p>{agents.length === 0 ? 'No agents are linked to this client yet, so there is nothing to show. Link agents on My Agents.' : 'Try a longer period.'}</p></div></div>
      : <section className="panel panel-body">
          <div className="chart-head"><h2>Calls per day</h2>
            <ul className="legend" aria-label="Legend">
              <li><i style={{background: colours.connected}}/>Connected</li><li><i style={{background: colours.other}}/>Not connected</li>
            </ul></div>
          <CallsChart colours={colours} days={series.map(d => ({day: d.day, label: shortDate(d.day), connected: d.connected, other: d.total - d.connected}))}
            summary={`Calls per day for the last ${days} days: ${totals.total} calls, ${totals.connected} connected.`}/>
        </section>}
    <section>
      <div className="section-head"><h2>Latest calls</h2>{recent.length > 0 && <Link href={`${base}/calls`}>All calls</Link>}</div>
      <div className="panel">{recent.length === 0
        ? <div className="empty"><strong>No calls yet</strong></div>
        : <CallTable label="Latest calls" calls={recent} link={client.recordings_for_client ? `${base}/calls` : false} columns={['started', 'agent', 'status', 'length']}/>}
      </div>
    </section>
  </div>
}
