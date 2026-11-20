import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { allowedRecordingUrl, cachedLink, relayHeaders, rememberLink, safeRange } from '../lib/recording.ts'

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

test('recordings and transcripts are read from Retell only for owners and admins', async () => {
  const page = await readFile(new URL('../app/(platform)/calls/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /const isStaff = membership.role === 'owner' \|\| membership.role === 'admin'/)
  assert.match(page, /\{isStaff\n\s+\? <CallInsight /)
  const preview = await readFile(new URL('../app/(preview)/preview/[clientId]/calls/[callId]/page.tsx', import.meta.url), 'utf8')
  assert.match(preview, /const isStaff = membership\.role === 'owner' \|\| membership\.role === 'admin'/)
  assert.match(preview, /\{isStaff\n\s+\? <CallInsight /)
  assert.match(preview, /if \(!client\.recordings_for_client\) notFound\(\)/, 'the preview opens calls only when the client setting is on')
  const insight = await readFile(new URL('../app/components/CallInsight.tsx', import.meta.url), 'utf8')
  assert.ok(!/^['"]use client['"]/m.test(insight), 'the Retell part never runs in the browser')
})

test('recordings are fetched only over HTTPS from Retell\'s storage hosts', () => {
  for (const ok of ['https://retellai.s3.us-west-2.amazonaws.com/abc/recording.wav?X-Amz-Signature=1', 'https://retellai.s3.amazonaws.com/a.wav',
    'https://dxc03zgurdly9.cloudfront.net/abc/recording.wav'])
    assert.ok(allowedRecordingUrl(ok), ok)
  for (const bad of ['http://retellai.s3.us-west-2.amazonaws.com/a.wav', 'https://169.254.169.254/latest/meta-data', 'https://127.0.0.1/a.wav',
    'https://localhost/a.wav', 'https://retellai.s3.us-west-2.amazonaws.com:8443/a.wav', 'https://evil.com/retellai.s3.amazonaws.com',
    'https://retellai.s3.us-west-2.amazonaws.com.evil.com/a.wav', 'https://other-bucket.s3.amazonaws.com/a.wav', 'https://user:pw@retellai.s3.amazonaws.com/a',
    'https://a.b.cloudfront.net/a.wav', 'file:///etc/passwd', 'not a url', ''])
    assert.equal(allowedRecordingUrl(bad), null, bad)
})

test('the relay checks the host and does not follow redirects', async () => {
  const route = await readFile(new URL('../app/(platform)/calls/[id]/recording/route.ts', import.meta.url), 'utf8')
  assert.ok(route.indexOf('allowedRecordingUrl(link)') < route.indexOf('await fetch('))
  assert.match(route, /fetch\(target\.href, .*redirect: 'manual'/)
  // Access is checked before the shared link cache is read.
  assert.ok(route.indexOf("membership.role !== 'owner' && membership.role !== 'admin'") < route.indexOf('cachedLink('))
  assert.ok(route.indexOf(".eq('workspace_id', membership.workspace_id)") < route.indexOf('cachedLink('))
})
