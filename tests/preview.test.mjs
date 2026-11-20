import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { mergeDays, summarise } from '../lib/period.ts'
import { contrast, previewChartColours } from '../lib/branding.ts'

test('a client\'s figures are its agents\' figures added day by day', () => {
  const dates = ['2026-11-18', '2026-11-19', '2026-11-20']
  const one = [{ day: '2026-11-18', total: 3, connected: 2, connected_ms: 120000, timed: 2 }]
  const two = [{ day: '2026-11-18', total: 1, connected: 1, connected_ms: 60000, timed: 1 }, { day: '2026-11-20', total: 2, connected: 0, connected_ms: 0, timed: 0 }]
  const merged = mergeDays([one, two], dates)
  assert.deepEqual(merged.map(d => [d.day, d.total, d.connected]), [['2026-11-18', 4, 3], ['2026-11-19', 0, 0], ['2026-11-20', 2, 0]])
  assert.equal(summarise(merged).averageMs, 60000)
  assert.deepEqual(mergeDays([], dates).map(d => d.total), [0, 0, 0])
})

test('the preview chart pairs the client colour with a grey that stays distinguishable', () => {
  for (const accent of ['#96BE28', '#2D3C97', '#FFB800', '#0E7C66']) assert.deepEqual(previewChartColours(accent), { connected: accent, other: '#B4BDCA' })
  for (const greyish of ['#E4E9F1', '#B4BDCA', '#A8B0BC']) {
    const { other } = previewChartColours(greyish)
    assert.equal(other, '#6B7585', greyish)
    assert.ok(contrast(greyish, other) >= 1.6, greyish)
  }
  assert.equal(previewChartColours('#B4BDCA').other, '#6B7585')   // a grey brand colour gets a darker grey
  assert.equal(previewChartColours('#96BE28').other, '#B4BDCA')
})

test('the preview only loads this client\'s own agents, in the signed-in user\'s workspace', async () => {
  const loader = await readFile(new URL('../lib/preview.ts', import.meta.url), 'utf8')
  assert.match(loader, /await member\(\)/)
  assert.match(loader, /from\('clients'\)\.select\('id,name,recordings_for_client'\)\.eq\('id', id\)\.eq\('workspace_id', membership\.workspace_id\)/)
  assert.match(loader, /from\('agents'\).*\.eq\('workspace_id', membership\.workspace_id\)\.eq\('client_id', id\)\.eq\('is_transfer_agent', false\)/)
  for (const page of ['page.tsx', 'calls/page.tsx']) {
    const text = await readFile(new URL(`../app/(preview)/preview/[clientId]/${page}`, import.meta.url), 'utf8')
    assert.match(text, /agents\.map\(agent => agent\.id\)/, `${page} limits calls to the client's agents`)
    assert.ok(!/from\('calls'\)/.test(text), `${page} must not query calls directly`)
  }
})

test('every preview page has a way back to The One Point', async () => {
  const layout = await readFile(new URL('../app/(preview)/preview/[clientId]/layout.tsx', import.meta.url), 'utf8')
  assert.match(layout, /href=\{`\/clients\/\$\{client\.id\}`\}>Back to The One Point<\/Link>/)
})
