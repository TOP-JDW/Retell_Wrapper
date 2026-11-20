import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { addDays, fillDays, isDate, londonMidnight, londonToday, parsePeriod, periodRange, shortDate, summarise } from '../lib/period.ts'
import { filterQuery, isFiltered, pageSize, parseCallFilters } from '../lib/filters.ts'
import { formatPercent, formatTalkTime } from '../lib/format.ts'

test('UK midnight is right in winter, in summer and on the days the clocks change', () => {
  assert.equal(londonMidnight('2026-01-15').toISOString(), '2026-01-15T00:00:00.000Z')
  assert.equal(londonMidnight('2026-07-01').toISOString(), '2026-06-30T23:00:00.000Z')
  assert.equal(londonMidnight('2026-03-29').toISOString(), '2026-03-29T00:00:00.000Z') // clocks go forward at 01:00
  assert.equal(londonMidnight('2026-03-30').toISOString(), '2026-03-29T23:00:00.000Z')
  assert.equal(londonMidnight('2026-10-25').toISOString(), '2026-10-24T23:00:00.000Z') // clocks go back at 02:00
  assert.equal(londonMidnight('2026-10-26').toISOString(), '2026-10-26T00:00:00.000Z')
})

test('today and periods follow the UK date, not the server date', () => {
  assert.equal(londonToday(new Date('2026-07-01T23:30:00Z')), '2026-07-02')
  assert.equal(londonToday(new Date('2026-01-01T23:30:00Z')), '2026-01-01')
  const range = periodRange(7, new Date('2026-07-01T23:30:00Z'))
  assert.equal(range.dates.length, 7)
  assert.deepEqual([range.dates[0], range.dates[6]], ['2026-06-26', '2026-07-02'])
  assert.equal(range.fromTs, '2026-06-25T23:00:00.000Z')
  assert.equal(range.toTs, '2026-07-02T23:00:00.000Z')
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})

test('only 7, 30 and 90 days are allowed, and 30 is the default', () => {
  assert.deepEqual([7, '30', '90', '15', undefined, 'x', -7].map(parsePeriod), [7, 30, 90, 30, 30, 30, 30])
})

test('missing days are filled with zero and totals add up', () => {
  const filled = fillDays([{ day: '2026-07-02', total: 3, connected: 2, connected_ms: 180000, timed: 2 }], ['2026-07-01', '2026-07-02', '2026-07-03'])
  assert.deepEqual(filled.map(d => d.total), [0, 3, 0])
  const sum = summarise(filled)
  assert.deepEqual(sum, { total: 3, connected: 2, rate: 2 / 3, averageMs: 90000, talkMs: 180000 })
  assert.deepEqual(summarise([]), { total: 0, connected: 0, rate: null, averageMs: null, talkMs: 0 })
  assert.equal(shortDate('2026-11-05'), '5 Nov')
})

test('call filters accept only real values and keep the date range in order', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  assert.deepEqual(parseCallFilters({ client: id, agent: id.toUpperCase(), from: '2026-11-01', to: '2026-11-20', page: '2' }),
    { client: id, agent: id, from: '2026-11-01', to: '2026-11-20', page: 2, transfers: false, sort: 'started', dir: 'desc' })
  assert.deepEqual(parseCallFilters({ from: '2026-11-20', to: '2026-11-01' }), { client: null, agent: null, from: '2026-11-01', to: '2026-11-20', page: 1, transfers: false, sort: 'started', dir: 'desc' })
  assert.deepEqual(parseCallFilters({ client: 'none' }).client, 'none')
  for (const bad of [{ client: 'x' }, { agent: "1' or 1=1" }, { from: '2026-02-30' }, { to: '20-11-2026' }, { page: '0' }, { page: '-1' }, { page: 'abc' }])
    assert.deepEqual(parseCallFilters(bad), { client: null, agent: null, from: null, to: null, page: 1, transfers: false, sort: 'started', dir: 'desc' }, JSON.stringify(bad))
  assert.deepEqual(parseCallFilters({ client: [id, 'other'] }).client, id)
  assert.equal(isDate('2024-02-29'), true)
  assert.equal(isDate('2026-02-29'), false)
  assert.equal(pageSize, 100)
})

test('page links keep the filters', () => {
  const filters = parseCallFilters({ client: 'none', from: '2026-11-01' })
  assert.equal(filterQuery(filters, { page: 2 }), '?client=none&from=2026-11-01&page=2')
  assert.equal(filterQuery(filters, { page: 1 }), '?client=none&from=2026-11-01')
  assert.equal(filterQuery(parseCallFilters({})), '')
  assert.equal(isFiltered(filters), true)
  assert.equal(isFiltered(parseCallFilters({ page: '3' })), false)
})

test('transfer calls are hidden unless asked for, and the choice survives paging', () => {
  assert.equal(parseCallFilters({}).transfers, false)
  assert.equal(parseCallFilters({ transfers: '1' }).transfers, true)
  for (const other of ['0', 'yes', 'true', '']) assert.equal(parseCallFilters({ transfers: other }).transfers, false)
  const filters = parseCallFilters({ transfers: '1', client: 'none' })
  assert.equal(filterQuery(filters, { page: 2 }), '?client=none&transfers=1&page=2')
  assert.equal(isFiltered(parseCallFilters({ transfers: '1' })), true)
})

test('talk time and percentages read naturally', () => {
  assert.equal(formatTalkTime(0), '0m')
  assert.equal(formatTalkTime(59 * 60000), '59m')
  assert.equal(formatTalkTime(372 * 60000), '6h 12m')
  assert.equal(formatPercent(null), 'None yet')
  assert.equal(formatPercent(0.666), '67%')
})

test('the chart uses the colours checked by the data-visualisation validator', async () => {
  const chart = await readFile(new URL('../lib/chart.ts', import.meta.url), 'utf8')
  assert.match(chart, /connected: '#3D4FB8', other: '#57C1E8'/)
})
