// Dashboard insights: change against the previous period, busy hours and agent health. No imports, so tests load it directly.

export type Change = { label: string; words: string; direction: 'up' | 'down' | 'same' | 'new' }

// How a figure moved since the previous period. 'percent' compares sizes; 'points' compares two rates.
export function compare(current: number | null, previous: number | null, kind: 'percent' | 'points', period: string): Change | null {
  if (current === null || previous === null) return null
  if (kind === 'points') {
    const points = Math.round((current - previous) * 100)
    if (points === 0) return { label: 'No change', words: `the same as the previous ${period}`, direction: 'same' }
    return { label: `${points > 0 ? '↑' : '↓'} ${Math.abs(points)} pts`, words: `${Math.abs(points)} percentage points ${points > 0 ? 'higher' : 'lower'} than the previous ${period}`, direction: points > 0 ? 'up' : 'down' }
  }
  if (previous === 0) return current === 0 ? null : { label: 'New', words: `none in the previous ${period}`, direction: 'new' }
  const percent = Math.round(((current - previous) / previous) * 100)
  if (percent === 0) return { label: 'No change', words: `the same as the previous ${period}`, direction: 'same' }
  return { label: `${percent > 0 ? '↑' : '↓'} ${Math.abs(percent)}%`, words: `${Math.abs(percent)}% ${percent > 0 ? 'more' : 'less'} than the previous ${period}`, direction: percent > 0 ? 'up' : 'down' }
}

export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export type HourStat = { weekday: number; hour: number; total: number }

// A 7 by 24 grid of call counts (Monday first), each with a shade from 0 (none) to 4 (busiest).
export function heatGrid(rows: HourStat[]) {
  const counts = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const row of rows) {
    const d = +row.weekday - 1, h = +row.hour
    if (d >= 0 && d < 7 && h >= 0 && h < 24) counts[d][h] += +row.total
  }
  const max = Math.max(0, ...counts.flat())
  const shade = (n: number) => n === 0 || max === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4)))
  let busiest: { weekday: number; hour: number; total: number } | null = null
  counts.forEach((hours, d) => hours.forEach((n, h) => { if (n > 0 && (!busiest || n > busiest.total)) busiest = { weekday: d, hour: h, total: n } }))
  return { cells: counts.map(hours => hours.map(n => ({ total: n, shade: shade(n) }))), max, busiest: busiest as { weekday: number; hour: number; total: number } | null }
}
export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

export type HealthRow = { agent_id: string; last_call_at: string | null; calls_24h: number; errors_24h: number; calls_7d: number; errors_7d: number }
export type Warning = { kind: 'quiet' | 'errors'; text: string }

// Warnings for one agent. Quiet: it usually takes at least one call a day but took none in the last 24 hours.
// Errors: at least 3 failed calls in the last 24 hours, and at least 20% of its calls, and at least twice its usual rate.
export function agentWarnings(row: HealthRow | undefined, agent: { is_suspended: boolean; is_transfer_agent: boolean }): Warning[] {
  if (!row || agent.is_suspended) return []
  const warnings: Warning[] = []
  const calls24 = +row.calls_24h, errors24 = +row.errors_24h, calls7 = +row.calls_7d, errors7 = +row.errors_7d
  if (!agent.is_transfer_agent && calls7 >= 7 && calls24 === 0)
    warnings.push({ kind: 'quiet', text: `No calls in the last 24 hours. It usually takes about ${Math.round(calls7 / 7)} a day.` })
  const rate24 = calls24 > 0 ? errors24 / calls24 : 0
  const rate7 = calls7 > 0 ? errors7 / calls7 : 0
  if (errors24 >= 3 && rate24 >= Math.max(0.2, 2 * rate7 - 1e-9))
    warnings.push({ kind: 'errors', text: `${errors24} of ${calls24} calls failed in the last 24 hours.` })
  return warnings
}
