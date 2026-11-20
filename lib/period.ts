// UK calendar dates. Kept free of imports so tests can load it directly.
export const periods = [7, 30, 90] as const
export type Period = (typeof periods)[number]
export const defaultPeriod: Period = 30

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const london = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
})

function londonWallClock(ms: number) {
  const part = Object.fromEntries(london.formatToParts(new Date(ms)).map(p => [p.type, p.value]))
  return { y: +part.year, m: +part.month, d: +part.day, h: +part.hour, mi: +part.minute, s: +part.second }
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = datePattern.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return y >= 2000 && y <= 2100 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

// The instant UK clocks show 00:00 on the given date.
export function londonMidnight(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d)
  const w = londonWallClock(guess)
  const offset = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - guess
  return new Date(guess - offset)
}

export function londonToday(now = new Date()): string {
  const w = londonWallClock(now.getTime())
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function parsePeriod(value: unknown): Period {
  const n = Number(value)
  return (periods as readonly number[]).includes(n) ? (n as Period) : defaultPeriod
}

// The last `days` UK days, ending today.
export function periodRange(days: Period, now = new Date()) {
  const today = londonToday(now)
  const first = addDays(today, -(days - 1))
  const dates = Array.from({ length: days }, (_, i) => addDays(first, i))
  return { dates, fromTs: londonMidnight(first).toISOString(), toTs: londonMidnight(addDays(today, 1)).toISOString() }
}

export type DayStat = { day: string; total: number; connected: number; connected_ms: number; timed: number }

export function fillDays(rows: DayStat[], dates: string[]): DayStat[] {
  const byDay = new Map(rows.map(row => [String(row.day).slice(0, 10), row]))
  return dates.map(day => {
    const row = byDay.get(day)
    return row ? { ...row, day, total: +row.total, connected: +row.connected, connected_ms: +row.connected_ms, timed: +row.timed }
      : { day, total: 0, connected: 0, connected_ms: 0, timed: 0 }
  })
}

export function summarise(rows: { total: number; connected: number; connected_ms: number; timed: number }[]) {
  const total = rows.reduce((n, r) => n + +r.total, 0)
  const connected = rows.reduce((n, r) => n + +r.connected, 0)
  const talk = rows.reduce((n, r) => n + +r.connected_ms, 0)
  const timed = rows.reduce((n, r) => n + +r.timed, 0)
  return { total, connected, rate: total > 0 ? connected / total : null, averageMs: timed > 0 ? talk / timed : null, talkMs: talk }
}

export function shortDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

// Adds several agents' daily figures together, day by day.
export function mergeDays(lists: DayStat[][], dates: string[]): DayStat[] {
  const filled = lists.map(rows => fillDays(rows, dates))
  return dates.map((day, i) => filled.reduce((sum, rows) => ({
    day, total: sum.total + rows[i].total, connected: sum.connected + rows[i].connected,
    connected_ms: sum.connected_ms + rows[i].connected_ms, timed: sum.timed + rows[i].timed
  }), { day, total: 0, connected: 0, connected_ms: 0, timed: 0 }))
}
