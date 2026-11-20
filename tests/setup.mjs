import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

export const ids = {
  a: '00000000-0000-4000-8000-000000000001', // owner of workspace A
  b: '00000000-0000-4000-8000-000000000002', // admin of workspace B
  viewerA: '00000000-0000-4000-8000-000000000003',
  viewerB: '00000000-0000-4000-8000-000000000004'
}

// Builds a database with a minimal Supabase Auth fixture, every migration applied in order and sample data.
export async function createDb() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;`)
  const folder = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(folder)).filter(name => name.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(file, folder), 'utf8'))
  const { a, b, viewerA, viewerB } = ids
  await db.exec(`insert into auth.users values ('${a}'),('${b}'),('${viewerA}'),('${viewerB}');
    insert into workspaces values ('${a}','A'),('${b}','B');
    insert into memberships values ('${a}','${a}','owner'),('${b}','${b}','admin'),('${viewerA}','${a}','viewer'),('${viewerB}','${b}','viewer');
    insert into clients values ('${a}','${a}','A client'),('${b}','${b}','B client');
    insert into agents(id,workspace_id,name) values ('${a}','${a}','A agent'),('${b}','${b}','B agent');
    insert into branding values ('${a}','A brand');`)
  return db
}

// Runs one statement as a signed-in user (or as anon when user is null) and always returns to the superuser role.
export async function as(db, user, sql) {
  await db.exec('reset role')
  await db.exec(user ? `set role authenticated; set request.jwt.claim.sub='${user}'` : 'set role anon')
  try { return await db.query(sql) } finally { await db.exec('reset role') }
}
