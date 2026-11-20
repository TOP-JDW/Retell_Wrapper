import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createDb, as, ids } from './setup.mjs'
import { parseClientName, parseId } from '../lib/clients.ts'

const { a, b, viewerA } = ids
const one = async (db, user, sql) => (await as(db, user, sql)).rows

test('owners and admins add, rename and delete clients in their own workspace; viewers cannot', async () => {
  const db = await createDb()
  try {
    await as(db, a, `insert into clients(workspace_id,name) values ('${a}','Dental practice')`)
    await as(db, b, `insert into clients(workspace_id,name) values ('${b}','Garage')`)
    await assert.rejects(as(db, viewerA, `insert into clients(workspace_id,name) values ('${a}','Nope')`), /row-level security/)
    await assert.rejects(as(db, a, `insert into clients(workspace_id,name) values ('${b}','Outside')`), /row-level security/)

    assert.equal((await one(db, a, `update clients set name='Dental surgery' where name='Dental practice' returning *`)).length, 1)
    assert.equal((await one(db, viewerA, `update clients set name='x' returning *`)).length, 0)
    assert.equal((await one(db, a, `update clients set name='x' where name='Garage' returning *`)).length, 0)

    assert.equal((await one(db, viewerA, `delete from clients returning *`)).length, 0)
    assert.equal((await one(db, a, `delete from clients where name='Garage' returning *`)).length, 0)
    assert.equal((await one(db, b, `delete from clients where name='Garage' returning *`)).length, 1)
    assert.equal((await one(db, a, `delete from clients where name='Dental surgery' returning *`)).length, 1)
  } finally { await db.close() }
})

test('deleting a client keeps its agents and calls, and only unlinks the agents', async () => {
  const db = await createDb()
  try {
    const client = (await one(db, a, `insert into clients(workspace_id,name) values ('${a}','Dental practice') returning id`))[0].id
    await as(db, a, `select public.set_agent_client('${a}','${client}')`)
    await db.exec(`insert into calls(workspace_id,agent_id,retell_call_id,started_at) values ('${a}','${a}','call_1',now())`)
    assert.equal((await db.query(`select client_id from agents where id='${a}'`)).rows[0].client_id, client)
    // An admin deletes the client even though admins cannot edit agents directly.
    await db.exec(`insert into memberships(user_id,workspace_id,role) values ('${ids.newcomer}','${a}','admin')`)
    assert.equal((await one(db, ids.newcomer, `delete from clients where id='${client}' returning *`)).length, 1)
    const agent = (await db.query(`select workspace_id, client_id, name from agents where id='${a}'`)).rows[0]
    assert.deepEqual(agent, { workspace_id: a, client_id: null, name: 'A agent' })
    assert.equal((await db.query(`select count(*)::int as n from calls where agent_id='${a}'`)).rows[0].n, 1)
  } finally { await db.close() }
})

test('client names are required, not too long, and unique within a workspace', async () => {
  const db = await createDb()
  try {
    await as(db, a, `insert into clients(workspace_id,name) values ('${a}','Dental practice')`)
    await assert.rejects(as(db, a, `insert into clients(workspace_id,name) values ('${a}','  dental PRACTICE ')`), /duplicate key|unique/)
    await assert.rejects(as(db, a, `insert into clients(workspace_id,name) values ('${a}','   ')`), /check constraint/)
    await assert.rejects(as(db, a, `insert into clients(workspace_id,name) values ('${a}','${'x'.repeat(121)}')`), /check constraint/)
    // The same name may exist in another workspace.
    await as(db, b, `insert into clients(workspace_id,name) values ('${b}','Dental practice')`)
  } finally { await db.close() }
})

test('only owners and admins link agents, and only to clients in their own workspace', async () => {
  const db = await createDb()
  try {
    const mine = (await one(db, a, `insert into clients(workspace_id,name) values ('${a}','Mine') returning id`))[0].id
    const theirs = (await one(db, b, `insert into clients(workspace_id,name) values ('${b}','Theirs') returning id`))[0].id
    const link = (user, agent, client) => as(db, user, `select public.set_agent_client('${agent}',${client ? `'${client}'` : 'null'})`)
    await link(a, a, mine)
    assert.equal((await db.query(`select client_id from agents where id='${a}'`)).rows[0].client_id, mine)
    await link(a, a, null)
    assert.equal((await db.query(`select client_id from agents where id='${a}'`)).rows[0].client_id, null)
    await assert.rejects(link(viewerA, a, mine), /Agent not found/)
    await assert.rejects(link(a, b, mine), /Agent not found/)       // another workspace's agent
    await assert.rejects(link(a, a, theirs), /Client not found/)    // another workspace's client
    await assert.rejects(link(a, '00000000-0000-4000-8000-0000000000aa', null), /Agent not found/)
    await assert.rejects(as(db, null, `select public.set_agent_client('${a}',null)`), /permission denied/)
    // Admins still cannot change anything else about an agent.
    await assert.rejects(as(db, b, `update agents set client_id='${theirs}' where id='${b}'`), /permission denied/)
    await assert.rejects(as(db, b, `delete from agents`), /permission denied/)
  } finally { await db.close() }
})

test('client names and ids from forms are checked before use', () => {
  assert.equal(parseClientName('  Dental   practice  '), 'Dental practice')
  for (const bad of ['', '   ', null, undefined, 5, 'x'.repeat(121)]) assert.equal(parseClientName(bad), null)
  assert.equal(parseClientName('x'.repeat(120)).length, 120)
  const id = '00000000-0000-4000-8000-000000000001'
  assert.equal(parseId(id), id)
  for (const bad of ['', 'abc', `${id}'`, null]) assert.equal(parseId(bad), null)
})

test('every client action checks for an owner or admin before touching data', async () => {
  const text = await readFile(new URL('../app/(platform)/clients/actions.ts', import.meta.url), 'utf8')
  const actions = text.split(/export async function /).slice(1)
  assert.equal(actions.length, 5)
  for (const action of actions) assert.match(action, /await staff\(\)/, action.split('(')[0])
})
