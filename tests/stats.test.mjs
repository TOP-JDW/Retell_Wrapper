import test from 'node:test'
import assert from 'node:assert/strict'
import { createDb, as, ids } from './setup.mjs'

const { a, b, viewerA } = ids

async function seed(db) {
  await db.exec(`insert into agents(id,workspace_id,name) values ('${ids.newcomer}','${a}','Second A agent');
    insert into calls(workspace_id,agent_id,retell_call_id,started_at,call_status,duration_ms) values
      ('${a}','${a}','c1','2026-07-01 09:00+00','ended',60000),
      ('${a}','${a}','c2','2026-07-01 10:00+00','ended',120000),
      ('${a}','${a}','c3','2026-07-01 11:00+00','not_connected',0),
      ('${a}','${ids.newcomer}','c4','2026-07-01 23:30+00','ended',30000),
      ('${a}','${a}','c5','2026-07-03 12:00+00','error',null),
      ('${a}','${a}','c6','2026-06-01 12:00+00','ended',999000),
      ('${b}','${b}','c7','2026-07-01 12:00+00','ended',45000);`)
}
const range = `'2026-06-30 23:00+00','2026-07-04 23:00+00'`

test('daily figures count UK days, connected calls and their talk time, for your workspace only', async () => {
  const db = await createDb()
  try {
    await seed(db)
    const rows = (await as(db, a, `select * from public.call_daily_stats(${range})`)).rows
      .map(r => [r.day.toISOString().slice(0, 10), r.total, r.connected, Number(r.connected_ms), r.timed])
    // 23:30 UTC on 1 July is 00:30 on 2 July in British Summer Time.
    assert.deepEqual(rows, [['2026-07-01', 3, 2, 180000, 2], ['2026-07-02', 1, 1, 30000, 1], ['2026-07-03', 1, 0, 0, 0]])
    const viewerRows = (await as(db, viewerA, `select * from public.call_daily_stats(${range})`)).rows
    assert.equal(viewerRows.length, 3)
    const other = (await as(db, b, `select * from public.call_daily_stats(${range})`)).rows
    assert.deepEqual(other.map(r => r.total), [1])
  } finally { await db.close() }
})

test('agent figures are per agent, busiest first, for your workspace only', async () => {
  const db = await createDb()
  try {
    await seed(db)
    const rows = (await as(db, a, `select * from public.call_agent_stats(${range})`)).rows.map(r => [r.agent_id, r.total, r.connected])
    assert.deepEqual(rows, [[a, 4, 2], [ids.newcomer, 1, 1]])
    assert.equal((await as(db, b, `select * from public.call_agent_stats(${range})`)).rows.length, 1)
  } finally { await db.close() }
})

test('people outside a workspace, and anon, get nothing', async () => {
  const db = await createDb()
  try {
    await seed(db)
    assert.equal((await as(db, '00000000-0000-4000-8000-0000000000ff', `select * from public.call_daily_stats(${range})`)).rows.length, 0)
    await assert.rejects(as(db, null, `select * from public.call_daily_stats(${range})`), /permission denied/)
    await assert.rejects(as(db, null, `select * from public.call_agent_stats(${range})`), /permission denied/)
  } finally { await db.close() }
})

test('one agent\'s daily figures cover only that agent, in UK days, in your workspace', async () => {
  const db = await createDb()
  try {
    await seed(db)
    const rows = (await as(db, a, `select * from public.call_agent_daily_stats('${a}',${range})`)).rows
      .map(r => [r.day.toISOString().slice(0, 10), r.total, r.connected])
    assert.deepEqual(rows, [['2026-07-01', 3, 2], ['2026-07-03', 1, 0]])
    const second = (await as(db, a, `select * from public.call_agent_daily_stats('${ids.newcomer}',${range})`)).rows
    assert.deepEqual(second.map(r => r.day.toISOString().slice(0, 10)), ['2026-07-02'])
    assert.equal((await as(db, a, `select * from public.call_agent_daily_stats('${b}',${range})`)).rows.length, 0)   // another workspace's agent
    assert.equal((await as(db, viewerA, `select * from public.call_agent_daily_stats('${a}',${range})`)).rows.length, 2)
    await assert.rejects(as(db, null, `select * from public.call_agent_daily_stats('${a}',${range})`), /permission denied/)
  } finally { await db.close() }
})

test('dashboard figures leave out transfer agents unless asked', async () => {
  const db = await createDb()
  try {
    await seed(db)
    await db.exec(`update agents set is_transfer_agent = true where id = '${ids.newcomer}'`)
    const days = async extra => (await as(db, a, `select * from public.call_daily_stats(${range}${extra})`)).rows.reduce((n, r) => n + r.total, 0)
    assert.equal(await days(''), 4, 'transfer calls are left out by default')
    assert.equal(await days(', false'), 4)
    assert.equal(await days(', true'), 5, 'and counted when asked')
    const agentsListed = async extra => (await as(db, a, `select * from public.call_agent_stats(${range}${extra})`)).rows.map(r => r.agent_id)
    assert.deepEqual(await agentsListed(''), [a])
    assert.deepEqual((await agentsListed(', true')).sort(), [a, ids.newcomer].sort())
    await assert.rejects(as(db, null, `select * from public.call_daily_stats(${range}, true)`), /permission denied/)
  } finally { await db.close() }
})

test('only owners and admins can turn on recordings for a client, in their own workspace', async () => {
  const db = await createDb()
  try {
    await db.exec(`insert into clients(id,workspace_id,name) values ('${ids.newcomer2}','${a}','Rec client')`)
    const flag = async () => (await db.query(`select recordings_for_client from clients where id = '${ids.newcomer2}'`)).rows[0].recordings_for_client
    assert.equal(await flag(), false, 'off by default')
    await as(db, viewerA, `update clients set recordings_for_client = true where id = '${ids.newcomer2}'`)
    assert.equal(await flag(), false, 'a viewer cannot turn it on')
    await as(db, b, `update clients set recordings_for_client = true where id = '${ids.newcomer2}'`)
    assert.equal(await flag(), false, 'another workspace cannot turn it on')
    await as(db, a, `update clients set recordings_for_client = true where id = '${ids.newcomer2}'`)
    assert.equal(await flag(), true, 'an owner can')
  } finally { await db.close() }
})

test('usage adds up calls, minutes and cost per client, transfer calls included, for your workspace only', async () => {
  const db = await createDb()
  try {
    await seed(db)
    await db.exec(`insert into clients(id,workspace_id,name) values ('${ids.newcomer2}','${a}','Usage client');
      update agents set client_id = '${ids.newcomer2}', is_transfer_agent = true where id = '${ids.newcomer}';
      update calls set cost_cents = 12.5 where retell_call_id in ('c1','c4'); update calls set cost_cents = 20 where retell_call_id = 'c2'`)
    const rows = (await as(db, a, `select * from public.call_usage(${range})`)).rows
      .map(r => [r.client_id, r.total, r.connected, Number(r.duration_ms), Number(r.cost_cents), r.costed])
    assert.deepEqual(rows, [[null, 4, 2, 180000, 32.5, 2], [ids.newcomer2, 1, 1, 30000, 12.5, 1]])
    assert.deepEqual((await as(db, b, `select * from public.call_usage(${range})`)).rows.map(r => r.total), [1])
    await assert.rejects(as(db, null, `select * from public.call_usage(${range})`), /permission denied/)
    await assert.rejects(db.exec(`update calls set cost_cents = -1 where retell_call_id = 'c1'`), /check/)
  } finally { await db.close() }
})

test('busy hours group calls by UK weekday and hour', async () => {
  const db = await createDb()
  try {
    await seed(db)
    const rows = (await as(db, a, `select * from public.call_hour_stats(${range}) order by weekday, hour`)).rows.map(r => [r.weekday, r.hour, r.total])
    // 1 July 2026 is a Wednesday; 09:00 UTC is 10:00 BST. 23:30 UTC on 1 July is 00:30 on Thursday.
    assert.deepEqual(rows, [[3, 10, 1], [3, 11, 1], [3, 12, 1], [4, 0, 1], [5, 13, 1]])
  } finally { await db.close() }
})

test('agent health reports the last call and recent errors, measured from a given moment', async () => {
  const db = await createDb()
  try {
    await seed(db)
    const rows = (await as(db, a, `select * from public.agent_health('2026-07-03 18:00+00') order by agent_id`)).rows
    const mine = rows.find(r => r.agent_id === a)
    assert.equal(mine.last_call_at.toISOString(), '2026-07-03T12:00:00.000Z')
    assert.deepEqual([mine.calls_24h, mine.errors_24h, mine.calls_7d, mine.errors_7d], [1, 1, 4, 1])
    assert.ok(!rows.some(r => r.agent_id === b), 'other workspaces are not shown')
    const earlier = (await as(db, a, `select * from public.agent_health('2026-07-01 10:30+00')`)).rows.find(r => r.agent_id === a)
    assert.equal(earlier.last_call_at.toISOString(), '2026-07-01T10:00:00.000Z', 'later calls are ignored')
  } finally { await db.close() }
})
