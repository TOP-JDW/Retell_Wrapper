import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRetell, toAgentRow, toCallRow, toCallDetail, RetellError, maximumCalls } from '../lib/retell.ts'
import { formatDuration, formatTime, plainWords } from '../lib/format.ts'
import { createDb, ids } from './setup.mjs'

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// A fake Retell that records every request and answers from a queue.
function fake(...answers) {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url: new URL(url), init, body: init.body ? JSON.parse(init.body) : null })
    const next = answers.shift()
    if (next instanceof Error) throw next
    return next ?? reply({ items: [], has_more: false })
  }
  return { client: createRetell({ apiKey: 'test-key', fetchImpl }), requests }
}
const failureOf = async promise => { try { await promise } catch (error) { assert.ok(error instanceof RetellError); return error.failure } assert.fail('should have failed') }

test('listing agents sends one read-only, voice-only request with the key', async () => {
  const { client, requests } = fake(reply({ items: [{ agent_id: 'agent_1', agent_name: 'Reception', is_suspended: false, user_modified_timestamp: 1767268800000 }], has_more: false }))
  const result = await client.listAgents()
  assert.deepEqual(result.agents, [{ retell_agent_id: 'agent_1', name: 'Reception', is_suspended: false, is_transfer_agent: false, retell_modified_at: '2026-01-01T12:00:00.000Z' }])
  assert.equal(requests.length, 1)
  const [{ url, init, body }] = requests
  assert.equal(url.origin, 'https://api.retellai.com')
  assert.equal(url.pathname, '/v2/list-agents')
  assert.equal(url.searchParams.get('limit'), '1000')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.Authorization, 'Bearer test-key')
  assert.equal(init.redirect, 'error')
  assert.deepEqual(body, { filter_criteria: { channel: { type: 'string', op: 'eq', value: 'voice' } } })
})

test('transfer agents are marked, and only when Retell clearly says so', () => {
  assert.equal(toAgentRow({ agent_id: 'a', is_transfer_agent: true }).is_transfer_agent, true)
  for (const value of [false, undefined, null, 'true', 1]) assert.equal(toAgentRow({ agent_id: 'a', is_transfer_agent: value }).is_transfer_agent, false)
})

test('agent pages are followed with the cursor Retell gives', async () => {
  const { client, requests } = fake(
    reply({ items: [{ agent_id: 'a1', agent_name: 'One' }], has_more: true, pagination_key: 'k1' }),
    reply({ items: [{ agent_id: 'a2', agent_name: 'Two' }], has_more: false }))
  const result = await client.listAgents()
  assert.deepEqual(result.agents.map(agent => agent.retell_agent_id), ['a1', 'a2'])
  assert.equal(requests[0].url.searchParams.get('pagination_key'), null)
  assert.equal(requests[1].url.searchParams.get('pagination_key'), 'k1')
})

test('a cursor that does not move, or is missing, stops the import instead of looping', async () => {
  assert.equal(await failureOf(fake(reply({ items: [], has_more: true, pagination_key: 'k' }), reply({ items: [], has_more: true, pagination_key: 'k' })).client.listAgents()), 'unexpected')
  assert.equal(await failureOf(fake(reply({ items: [], has_more: true })).client.listAgents()), 'unexpected')
})

test('listing calls asks for the newest calls only and keeps just what is needed', async () => {
  const { client, requests } = fake(reply({ has_more: true, pagination_key: 'more', items: [
    { call_id: 'c1', agent_id: 'a1', agent_version: 2, call_status: 'ended', call_type: 'phone_call', direction: 'inbound', from_number: '+441234567890', to_number: '+449876543210',
      start_timestamp: 1767268800000, end_timestamp: 1767269100000, duration_ms: 300000, disconnection_reason: 'user_hangup', transcript: 'hello', recording_url: 'https://x',
      call_cost: { combined_cost: 70.12345, product_costs: [{ product: 'elevenlabs_tts', cost: 60 }], total_duration_seconds: 300 } },
    { call_id: 'c2', agent_id: 'a1', call_status: 'not_connected' }
  ] }))
  const result = await client.listCalls()
  assert.equal(requests[0].url.pathname, '/v3/list-calls')
  assert.deepEqual(requests[0].body, { sort_order: 'descending', limit: maximumCalls })
  assert.equal(result.truncated, true)
  assert.equal(result.skipped, 1) // no start time
  assert.deepEqual(result.calls, [{ retell_call_id: 'c1', retell_agent_id: 'a1', started_at: '2026-01-01T12:00:00.000Z', ended_at: '2026-01-01T12:05:00.000Z',
    call_status: 'ended', call_type: 'phone_call', direction: 'inbound', disconnection_reason: 'user_hangup', agent_version: 2, duration_ms: 300000, cost_cents: 70.1235 }])
  const keys = Object.keys(result.calls[0]).join(' ')
  for (const personal of ['number', 'transcript', 'recording']) assert.ok(!keys.includes(personal))
})

test('bad or odd data is cleaned or skipped, never trusted', () => {
  assert.equal(toAgentRow(null), null)
  assert.equal(toAgentRow({ agent_name: 'No id' }), null)
  assert.equal(toAgentRow({ agent_id: 'a', agent_name: 5 }).name, 'Unnamed agent')
  assert.equal(toAgentRow({ agent_id: 'a', agent_name: 'x'.repeat(500) }).name.length, 200)
  assert.equal(toAgentRow({ agent_id: 'a', user_modified_timestamp: 'soon' }).retell_modified_at, null)
  assert.equal(toCallRow({ call_id: 'c', agent_id: 'a', start_timestamp: 0 }), null)
  assert.equal(toCallRow({ call_id: 'c', start_timestamp: 1767268800000 }), null)
  const odd = toCallRow({ call_id: 'c', agent_id: 'a', start_timestamp: 1767268800000, end_timestamp: 1767268000000, call_type: 'carrier_pigeon', direction: 'sideways', duration_ms: -4, agent_version: 1.5 })
  assert.deepEqual([odd.ended_at, odd.call_type, odd.direction, odd.duration_ms, odd.agent_version, odd.cost_cents], [null, null, null, null, null, null])
  for (const cost of [-1, Infinity, '70', 1e12, null]) assert.equal(toCallRow({ call_id: 'c', agent_id: 'a', start_timestamp: 1767268800000, call_cost: { combined_cost: cost } }).cost_cents, null, String(cost))
  assert.equal(toCallRow({ call_id: 'c', agent_id: 'a', start_timestamp: 1767268800000, call_cost: 'free' }).cost_cents, null)
})

test('Retell problems become clear failures and nothing else', async () => {
  const cases = [[401, 'rejected'], [403, 'rejected'], [429, 'rate'], [500, 'unavailable'], [503, 'unavailable'], [400, 'unexpected'], [404, 'unexpected']]
  for (const [status, failure] of cases) assert.equal(await failureOf(fake(reply({ status: 'error', message: 'x' }, status)).client.listCalls()), failure, String(status))
  assert.equal(await failureOf(fake(new TypeError('network down')).client.listCalls()), 'unavailable')
  assert.equal(await failureOf(fake(new Response('<html>', { status: 200 })).client.listCalls()), 'unexpected')
  assert.equal(await failureOf(fake(reply({ items: 'nope', has_more: false })).client.listCalls()), 'unexpected')
  assert.equal(await failureOf(fake(reply({ items: [] })).client.listCalls()), 'unexpected')
})

test('the key never appears in an error message', async () => {
  try { await fake(reply({}, 401)).client.listCalls() } catch (error) { assert.ok(!String(error.message).includes('test-key')) }
})

test('only three read-only requests exist in the client, and nothing can change Retell', async () => {
  const source = await readFile(new URL('../lib/retell.ts', import.meta.url), 'utf8')
  const paths = new Set(source.match(/\/v\d+\/[a-z-]+/g))
  assert.deepEqual([...paths].sort(), ['/v2/get-call', '/v2/list-agents', '/v3/list-calls'])
  assert.deepEqual([...new Set(source.match(/method:\s*'[A-Z]+'/g))].sort(), ["method: 'GET'", "method: 'POST'"])
  assert.ok(!/PATCH|PUT|DELETE|create-|update-|delete-|publish|webhook|phone-call|batch/i.test(source.replace(/\/\/.*$/gm, '')))
})

test('getting one call sends a single GET with the key and no body', async () => {
  const { client, requests } = fake(reply({ call_id: 'call_abc', call_status: 'ended' }))
  await client.getCall('call_abc')
  assert.equal(requests.length, 1)
  const [{ url, init }] = requests
  assert.equal(url.href, 'https://api.retellai.com/v2/get-call/call_abc')
  assert.equal(init.method, 'GET')
  assert.equal(init.body, undefined)
  assert.equal(init.headers.Authorization, 'Bearer test-key')
  assert.equal(init.headers['Content-Type'], undefined)
  assert.equal(init.redirect, 'error')
})

test('a call id that could change the request address is refused before anything is sent', async () => {
  for (const bad of ['', '../list-calls', 'a/b', 'call?x=1', 'call#x', 'call%2F', 'x'.repeat(129), 'call id']) {
    const { client, requests } = fake()
    assert.equal(await failureOf(client.getCall(bad)), 'missing', bad)
    assert.equal(requests.length, 0)
  }
})

test('a call Retell cannot find is reported as missing', async () => {
  for (const status of [404, 422]) assert.equal(await failureOf(fake(reply({ status: 'error', message: 'Cannot find requested asset' }, status)).client.getCall('call_x')), 'missing')
  assert.equal(await failureOf(fake(reply({}, 401)).client.getCall('call_x')), 'rejected')
  assert.equal(await failureOf(fake(reply([], 200)).client.getCall('call_x')), 'unexpected')
})

test('call details keep the recording link, a timed transcript and the analysis', () => {
  const detail = toCallDetail({
    recording_url: 'https://recordings.example.com/call_x.wav?sig=abc', scrubbed_recording_url: 'https://recordings.example.com/scrubbed.wav',
    transcript: 'Agent: Hello', transcript_object: [
      { role: 'agent', content: ' Hello, how can I help? ', words: [{ word: 'Hello', start: 0.5, end: 0.9 }, { word: 'help', start: 1.8, end: 2.2 }] },
      { role: 'user', content: 'I need an appointment.', words: [{ word: 'I', start: 2.6, end: 2.7 }, { word: 'appointment', start: 3.4, end: 4.1 }] },
      { role: 'transfer_target', content: 'Transferring now.', words: [] },
      { role: 'system', content: 'not a speaker', words: [] }, { role: 'agent', content: '   ', words: [] }, 'junk'],
    call_analysis: { call_summary: 'Caller booked an appointment.', user_sentiment: 'Positive', call_successful: true }
  })
  assert.equal(detail.recordingUrl, 'https://recordings.example.com/call_x.wav?sig=abc')
  assert.deepEqual(detail.transcript, [
    { role: 'agent', text: 'Hello, how can I help?', start: 0.5, end: 2.2 },
    { role: 'user', text: 'I need an appointment.', start: 2.6, end: 4.1 },
    { role: 'transfer_target', text: 'Transferring now.', start: null, end: null }])
  assert.equal(detail.plainTranscript, null)
  assert.deepEqual([detail.summary, detail.sentiment, detail.successful], ['Caller booked an appointment.', 'Positive', true])
})

test('unsafe or odd call details are dropped rather than shown', () => {
  const detail = toCallDetail({ recording_url: 'http://insecure.example.com/a.wav', scrubbed_recording_url: 'javascript:alert(1)', transcript: 'Agent: Hi',
    transcript_object: 'nope', call_analysis: { user_sentiment: 'Ecstatic', call_successful: 'yes' } })
  assert.deepEqual(detail, { recordingUrl: null, transcript: [], plainTranscript: 'Agent: Hi', summary: null, sentiment: null, successful: null })
  assert.equal(toCallDetail({ recording_url: 'https://user:pass@example.com/a.wav' }).recordingUrl, null)
  assert.equal(toCallDetail({ scrubbed_recording_url: 'https://example.com/clean.wav' }).recordingUrl, 'https://example.com/clean.wav')
  assert.deepEqual(toCallDetail(null).transcript, [])
  const backwards = toCallDetail({ transcript_object: [{ role: 'agent', content: 'x', words: [{ start: 5, end: 6 }, { start: 1, end: 2 }] }] }).transcript[0]
  assert.deepEqual([backwards.start, backwards.end], [5, null])
})

test('display helpers handle UK time, lengths and gaps', () => {
  assert.match(formatTime('2026-07-01T12:00:00Z'), /13:00/) // British Summer Time
  assert.match(formatTime('2026-01-01T12:00:00Z'), /12:00/)
  assert.equal(formatTime(null), 'Unknown')
  assert.equal(formatTime('not a date'), 'Unknown')
  assert.equal(formatDuration(300000), '5:00')
  assert.equal(formatDuration(65400), '1:05')
  assert.equal(formatDuration(null), 'Unknown')
  assert.equal(formatDuration(-1), 'Unknown')
  assert.equal(plainWords('user_hangup'), 'user hangup')
  assert.equal(plainWords(null), 'Unknown')
})

// Mirrors how the app saves: one upsert per table that sets every column it sends, run as a signed-in owner.
async function save(db, user, table, conflict, rows) {
  await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${user}'`)
  const saved = []
  try {
    for (const row of rows) {
      const columns = Object.keys(row)
      const result = await db.query(
        `insert into ${table} (${columns.join(',')}) values (${columns.map((_, i) => `$${i + 1}`).join(',')})
         on conflict (${conflict}) do update set ${columns.map(c => `${c}=excluded.${c}`).join(',')} returning id`, Object.values(row))
      saved.push(result.rows[0].id)
    }
  } finally { await db.exec('reset role') }
  return saved
}

test('what the client produces fits the database and can be imported again safely', async () => {
  const { client } = fake(
    reply({ items: [{ agent_id: 'agent_a', agent_name: 'Reception', is_suspended: false, user_modified_timestamp: 1767268800000 }, { agent_id: 'agent_b', agent_name: 'Sales', is_suspended: true }, { agent_id: 'agent_t', agent_name: 'Warm transfer', is_transfer_agent: true }], has_more: false }),
    reply({ has_more: false, items: [
      { call_id: 'call_1', agent_id: 'agent_a', agent_version: 1, call_status: 'ended', call_type: 'phone_call', direction: 'outbound', start_timestamp: 1767268800000, end_timestamp: 1767268860000, duration_ms: 60000, disconnection_reason: 'agent_hangup', call_cost: { combined_cost: 12.5 } },
      { call_id: 'call_2', agent_id: 'agent_b', call_status: 'ongoing', call_type: 'web_call', start_timestamp: 1767269000000 },
      { call_id: 'call_3', agent_id: 'agent_gone', call_status: 'ended', start_timestamp: 1767269000000 }
    ] }))
  const { agents } = await client.listAgents()
  const { calls } = await client.listCalls()
  const db = await createDb()
  try {
    for (let run = 0; run < 2; run++) { // the second run is a re-import
      const agentIds = await save(db, ids.a, 'agents', 'retell_agent_id', agents.map(agent => ({ workspace_id: ids.a, ...agent })))
      const byRetellId = new Map(agents.map((agent, i) => [agent.retell_agent_id, agentIds[i]]))
      const known = calls.filter(call => byRetellId.has(call.retell_agent_id)) // the app skips calls for unknown agents
      assert.equal(known.length, 2)
      await save(db, ids.a, 'calls', 'retell_call_id', known.map(({ retell_agent_id, ...call }) => ({ workspace_id: ids.a, agent_id: byRetellId.get(retell_agent_id), ...call })))
    }
    const stored = await db.query(`select a.name, a.is_suspended, c.call_status, c.call_type, c.direction, c.duration_ms from calls c join agents a on a.id = c.agent_id order by c.retell_call_id`)
    assert.deepEqual(stored.rows.map(r => [r.name, r.is_suspended, r.call_status, r.call_type, r.direction, r.duration_ms]),
      [['Reception', false, 'ended', 'phone_call', 'outbound', 60000], ['Sales', true, 'ongoing', 'web_call', null, null]])
    // Importing twice must not create duplicates.
    assert.equal((await db.query(`select count(*)::int as n from agents where retell_agent_id is not null`)).rows[0].n, 3)
    const visible = await db.query(`select name from agents where retell_agent_id is not null and is_transfer_agent = false order by name`)
    assert.deepEqual(visible.rows.map(row => row.name), ['Reception', 'Sales'])
    assert.equal((await db.query(`select name from agents where is_transfer_agent`)).rows[0].name, 'Warm transfer')
    assert.equal((await db.query(`select count(*)::int as n from calls`)).rows[0].n, 2)
    assert.deepEqual((await db.query(`select cost_cents from calls order by retell_call_id`)).rows.map(r => r.cost_cents === null ? null : Number(r.cost_cents)), [12.5, null], 'the cost is saved through the owner\'s own access')
  } finally { await db.close() }
})

async function sourceFiles(folder = new URL('..', import.meta.url).pathname) {
  const found = []
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'tests', 'supabase'].includes(entry.name)) continue
    const path = join(folder, entry.name)
    if (entry.isDirectory()) found.push(...await sourceFiles(path))
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(path)
  }
  return found
}

test('the Retell key stays on the server and is read in one file', async () => {
  const reading = [], importing = []
  for (const file of await sourceFiles()) {
    const text = await readFile(file, 'utf8')
    if (/process\.env\.RETELL_API_KEY|process\.env\[/.test(text)) reading.push(file) // an actual read, not a mention in a message
    if (/from ['"].*lib\/retell-server['"]/.test(text)) importing.push(file)
    assert.ok(!/NEXT_PUBLIC_[A-Z_]*RETELL/.test(text), `${file} exposes Retell through a public variable`)
    if (/^['"]use client['"]/m.test(text)) assert.ok(!/retell/i.test(text), `${file} is a client component`)
  }
  assert.equal(reading.length, 1)
  assert.match(reading[0], /lib\/retell-server\.ts$/)
  assert.match(await readFile(new URL('../lib/retell-server.ts', import.meta.url), 'utf8'), /^import 'server-only'/)
  assert.deepEqual(importing.map(file => file.split('/app/').pop()).sort(),
    ['(platform)/agents/actions.ts', '(platform)/agents/page.tsx', '(platform)/calls/[id]/recording/route.ts', 'components/CallInsight.tsx'])
})

test('the import checks for an owner before it reads Retell or saves anything', async () => {
  const text = await readFile(new URL('../app/(platform)/agents/actions.ts', import.meta.url), 'utf8')
  const body = text.slice(text.indexOf('export async function importFromRetell'))
  const check = body.indexOf("membership.role !== 'owner'")
  assert.ok(check > 0)
  assert.ok(check < body.indexOf('readRetell()'))
  assert.ok(check < body.indexOf('.upsert('))
  assert.equal((text.match(/export async function/g) ?? []).length, 1)
})

test('transfer agents are hidden by default in the agent list', async () => {
  const page = await readFile(new URL('../app/(platform)/agents/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /if \(!showTransfers\) agentQuery = agentQuery\.eq\('is_transfer_agent', false\)/)
  assert.match(page, /showTransfers = query\.transfers === '1'/)
  assert.match(page, /\/agents\?transfers=1/)
})
