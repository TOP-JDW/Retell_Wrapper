import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { buildCallWorkbook, ukWallClock } from '../lib/export.ts'
import { parseCallFilters, scopeCalls } from '../lib/filters.ts'

const call = (over = {}) => ({ id: '00000000-0000-4000-8000-000000000001', started_at: '2026-07-01T09:30:00Z', agent_name: 'Reception',
  client_name: 'Think360', call_status: 'not_connected', call_type: 'phone_call', direction: 'inbound', disconnection_reason: 'dial_no_answer',
  duration_ms: 95_000, retell_call_id: 'call_abc', ...over })
const read = async buffer => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); return wb }

test('the export is a real Excel file with UK times, true durations and readable words', async () => {
  const wb = await read(await buildCallWorkbook([call()], { filters: 'client=none', truncated: false, origin: 'https://portal.example', exportedAt: new Date('2026-11-20T10:00:00Z') }))
  const sheet = wb.getWorksheet('Calls')
  assert.deepEqual(sheet.getRow(1).values.slice(1), ['Started (UK time)', 'Agent', 'Client', 'Status', 'Type', 'Length', 'Ended because', 'Retell call ID', 'Open in the portal'])
  const row = sheet.getRow(2)
  assert.equal(row.getCell(1).value.toISOString(), '2026-07-01T10:30:00.000Z')   // 09:30 UTC is 10:30 in British Summer Time
  assert.equal(row.getCell(1).numFmt, 'dd mmm yyyy hh:mm')
  const length = row.getCell(6).value   // the reader returns duration cells as dates from Excel's 1899 epoch
  const serial = length instanceof Date ? (length.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000 : length
  assert.equal(Math.round(serial * 86_400), 95)                                 // 1:35 as an Excel duration
  assert.equal(row.getCell(6).numFmt, '[m]:ss')
  assert.deepEqual([row.getCell(4).value, row.getCell(5).value, row.getCell(7).value], ['Not connected', 'Inbound', 'Dial no answer'])
  assert.equal(row.getCell(9).value.hyperlink, 'https://portal.example/calls/00000000-0000-4000-8000-000000000001')
  assert.equal(sheet.views[0].state, 'frozen')
  assert.equal(sheet.views[0].ySplit, 1)
  assert.equal(sheet.autoFilter, 'A1:I1')   // filter buttons on every column heading
  assert.equal(wb.getWorksheet('About this export').getRow(2).getCell(2).value, 'client=none')
})

test('text that looks like a formula stays text', async () => {
  const wb = await read(await buildCallWorkbook([call({ agent_name: '=HYPERLINK("http://evil.example","click")', client_name: '+1+1' })],
    { filters: '', truncated: false, origin: 'https://portal.example', exportedAt: new Date() }))
  const row = wb.getWorksheet('Calls').getRow(2)
  assert.equal(row.getCell(2).type, ExcelJS.ValueType.String)
  assert.equal(row.getCell(2).value, '=HYPERLINK("http://evil.example","click")')
  assert.equal(row.getCell(3).type, ExcelJS.ValueType.String)
})

test('a cut-short export says so, and missing values stay blank', async () => {
  const wb = await read(await buildCallWorkbook([call({ duration_ms: null, client_name: null, disconnection_reason: null })], { filters: '', truncated: true, origin: 'https://p.example', exportedAt: new Date() }))
  const row = wb.getWorksheet('Calls').getRow(2)
  assert.equal(row.getCell(6).value, null)   // no length known
  assert.equal(row.getCell(3).value, 'No client')
  assert.match(wb.getWorksheet('About this export').getRow(4).getCell(2).value, /Only the 10,000 newest/)
  assert.equal(ukWallClock('not a date'), null)
  assert.equal(ukWallClock('2026-01-15T09:30:00Z').toISOString(), '2026-01-15T09:30:00.000Z')
})

test('the export and Call History pick calls the same way', () => {
  const agents = [{ id: 'a', client_id: 'c1', is_transfer_agent: false }, { id: 't', client_id: null, is_transfer_agent: true }, { id: 'b', client_id: null, is_transfer_agent: false }]
  assert.deepEqual(scopeCalls(agents, parseCallFilters({})), { agentIds: ['a', 'b'], hiddenIds: ['t'] })
  assert.deepEqual(scopeCalls(agents, parseCallFilters({ transfers: '1' })), { agentIds: undefined, hiddenIds: [] })
  assert.deepEqual(scopeCalls(agents, parseCallFilters({ client: 'none' })), { agentIds: ['b'], hiddenIds: ['t'] })
  assert.deepEqual(scopeCalls([{ id: '00000000-0000-4000-8000-000000000009', client_id: null, is_transfer_agent: true }], parseCallFilters({ agent: '00000000-0000-4000-8000-000000000009' })),
    { agentIds: ['00000000-0000-4000-8000-000000000009'], hiddenIds: [] })
  assert.deepEqual(scopeCalls([{ id: 'x', client_id: null, is_transfer_agent: false }], parseCallFilters({})), { agentIds: undefined, hiddenIds: [] })
})

test('only owners and admins can export, checked before any data is read', async () => {
  const route = await readFile(new URL('../app/(platform)/calls/export/route.ts', import.meta.url), 'utf8')
  const check = route.indexOf("membership.role !== 'owner' && membership.role !== 'admin'")
  assert.ok(check > 0 && check < route.indexOf("from('agents')") && check < route.indexOf('findCalls('))
  assert.match(route, /'Cache-Control': 'private, no-store'/)
  const page = await readFile(new URL('../app/(platform)/calls/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /\(membership.role === 'owner' \|\| membership.role === 'admin'\) && count > 0 &&/)
})
