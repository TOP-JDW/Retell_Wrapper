import { heatGrid, hourLabel, weekdays, type HourStat } from '../../lib/insights'
import { DataTable } from './DataTable'

// Calls by weekday and hour as a grid, one shade of the chart colour from light (few) to dark (many),
// with a hover label on each square, a legend and a table view.
export function BusyHours({ rows, period }: { rows: HourStat[]; period: string }) {
  const { cells, max, busiest } = heatGrid(rows)
  const summary = busiest
    ? `Busiest time: ${weekdays[busiest.weekday]}s ${hourLabel(busiest.hour)} to ${hourLabel((busiest.hour + 1) % 24)}, with ${busiest.total} ${busiest.total === 1 ? 'call' : 'calls'} in the last ${period}.`
    : `No calls in the last ${period}.`
  return <>
    <p className="heat-summary">{summary}</p>
    <div className="heat-scroll">
      <div className="heat" role="img" aria-label={`Calls by weekday and hour, UK time. ${summary}`}>
        <span/>{Array.from({ length: 24 }, (_, h) => <span key={h} className="heat-hour" aria-hidden="true">{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>)}
        {cells.map((hours, d) => <div className="heat-row" key={d} style={{ display: 'contents' }}>
          <span className="heat-day" aria-hidden="true">{weekdays[d].slice(0, 3)}</span>
          {hours.map((cell, h) => <span key={h} className={`heat-cell s${cell.shade}`}
            title={`${weekdays[d]} ${hourLabel(h)}–${hourLabel((h + 1) % 24)}: ${cell.total} ${cell.total === 1 ? 'call' : 'calls'}`}/>)}
        </div>)}
      </div>
    </div>
    <div className="heat-legend" aria-hidden="true"><span>Fewer</span>{[0, 1, 2, 3, 4].map(s => <i key={s} className={`heat-cell s${s}`}/>)}<span>More{max > 0 ? ` (up to ${max} an hour)` : ''}</span></div>
    <details className="table-view">
      <summary>Show as a table</summary>
      <DataTable label="Calls by weekday and hour" search="never"
        columns={[{ label: 'Day' }, { label: 'Hour' }, { label: 'Calls', className: 'num', first: 'desc' }]}
        rows={cells.flatMap((hours, d) => hours.map((cell, h) => ({ d, h, cell }))).filter(x => x.cell.total > 0).map(({ d, h, cell }) => ({
          key: `${d}-${h}`, cells: [{ value: d, text: weekdays[d], content: weekdays[d] }, { value: h, text: hourLabel(h), content: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}` },
            { value: cell.total, className: 'num', content: cell.total }] }))}/>
    </details>
  </>
}
