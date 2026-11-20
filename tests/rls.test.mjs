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

test('only owners write agents and calls, and nobody can delete them', async () => {
  const db = await createDb()
  try {
    const agent = ws => `insert into agents(workspace_id,name,retell_agent_id) values ('${ws}','x','agent_x')`
    const call = ws => `insert into calls(workspace_id,agent_id,retell_call_id,started_at) values ('${ws}','${ws}','call_x',now())`
    await assert.rejects(as(db, b, agent(b)), /row-level security/)
    await assert.rejects(as(db, viewerA, agent(a)), /row-level security/)
    await assert.rejects(as(db, b, call(b)), /row-level security/)
    await assert.rejects(as(db, viewerA, call(a)), /row-level security/)
    for (const user of [b, viewerA]) {
      assert.equal((await as(db, user, `update agents set name='x' returning *`)).rows.length, 0)
      assert.equal((await as(db, user, `update calls set call_status='x' returning *`)).rows.length, 0)
    }
    for (const user of [a, b, viewerA]) {
      for (const table of ['clients', 'agents', 'calls']) await assert.rejects(as(db, user, `delete from ${table}`), /permission denied/)
    }
  } finally { await db.close() }
})

test('owners can import and re-import agents and calls for their own workspace', async () => {
  const db = await createDb()
  try {
    const upsertAgent = (name, suspended) => as(db, a, `insert into agents(workspace_id,name,retell_agent_id,is_suspended,retell_modified_at)
      values ('${a}','${name}','agent_1',${suspended},'2026-01-01') on conflict (retell_agent_id) do update
      set workspace_id=excluded.workspace_id, name=excluded.name, is_suspended=excluded.is_suspended, retell_modified_at=excluded.retell_modified_at returning id`)
    const first = (await upsertAgent('First name', false)).rows[0].id
    const second = (await upsertAgent('New name', true)).rows[0].id
    assert.equal(first, second)
    const stored = (await as(db, a, `select name,is_suspended from agents where retell_agent_id='agent_1'`)).rows
    assert.deepEqual(stored, [{ name: 'New name', is_suspended: true }])

    const upsertCall = status => as(db, a, `insert into calls(workspace_id,agent_id,retell_call_id,started_at,ended_at,call_status,call_type,direction,disconnection_reason,agent_version,duration_ms)
      values ('${a}','${first}','call_1','2026-01-01 10:00','2026-01-01 10:05','${status}','phone_call','inbound','user_hangup',3,300000)
      on conflict (retell_call_id) do update set call_status=excluded.call_status, workspace_id=excluded.workspace_id, agent_id=excluded.agent_id,
      retell_call_id=excluded.retell_call_id, started_at=excluded.started_at, ended_at=excluded.ended_at, call_type=excluded.call_type, direction=excluded.direction,
      disconnection_reason=excluded.disconnection_reason, agent_version=excluded.agent_version, duration_ms=excluded.duration_ms returning id`)
    await upsertCall('ongoing')
    await upsertCall('ended')
    assert.deepEqual((await as(db, a, 'select call_status from calls')).rows, [{ call_status: 'ended' }])
    assert.equal(await rows(db, viewerA, 'select * from calls'), 1)
    assert.equal(await rows(db, b, 'select * from calls'), 0)
  } finally { await db.close() }
})

test('an owner cannot import into, take over or read another workspace', async () => {
  const db = await createDb()
  try {
    await assert.rejects(as(db, a, `insert into agents(workspace_id,name,retell_agent_id) values ('${b}','x','agent_b')`), /row-level security/)
    await db.exec(`insert into agents(workspace_id,name,retell_agent_id) values ('${b}','B only','agent_shared')`)
    // Importing an agent that already belongs to workspace B must fail rather than overwrite it.
    await assert.rejects(as(db, a, `insert into agents(workspace_id,name,retell_agent_id) values ('${a}','Hijack','agent_shared')
      on conflict (retell_agent_id) do update set name=excluded.name, workspace_id=excluded.workspace_id`), /row-level security/)
    assert.equal((await db.query(`select name from agents where retell_agent_id='agent_shared'`)).rows[0].name, 'B only')
    // A call cannot point at another workspace's agent.
    await assert.rejects(as(db, a, `insert into calls(workspace_id,agent_id,retell_call_id,started_at) values ('${a}','${b}','call_cross',now())`), /foreign key/)
    // Moving a row into another workspace is refused.
    await assert.rejects(as(db, a, `update agents set workspace_id='${b}' where id='${a}'`), /row-level security/)
    await assert.rejects(as(db, a, `update agents set id='${ids.newcomer}' where id='${a}'`), /permission denied/)
    await assert.rejects(as(db, a, `update agents set client_id='${a}' where id='${a}'`), /permission denied/)
  } finally { await db.close() }
})

test('imported call data is checked by the database', async () => {
  const db = await createDb()
  try {
    await assert.rejects(as(db, a, `insert into calls(workspace_id,agent_id,retell_call_id,started_at,duration_ms) values ('${a}','${a}','c1',now(),-5)`), /check constraint/)
    await assert.rejects(as(db, a, `insert into calls(workspace_id,agent_id,retell_call_id,started_at,ended_at) values ('${a}','${a}','c2','2026-01-02','2026-01-01')`), /check constraint/)
    await assert.rejects(as(db, a, `insert into calls(workspace_id,agent_id,started_at) values ('${a}','${a}',now())`), /not-null|null value/)
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
