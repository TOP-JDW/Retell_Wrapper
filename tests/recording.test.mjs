import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { cachedLink, relayHeaders, rememberLink, safeRange } from '../lib/recording.ts'

test('only simple byte ranges are passed on to the recording host', () => {
  for (const ok of ['bytes=0-', 'bytes=100-200', 'bytes=-500']) assert.equal(safeRange(ok), ok)
  for (const bad of [null, '', 'bytes=-', 'bytes=0-1,5-6', 'items=0-1', 'bytes=0-1\r\nX: y', `bytes=${'9'.repeat(16)}-`]) assert.equal(safeRange(bad), null, String(bad))
})

test('relayed audio is never cached, sniffed or treated as a page', () => {
  const headers = relayHeaders(new Headers({ 'content-type': 'audio/mpeg', 'content-length': '1024', 'content-range': 'bytes 0-1023/4096', 'accept-ranges': 'bytes', 'set-cookie': 'a=b', 'x-amz-meta': 'secret' }))
  assert.equal(headers.get('content-type'), 'audio/mpeg')
  assert.equal(headers.get('cache-control'), 'private, no-store')
  assert.equal(headers.get('x-content-type-options'), 'nosniff')
  assert.equal(headers.get('content-security-policy'), "default-src 'none'")
  assert.equal(headers.get('content-range'), 'bytes 0-1023/4096')
  assert.equal(headers.get('set-cookie'), null)
  assert.equal(headers.get('x-amz-meta'), null)
  for (const type of ['text/html', 'application/octet-stream', 'image/svg+xml', '']) assert.equal(relayHeaders(new Headers({ 'content-type': type })).get('content-type'), 'audio/wav', type)
  assert.equal(relayHeaders(new Headers({ 'content-length': '12; x=<script>' })).get('content-length'), null)
})

test('recording links are reused for a minute at most', () => {
  rememberLink('call_a', 'https://example.com/a.wav', 1_000)
  assert.equal(cachedLink('call_a', 30_000), 'https://example.com/a.wav')
  assert.equal(cachedLink('call_a', 61_001), null)
  assert.equal(cachedLink('call_b', 1_000), null)
})

test('the recording relay checks sign-in, role and workspace before asking Retell, and sends no secrets on', async () => {
  const route = await readFile(new URL('../app/(platform)/calls/[id]/recording/route.ts', import.meta.url), 'utf8')
  const order = ['auth.getUser()', "membership.role !== 'owner' && membership.role !== 'admin'", ".eq('workspace_id', membership.workspace_id)", 'getCall(']
  const positions = order.map(text => route.indexOf(text))
  assert.ok(positions.every(p => p > 0), JSON.stringify(positions))
  assert.deepEqual([...positions].sort((x, y) => x - y), positions)
  const relay = route.slice(route.indexOf('upstream = await fetch('))
  const call = relay.slice(0, relay.indexOf('\n'))
  assert.ok(!/authorization|cookie|apiKey|Bearer/i.test(call), call)
  assert.match(call, /Range: range/)
})

test('the call page asks Retell only for owners and admins', async () => {
  const page = await readFile(new URL('../app/(platform)/calls/[id]/page.tsx', import.meta.url), 'utf8')
  const guard = page.indexOf('if (isStaff) {')
  assert.ok(guard > 0 && guard < page.indexOf('retell().getCall('))
  assert.match(page, /const isStaff = membership.role === 'owner' \|\| membership.role === 'admin'/)
})
