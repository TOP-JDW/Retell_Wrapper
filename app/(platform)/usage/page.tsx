import Link from 'next/link'
import { member } from '../../../lib/auth'
import { formatCost, formatMinutes, formatRate } from '../../../lib/format'
import { addMonths, monthLabel, parseMonth, thisMonth } from '../../../lib/period'
import { monthUsage } from '../../../lib/usage'
import { DataTable } from '../../components/DataTable'

// Calls, minutes and Retell cost per client for one month. Owners and admins only, because it shows costs.
export default async function Usage({searchParams}: {searchParams: Promise<{month?: string}>}) {
  const {db, membership} = await member()
  if (membership.role !== 'owner' && membership.role !== 'admin') return <div className="stack">
    <header className="page-head"><div><h1>Usage &amp; Cost</h1></div></header>
    <div className="panel"><div className="empty"><strong>Only owners and admins can see usage and cost</strong></div></div>
  </div>

  const month = parseMonth((await searchParams).month)
  const rows = await monthUsage(db, membership.workspace_id, month)
  const sum = (key: 'total' | 'connected' | 'duration_ms' | 'cost_cents' | 'costed') => rows.reduce((n, row) => n + row[key], 0)
  const total = sum('total'), missing = total - sum('costed')
  const earliest = addMonths(thisMonth(), -23), latest = thisMonth()

  return <div className="stack">
    <header className="page-head">
      <div><h1>Usage &amp; Cost</h1><p>Calls, minutes and Retell cost per client. Months follow UK time.</p></div>
      {total > 0 && <a className="button quiet-link" href={`/usage/export?month=${month}`} download>Export to Excel</a>}
    </header>
    <nav className="month-nav" aria-label="Month">
      {month > earliest ? <Link href={`/usage?month=${addMonths(month, -1)}`} aria-label="Previous month">‹</Link> : <span aria-hidden="true">‹</span>}
      <strong aria-live="polite">{monthLabel(month)}</strong>
      {month < latest ? <Link href={`/usage?month=${addMonths(month, 1)}`} aria-label="Next month">›</Link> : <span aria-hidden="true">›</span>}
      {month !== latest && <Link className="month-now" href="/usage">This month</Link>}
    </nav>
    <section className="panel stats four" aria-label={`Totals for ${monthLabel(month)}`}>
      <div className="stat"><span>Calls</span><strong>{total.toLocaleString('en-GB')}</strong></div>
      <div className="stat"><span>Minutes</span><strong>{formatMinutes(sum('duration_ms'))}</strong></div>
      <div className="stat"><span>Retell cost</span><strong>{formatCost(sum('cost_cents'))}</strong></div>
      <div className="stat"><span>Cost per minute</span><strong>{sum('duration_ms') > 0 ? formatRate(sum('cost_cents') / (sum('duration_ms') / 60000)) : 'None yet'}</strong></div>
    </section>
    {missing > 0 && <p className="notice info">{missing.toLocaleString('en-GB')} {missing === 1 ? 'call has' : 'calls have'} no cost yet. Calls imported before costs were added have none. Run Import from Retell on My Agents to fill them in.</p>}
    <div className="panel">{rows.length === 0
      ? <div className="empty"><strong>No calls in {monthLabel(month)}</strong></div>
      : <DataTable label={`Usage for ${monthLabel(month)}`} searchHint="Search clients"
          columns={[{label: 'Client'}, {label: 'Calls', className: 'num', first: 'desc'}, {label: 'Connected', className: 'num', first: 'desc'},
            {label: 'Minutes', className: 'num', first: 'desc'}, {label: 'Retell cost', className: 'num', first: 'desc'}, {label: 'Per minute', className: 'num', first: 'desc'}]}
          rows={rows.map(row => {
            const perMinute = row.duration_ms > 0 ? row.cost_cents / (row.duration_ms / 60000) : null
            return {key: row.clientId ?? 'none', cells: [
              {value: row.client, className: row.clientId ? 'primary-cell' : 'primary-cell unlinked',
                content: row.clientId ? <Link className="row-link" href={`/clients/${row.clientId}`}>{row.client}</Link> : row.client},
              {value: row.total, text: '', className: 'num', content: row.total.toLocaleString('en-GB')},
              {value: row.connected, text: '', className: 'num', content: row.connected.toLocaleString('en-GB')},
              {value: row.duration_ms, text: '', className: 'num', content: formatMinutes(row.duration_ms)},
              {value: row.cost_cents, text: '', className: 'num', content: <>{formatCost(row.cost_cents)}{row.costed < row.total && <span className="sub">{row.total - row.costed} without cost</span>}</>},
              {value: perMinute, text: '', className: 'num', content: formatRate(perMinute)}
            ]}
          })}/>}
    </div>
    <p className="hint">Costs are what Retell charged, in US dollars, before your margin. Transfer calls are included, because they are charged. Minutes include calls that did not connect.</p>
  </div>
}
