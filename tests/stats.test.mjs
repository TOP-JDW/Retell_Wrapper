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
