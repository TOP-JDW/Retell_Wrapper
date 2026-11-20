'use client'
import { useState } from 'react'
import { chartColours } from '../../lib/chart'

export type ChartDay = { day: string; label: string; connected: number; other: number }


const W = 760, H = 240, left = 40, right = 8, top = 22, bottom = 26
const innerW = W - left - right, innerH = H - top - bottom
const gap = 2

function niceStep(max: number) {
  const rough = Math.max(max, 1) / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map(n => n * power).find(n => n >= rough) ?? 10 * power
  return Math.max(1, step)
}

// A bar with a rounded data end at the top and a square foot on the baseline.
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`
}

export function CallsChart({ days, summary }: { days: ChartDay[]; summary: string }) {
  const [active, setActive] = useState<number | null>(null)
  const totals = days.map(d => d.connected + d.other)
  const step = niceStep(Math.max(...totals, 0))
  const yMax = step * Math.max(1, Math.ceil(Math.max(...totals, 1) / step))
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step)
  const y = (v: number) => top + innerH - (v / yMax) * innerH
  const slot = innerW / days.length
  const barW = Math.min(24, Math.max(2, slot - gap))
  const peak = totals.indexOf(Math.max(...totals))
  const labelEvery = days.length <= 7 ? 1 : days.length <= 31 ? 7 : 15
  const shown = active === null ? null : days[active]

  return <div className="chart-scroll"><div className="chart" onMouseLeave={() => setActive(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
      {ticks.map(t => <g key={t}>
        <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="#E4E9F1" strokeWidth="1"/>
        <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">{t.toLocaleString('en-GB')}</text>
      </g>)}
      {days.map((d, i) => {
        const cx = left + slot * i + slot / 2
        const x = cx - barW / 2
        const hConnected = (d.connected / yMax) * innerH
        const hOther = (d.other / yMax) * innerH
        const otherBase = y(d.connected) - (d.connected > 0 && d.other > 0 ? gap : 0)
        return <g key={d.day}>
          {active === i && <rect x={left + slot * i} y={top} width={slot} height={innerH} fill="#F1F4F9"/>}
          {d.connected > 0 && <path d={d.other > 0 ? `M${x},${y(0)}V${y(d.connected)}H${x + barW}V${y(0)}Z` : topRounded(x, y(d.connected), barW, hConnected, 4)} fill={chartColours.connected}/>}
          {d.other > 0 && <path d={topRounded(x, otherBase - hOther, barW, hOther, 4)} fill={chartColours.other}/>}
          {i === peak && totals[i] > 0 && <text x={cx} y={y(totals[i]) - (d.connected > 0 && d.other > 0 ? gap : 0) - 6} textAnchor="middle" className="chart-value">{totals[i].toLocaleString('en-GB')}</text>}
          {(i % labelEvery === 0 || i === days.length - 1) && (i === days.length - 1 || days.length - 1 - i >= labelEvery / 2) &&
            <text x={cx} y={H - 8} textAnchor="middle" className="chart-axis">{d.label}</text>}
          <rect x={left + slot * i} y={top} width={slot} height={innerH} fill="transparent" tabIndex={0}
            aria-label={`${d.label}: ${totals[i]} calls, ${d.connected} connected`}
            onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}/>
        </g>
      })}
      <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="#C9D2E1" strokeWidth="1"/>
    </svg>
    {shown && active !== null && <div className="chart-tip" role="status"
      style={{ left: `${((left + slot * active + slot / 2) / W) * 100}%`, transform: `translateX(${active < days.length * 0.15 ? '0' : active > days.length * 0.85 ? '-100%' : '-50%'})` }}>
      <strong>{shown.label}</strong>
      <span><i style={{ background: chartColours.connected }}/>Connected<b>{shown.connected}</b></span>
      <span><i style={{ background: chartColours.other }}/>Not connected<b>{shown.other}</b></span>
      <span className="chart-tip-total">Total<b>{shown.connected + shown.other}</b></span>
    </div>}
  </div></div>
}
