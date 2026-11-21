import test from 'node:test'
import assert from 'node:assert/strict'
import { agentWarnings, compare, heatGrid } from '../lib/insights.ts'
import { addMonths, monthLabel, monthRange, parseMonth, periodRange, previousPeriodRange } from '../lib/period.ts'
import { formatCost, formatMinutes, formatRate } from '../lib/format.ts'

test('changes against the previous period are worded plainly', () => {
  assert.deepEqual(compare(112, 100, 'percent', '30 days'), { label: '↑ 12%', words: '12% more than the previous 30 days', direction: 'up' })
  assert.equal(compare(80, 100, 'percent', '7 days').label, '↓ 20%')
  assert.equal(compare(5, 0, 'percent', '7 days').label, 'New')
  assert.equal(compare(0, 0, 'percent', '7 days'), null)
  assert.equal(compare(100, 100.2, 'percent', '7 days').label, 'No change')
  assert.equal(compare(0.62, 0.58, 'points', '30 days').label, '↑ 4 pts')
  assert.equal(compare(null, 0.5, 'points', '30 days'), null)
})

test('the previous period ends where the current one starts and is the same length', () => {
  const now = new Date('2026-11-21T10:00:00Z')
  const current = periodRange(7, now), previous = previousPeriodRange(7, now)
  assert.equal(previous.toTs, current.fromTs)
  assert.equal(Date.parse(previous.toTs) - Date.parse(previous.fromTs), 7 * 86400000)
})

test('busy hours become a Monday-first grid with five shades and a busiest slot', () => {
  const { cells, max, busiest } = heatGrid([{ weekday: 3, hour: 10, total: 8 }, { weekday: 3, hour: 11, total: 2 }, { weekday: 7, hour: 23, total: 1 }, { weekday: 9, hour: 2, total: 50 }])
  assert.equal(cells.length, 7); assert.equal(cells[0].length, 24)
  assert.equal(max, 8)
  assert.deepEqual([cells[2][10].shade, cells[2][11].shade, cells[6][23].shade, cells[0][0].shade], [4, 1, 1, 0])
  assert.deepEqual(busiest, { weekday: 2, hour: 10, total: 8 })
  assert.equal(heatGrid([]).busiest, null)
})

test('agents are flagged only when quiet against their usual volume or failing more than usual', () => {
  const agent = { is_suspended: false, is_transfer_agent: false }
  const row = (o) => ({ agent_id: 'x', last_call_at: null, calls_24h: 0, errors_24h: 0, calls_7d: 0, errors_7d: 0, ...o })
  assert.deepEqual(agentWarnings(row({ calls_7d: 14 }), agent).map(w => w.kind), ['quiet'])
  assert.deepEqual(agentWarnings(row({ calls_7d: 3 }), agent), [], 'a low-volume agent is not quiet')
  assert.deepEqual(agentWarnings(row({ calls_7d: 14 }), { ...agent, is_suspended: true }), [], 'suspended agents are not flagged')
  assert.deepEqual(agentWarnings(row({ calls_7d: 14 }), { ...agent, is_transfer_agent: true }), [], 'transfer agents are not quiet')
  assert.deepEqual(agentWarnings(row({ calls_24h: 10, errors_24h: 4, calls_7d: 50, errors_7d: 4 }), agent).map(w => w.kind), ['errors'])
  assert.deepEqual(agentWarnings(row({ calls_24h: 10, errors_24h: 2, calls_7d: 50, errors_7d: 2 }), agent), [], 'two failures are not enough')
  assert.deepEqual(agentWarnings(row({ calls_24h: 10, errors_24h: 3, calls_7d: 70, errors_7d: 35 }), agent), [], 'not unusual for this agent')
  assert.deepEqual(agentWarnings(undefined, agent), [])
})

test('months are read safely and cover whole UK months', () => {
  const now = new Date('2026-11-21T10:00:00Z')
  assert.equal(parseMonth('2026-10', now), '2026-10')
  for (const bad of ['2026-12', '2024-01', '2026-13', 'november', undefined]) assert.equal(parseMonth(bad, now), '2026-11', String(bad))
  assert.equal(addMonths('2026-01', -1), '2025-12')
  assert.deepEqual(monthRange('2026-07'), { fromTs: '2026-06-30T23:00:00.000Z', toTs: '2026-07-31T23:00:00.000Z' })
  assert.equal(monthLabel('2026-11'), 'November 2026')
})

test('costs show in dollars from cents, and minutes to one decimal place', () => {
  assert.equal(formatCost(123456.7), '$1,234.57')
  assert.equal(formatCost(0), '$0.00')
  assert.equal(formatCost(null), 'Unknown')
  assert.equal(formatRate(7.24), '$0.072')
  assert.equal(formatRate(null), 'None yet')
  assert.equal(formatMinutes(90000), '1.5')
  assert.equal(formatMinutes(3_600_000 * 30), '1,800.0')
})

test('usage and cost are shown only to owners and admins, on the page and in the export', async () => {
  const { readFile } = await import('node:fs/promises')
  const page = await readFile(new URL('../app/(platform)/usage/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /if \(membership\.role !== 'owner' && membership\.role !== 'admin'\) return/)
  assert.ok(page.indexOf("membership.role !== 'owner'") < page.indexOf('monthUsage('), 'the role is checked before costs are read')
  const route = await readFile(new URL('../app/(platform)/usage/export/route.ts', import.meta.url), 'utf8')
  assert.match(route, /membership\.role !== 'owner' && membership\.role !== 'admin'\)\) return refuse\(403\)/)
  assert.match(route, /parseMonth\(request\.nextUrl\.searchParams\.get\('month'\)\)/)
})

test('the usage export lists each client with a totals row', async () => {
  const { buildUsageWorkbook } = await import('../lib/export.ts')
  const ExcelJS = (await import('exceljs')).default
  const file = await buildUsageWorkbook([{ client: 'North42', total: 10, connected: 8, duration_ms: 600000, cost_cents: 250, costed: 9 }], { month: '2026-11', exportedAt: new Date('2026-11-21T10:00:00Z') })
  const book = new ExcelJS.Workbook(); await book.xlsx.load(file)
  const sheet = book.getWorksheet('Usage')
  assert.deepEqual(sheet.getRow(2).values.slice(1), ['North42', 10, 8, 10, 2.5, 1])
  assert.equal(sheet.getRow(3).getCell(1).value, 'Total')
  assert.equal(sheet.getRow(3).getCell(5).value.formula, 'SUM(E2:E2)')
})

test('agent health is measured up to the newest imported call', async () => {
  const { readFile } = await import('node:fs/promises')
  const loader = await readFile(new URL('../lib/health.ts', import.meta.url), 'utf8')
  assert.match(loader, /order\('started_at', \{ ascending: false \}\)\.limit\(1\)/)
  assert.match(loader, /rpc\('agent_health', \{ at: measuredAt \}\)/)
})
