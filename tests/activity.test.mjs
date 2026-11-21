import test from 'node:test'
import assert from 'node:assert/strict'
import { createDb, as, ids } from './setup.mjs'

const { a, b, viewerA } = ids
const add = (who, ws, extra = '') => `insert into activity_log(workspace_id, action, target_type, target_name${extra ? ', details' : ''}) values ('${ws}', 'client.renamed', 'client', 'North42'${extra})`

test('owners and admins record activity; the database fills in who and when', async () => {
  const db = await createDb()
  try {
    await as(db, a, add(a, a))
    const row = (await db.query(`select actor_id, actor_email, created_at from activity_log`)).rows[0]
    assert.equal(row.actor_id, a)
    assert.equal(row.actor_email, 'a@example.com')
    assert.ok(Date.now() - row.created_at.getTime() < 60000)
  } finally { await db.close() }
})

test('nobody can pretend to be someone else, backdate, edit or delete a row', async () => {
  const db = await createDb()
  try {
    await assert.rejects(as(db, a, `insert into activity_log(workspace_id, action, actor_id) values ('${a}', 'client.renamed', '${b}')`), /permission denied/)
    await assert.rejects(as(db, a, `insert into activity_log(workspace_id, action, created_at) values ('${a}', 'client.renamed', '2020-01-01')`), /permission denied/)
    await assert.rejects(as(db, a, `insert into activity_log(workspace_id, action, actor_email) values ('${a}', 'client.renamed', 'boss@example.com')`), /permission denied/)
    await as(db, a, add(a, a))
    await assert.rejects(as(db, a, `update activity_log set action = 'client.deleted'`), /permission denied/)
    await assert.rejects(as(db, a, `delete from activity_log`), /permission denied/)
  } finally { await db.close() }
})

test('viewers and other workspaces can neither read nor write a workspace\'s activity', async () => {
  const db = await createDb()
  try {
    await as(db, a, add(a, a))
    await assert.rejects(as(db, viewerA, add(viewerA, a)), /row-level security/)
    await assert.rejects(as(db, b, add(b, a)), /row-level security/)
    assert.equal((await as(db, viewerA, `select * from activity_log`)).rows.length, 0)
    assert.equal((await as(db, b, `select * from activity_log`)).rows.length, 0)
    assert.equal((await as(db, a, `select * from activity_log`)).rows.length, 1)
    await assert.rejects(as(db, null, `select * from activity_log`), /permission denied/)
  } finally { await db.close() }
})

test('actions and details are kept small and well formed', async () => {
  const db = await createDb()
  try {
    await assert.rejects(as(db, a, `insert into activity_log(workspace_id, action) values ('${a}', 'DROP TABLE')`), /check/)
    await assert.rejects(as(db, a, add(a, a, `, '[1,2]'`)), /check/)
    await assert.rejects(as(db, a, add(a, a, `, '{"x": "${'y'.repeat(5000)}"}'`)), /check/)
  } finally { await db.close() }
})
