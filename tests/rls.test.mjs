import test from 'node:test'
import assert from 'node:assert/strict'
import { createDb, as, ids } from './setup.mjs'

const { a, b, viewerA, viewerB } = ids
const rows = async (db, user, sql) => (await as(db, user, sql)).rows.length

test('only owners see the member directory; everyone else sees their own row', async () => {
  const db = await createDb()
  try {
    assert.equal(await rows(db, a, 'select * from memberships'), 2)
    assert.equal(await rows(db, b, 'select * from memberships'), 1)
    assert.equal(await rows(db, viewerA, 'select * from memberships'), 1)
    assert.equal(await rows(db, viewerB, 'select * from memberships'), 1)
  } finally { await db.close() }
})

test('every table is invisible to anon and to users outside any workspace', async () => {
  const db = await createDb()
  try {
    for (const table of ['workspaces', 'memberships', 'clients', 'agents', 'calls', 'branding'])
      await assert.rejects(as(db, null, `select * from ${table}`), /permission denied/)
    assert.equal(await rows(db, '00000000-0000-4000-8000-0000000000ff', 'select * from clients'), 0)
    assert.equal(await rows(db, '00000000-0000-4000-8000-0000000000ff', 'select * from workspaces'), 0)
  } finally { await db.close() }
})

test('admins write clients in their own workspace only', async () => {
  const db = await createDb()
  try {
    assert.equal((await as(db, a, `update clients set name='Renamed' where workspace_id='${a}' returning *`)).rows.length, 1)
    assert.equal((await as(db, a, `update clients set name='Hijack' where workspace_id='${b}' returning *`)).rows.length, 0)
    assert.equal((await as(db, b, `update clients set name='Renamed' where workspace_id='${b}' returning *`)).rows.length, 1)
    await assert.rejects(as(db, b, `update clients set workspace_id='${a}' returning *`), /row-level security/)
    await assert.rejects(as(db, b, `insert into clients(workspace_id,name) values ('${a}','Outside')`), /row-level security/)
  } finally { await db.close() }
})

test('only owners write branding, and only in their own workspace', async () => {
  const db = await createDb()
  try {
    assert.equal((await as(db, a, `update branding set display_name='New' returning *`)).rows.length, 1)
    await assert.rejects(as(db, a, `update branding set accent_colour='red'`), /check constraint/)
    await assert.rejects(as(db, a, `insert into branding values ('${b}','Outside')`), /row-level security/)
    // Workspace B has an admin but no owner, so nobody there can create branding through the application.
    await assert.rejects(as(db, b, `insert into branding values ('${b}','B brand')`), /row-level security/)
    assert.equal((await as(db, b, `update branding set display_name='x' returning *`)).rows.length, 0)
  } finally { await db.close() }
})

test('viewers can read workspace data but never write it', async () => {
  const db = await createDb()
  try {
    assert.equal(await rows(db, viewerA, 'select * from clients'), 1)
    assert.equal(await rows(db, viewerA, 'select * from branding'), 1)
    assert.equal(await rows(db, viewerA, 'select * from agents'), 1)
    assert.equal((await as(db, viewerA, `update clients set name='x' returning *`)).rows.length, 0)
    assert.equal((await as(db, viewerA, `update branding set display_name='x' returning *`)).rows.length, 0)
    await assert.rejects(as(db, viewerA, `insert into branding values ('${a}','x')`), /row-level security|duplicate key/)
  } finally { await db.close() }
})

test('agents and calls are read-only for application users, and nobody can delete', async () => {
  const db = await createDb()
  try {
    for (const user of [a, b, viewerA]) {
      await assert.rejects(as(db, user, `insert into agents(workspace_id,name) values ('${a}','x')`), /permission denied/)
      await assert.rejects(as(db, user, `insert into calls(workspace_id,agent_id,retell_call_id,started_at) values ('${a}','${a}','c',now())`), /permission denied/)
      await assert.rejects(as(db, user, 'delete from clients'), /permission denied/)
    }
  } finally { await db.close() }
})

test('only owners add, change and remove members, and only in their own workspace', async () => {
  const db = await createDb()
  try {
    const add = (user, ws, who, role = 'viewer') => as(db, user, `insert into memberships(user_id,workspace_id,role) values ('${who}','${ws}','${role}')`)
    for (const user of [b, viewerA]) await assert.rejects(add(user, user === b ? b : a, ids.newcomer), /row-level security/)
    await assert.rejects(add(a, b, ids.newcomer), /row-level security/)
    await add(a, a, ids.newcomer, 'admin')
    assert.equal((await as(db, a, `select email, role from memberships where user_id='${ids.newcomer}'`)).rows[0].email, 'new@example.com')

    assert.equal((await as(db, a, `update memberships set role='viewer' where user_id='${ids.newcomer}' returning *`)).rows.length, 1)
    for (const user of [b, viewerA])
      assert.equal((await as(db, user, `update memberships set role='owner' where user_id='${ids.newcomer}' returning *`)).rows.length, 0)
    assert.equal((await as(db, a, `update memberships set role='viewer' where user_id='${viewerB}' returning *`)).rows.length, 0)

    for (const user of [b, viewerA])
      assert.equal((await as(db, user, `delete from memberships where user_id='${ids.newcomer}' returning *`)).rows.length, 0)
    assert.equal((await as(db, a, `delete from memberships where user_id='${viewerB}' returning *`)).rows.length, 0)
    assert.equal((await as(db, a, `delete from memberships where user_id='${ids.newcomer}' returning *`)).rows.length, 1)
  } finally { await db.close() }
})

test('members cannot be moved, re-pointed or given a chosen email', async () => {
  const db = await createDb()
  try {
    await assert.rejects(as(db, a, `update memberships set workspace_id='${b}' where user_id='${viewerA}'`), /permission denied/)
    await assert.rejects(as(db, a, `update memberships set user_id='${ids.newcomer}' where user_id='${viewerA}'`), /permission denied/)
    await assert.rejects(as(db, a, `update memberships set email='x@example.com' where user_id='${viewerA}'`), /permission denied/)
    await assert.rejects(as(db, a, `insert into memberships(user_id,workspace_id,role,email) values ('${ids.newcomer}','${a}','viewer','forged@example.com')`), /permission denied/)
    await assert.rejects(as(db, a, `update memberships set role='superuser' where user_id='${viewerA}'`), /check constraint/)
  } finally { await db.close() }
})

test('a workspace always keeps an owner', async () => {
  const db = await createDb()
  try {
    await assert.rejects(as(db, a, `update memberships set role='admin' where user_id='${a}'`), /at least one owner/)
    await assert.rejects(as(db, a, `delete from memberships where user_id='${a}'`), /at least one owner/)
    await db.exec(`insert into memberships(user_id,workspace_id,role) values ('${ids.newcomer}','${a}','owner')`)
    // With a second owner, either can step down, but not both.
    assert.equal((await as(db, a, `update memberships set role='admin' where user_id='${a}' returning *`)).rows.length, 1)
    await assert.rejects(as(db, ids.newcomer, `delete from memberships where user_id='${ids.newcomer}'`), /at least one owner/)
    // The guard also holds when the account itself is removed.
    await assert.rejects(db.exec(`delete from auth.users where id='${ids.newcomer}'`), /foreign key|at least one owner/)
  } finally { await db.close() }
})

test('foreign keys keep agents, calls and clients within one workspace', async () => {
  const db = await createDb()
  try {
    await assert.rejects(db.exec(`insert into calls(workspace_id,agent_id,retell_call_id,started_at) values ('${a}','${b}','x',now())`), /foreign key/)
    await assert.rejects(db.exec(`insert into agents(workspace_id,client_id,name) values ('${a}','${b}','x')`), /foreign key/)
    await assert.rejects(db.exec(`insert into calls(workspace_id,agent_id,retell_call_id,started_at,ended_at) values ('${a}','${a}','y','2026-01-02','2026-01-01')`), /check constraint/)
    await db.exec(`insert into calls(workspace_id,agent_id,retell_call_id,started_at) values ('${a}','${a}','ok',now())`)
  } finally { await db.close() }
})

test('the role lookup function is not callable by anon', async () => {
  const db = await createDb()
  try {
    await assert.rejects(as(db, null, `select private.workspace_role('${a}')`), /permission denied/)
    assert.equal((await as(db, a, `select private.workspace_role('${b}') as role`)).rows[0].role, null)
    assert.equal((await as(db, a, `select private.workspace_role('${a}') as role`)).rows[0].role, 'owner')
  } finally { await db.close() }
})

test('composite foreign keys are indexed', async () => {
  const db = await createDb()
  try {
    const { rows } = await db.query(`select indexname from pg_indexes where schemaname='public' and indexname in ('calls_workspace_agent','agents_workspace_client')`)
    assert.equal(rows.length, 2)
  } finally { await db.close() }
})
