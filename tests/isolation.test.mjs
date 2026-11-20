import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('workspace isolation, member privileges and relational integrity', async () => {
  const db = new PGlite()
  const a='00000000-0000-4000-8000-000000000001'
  const b='00000000-0000-4000-8000-000000000002'
  const viewer='00000000-0000-4000-8000-000000000003'
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;`)
    await db.exec(await readFile(new URL('../supabase/migrations/20261118000100_phase_one.sql',import.meta.url),'utf8'))
    await db.exec(`insert into auth.users values ('${a}'),('${b}'),('${viewer}');
      insert into workspaces values ('${a}','A'),('${b}','B');
      insert into memberships values ('${a}','${a}','owner'),('${b}','${b}','admin'),('${viewer}','${a}','viewer');
      insert into clients values ('${b}','${b}','B client');
      set role anon;`)
    await assert.rejects(db.query('select * from clients'), /permission denied/)
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${a}'`)
    assert.equal((await db.query('select * from workspaces')).rows.length,1)
    assert.equal((await db.query('select * from clients')).rows.length,0)
    await db.exec(`insert into clients(workspace_id,name) values ('${a}','A client')`)
    await assert.rejects(db.exec(`insert into clients(workspace_id,name) values ('${b}','Outside')`), /row-level security/)
    await db.exec(`set request.jwt.claim.sub='${viewer}'`)
    assert.equal((await db.query('select * from memberships')).rows.length,1)
    await assert.rejects(db.exec(`insert into clients(workspace_id,name) values ('${a}','Denied')`), /row-level security/)
    await assert.rejects(db.exec("update memberships set role='owner'"), /permission denied/)
    await db.exec('reset role')
    await assert.rejects(db.exec(`insert into agents(workspace_id,client_id,name) values ('${a}','${b}','Wrong workspace')`), /foreign key/)
  } finally { await db.close() }
})
