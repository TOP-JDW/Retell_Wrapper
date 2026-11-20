import test from 'node:test'
import assert from 'node:assert/strict'
import { createDb, as, ids } from './setup.mjs'
import { checkLogo, contrast, logoUrl, maximumLogoBytes, parseAccent, parseDisplayName, sniffLogo, svgIsSafe, textOn } from '../lib/branding.ts'

const { a, b, viewerA } = ids
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const svg = s => new TextEncoder().encode(s)

async function withClients(db) {
  const mine = (await as(db, a, `insert into clients(workspace_id,name) values ('${a}','Bright Smile') returning id`)).rows[0].id
  const theirs = (await as(db, b, `insert into clients(workspace_id,name) values ('${b}','Harbour') returning id`)).rows[0].id
  return { mine, theirs }
}
const save = (db, user, ws, client, extra = '') =>
  as(db, user, `insert into client_branding(client_id,workspace_id,display_name,accent_colour${extra ? ',logo_mime,logo_base64' : ''})
    values ('${client}','${ws}','Bright Smile Dental','#0E7C66'${extra}) on conflict (client_id) do update set display_name=excluded.display_name, accent_colour=excluded.accent_colour returning *`)

test('owners and admins set branding for their own clients; viewers and other workspaces cannot', async () => {
  const db = await createDb()
  try {
    const { mine, theirs } = await withClients(db)
    assert.equal((await save(db, a, a, mine)).rows.length, 1)
    assert.equal((await save(db, b, b, theirs)).rows.length, 1)
    await assert.rejects(save(db, viewerA, a, mine), /row-level security/)
    await assert.rejects(save(db, a, b, theirs), /row-level security/)
    await assert.rejects(save(db, a, a, theirs), /foreign key|row-level security/)   // another workspace's client
    assert.equal((await as(db, viewerA, 'select * from client_branding')).rows.length, 1)   // viewers can see their own
    assert.equal((await as(db, b, 'select * from client_branding')).rows.length, 1)
    assert.equal((await as(db, viewerA, `update client_branding set accent_colour='#000000' returning *`)).rows.length, 0)
    await assert.rejects(as(db, a, `update client_branding set workspace_id='${b}'`), /permission denied/)
    await assert.rejects(as(db, a, `delete from client_branding`), /permission denied/)
    await assert.rejects(as(db, null, `select * from client_branding`), /permission denied/)
  } finally { await db.close() }
})

test('branding goes when its client is deleted', async () => {
  const db = await createDb()
  try {
    const { mine } = await withClients(db)
    await save(db, a, a, mine)
    await as(db, a, `delete from clients where id='${mine}'`)
    assert.equal((await db.query('select count(*)::int as n from client_branding')).rows[0].n, 0)
  } finally { await db.close() }
})

test('the database refuses bad colours, names and logos', async () => {
  const db = await createDb()
  try {
    const { mine } = await withClients(db)
    const raw = (cols, vals) => as(db, a, `insert into client_branding(client_id,workspace_id,${cols}) values ('${mine}','${a}',${vals})`)
    await assert.rejects(raw('display_name,accent_colour', `'X','red'`), /check constraint/)
    await assert.rejects(raw('display_name,accent_colour', `'X','#0e7c66'`), /check constraint/)  // stored upper case only
    await assert.rejects(raw('display_name', `'   '`), /check constraint/)
    await assert.rejects(raw('display_name,logo_mime,logo_base64', `'X','image/gif','AAAA'`), /check constraint/)
    await assert.rejects(raw('display_name,logo_mime', `'X','image/png'`), /check constraint/)          // type without data
    await assert.rejects(raw('display_name,logo_mime,logo_base64', `'X','image/png','not base64!'`), /check constraint/)
    await raw('display_name,logo_mime,logo_base64', `'X','image/png','iVBORw0KGgo='`)
  } finally { await db.close() }
})

test('colours and names from the form are checked', () => {
  assert.equal(parseAccent(' #0e7c66 '), '#0E7C66')
  for (const bad of ['0E7C66', '#0E7C6', '#GGGGGG', 'red', null]) assert.equal(parseAccent(bad), null)
  assert.equal(parseDisplayName('  Bright   Smile  '), 'Bright Smile')
  for (const bad of ['', '  ', null, 'x'.repeat(81)]) assert.equal(parseDisplayName(bad), null)
})

test('logos are judged by their content, not their name', () => {
  assert.equal(sniffLogo(png), 'image/png')
  assert.equal(sniffLogo(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(sniffLogo(svg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'image/svg+xml')
  assert.equal(sniffLogo(svg('GIF89a')), null)
  assert.equal(sniffLogo(svg('<html><svg></svg></html>')), null)
  const ok = checkLogo(png)
  assert.equal(ok.ok, true)
  assert.equal(ok.base64, Buffer.from(png).toString('base64'))
  assert.deepEqual(checkLogo(new Uint8Array(maximumLogoBytes + 1).fill(0x89)), { ok: false, problem: 'logo_size' })
  assert.deepEqual(checkLogo(new Uint8Array()), { ok: false, problem: 'logo_size' })
  assert.deepEqual(checkLogo(svg('just text')), { ok: false, problem: 'logo_type' })
})

test('SVG logos with scripts, events or outside links are refused', () => {
  assert.equal(svgIsSafe('<svg><circle r="4" fill="#0E7C66"/></svg>'), true)
  for (const bad of ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"></svg>', '<svg><a href="javascript:x()"/></svg>',
    '<svg><image href="https://example.com/t.png"/></svg>', '<svg><foreignObject></foreignObject></svg>', '<!DOCTYPE x [<!ENTITY a "b">]><svg/>'])
    assert.equal(svgIsSafe(bad), false, bad)
  assert.deepEqual(checkLogo(svg('<svg onload="x()"></svg>')), { ok: false, problem: 'logo_unsafe' })
})

test('button text stays readable on any client colour', () => {
  assert.equal(textOn('#2D3C97'), '#FFFFFF')
  assert.equal(textOn('#57C1E8'), '#091B2D')
  assert.equal(textOn('#FFD400'), '#091B2D')
  assert.ok(contrast('#000000', '#FFFFFF') > 20)
  assert.equal(logoUrl('image/png', 'AAAA'), 'data:image/png;base64,AAAA')
  assert.equal(logoUrl(null, 'AAAA'), null)
})

// Regression: the first version saved with an upsert, which asks for update permission on the client and
// workspace fields too. Postgres checks that before it knows whether a row exists, so every save failed.
import { readFile } from 'node:fs/promises'
import { brandingUpdateFields } from '../lib/branding.ts'

test('saving twice the way the app saves works: insert first, then update only the allowed fields', async () => {
  const db = await createDb()
  try {
    const { mine } = await withClients(db)
    const asOwner = async (sql, params) => {
      await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${a}'`)
      try { return await db.query(sql, params) } finally { await db.exec('reset role') }
    }
    await asOwner(`insert into client_branding(client_id,workspace_id,display_name,accent_colour) values ($1,$2,'Test Dental','#2D3C97')`, [mine, a])
    const values = { display_name: 'Test Dental Care', accent_colour: '#0E7C66', logo_mime: 'image/png', logo_base64: 'iVBORw0KGgo=', updated_at: new Date().toISOString() }
    const fields = [...brandingUpdateFields]
    const result = await asOwner(`update client_branding set ${fields.map((f, i) => `${f}=$${i + 1}`).join(',')} where client_id=$${fields.length + 1} returning *`,
      [...fields.map(f => values[f]), mine])
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].display_name, 'Test Dental Care')
    assert.equal(result.rows[0].workspace_id, a)
  } finally { await db.close() }
})

test('the database refuses an upsert on branding, which is why the app must not use one', async () => {
  const db = await createDb()
  try {
    const { mine } = await withClients(db)
    await save(db, a, a, mine)
    await assert.rejects(as(db, a, `insert into client_branding(client_id,workspace_id,display_name,accent_colour) values ('${mine}','${a}','Again','#0E7C66')
      on conflict (client_id) do update set client_id=excluded.client_id, workspace_id=excluded.workspace_id, display_name=excluded.display_name`), /permission denied/)
  } finally { await db.close() }
})

test('the branding save inserts or updates, and never upserts', async () => {
  const text = await readFile(new URL('../app/(platform)/clients/actions.ts', import.meta.url), 'utf8')
  const save = text.slice(text.indexOf('export async function saveClientBranding'))
  assert.ok(!save.includes('.upsert('), 'saveClientBranding must not upsert')
  assert.match(save, /\.insert\(/)
  assert.match(save, /\.update\(/)
})

// Any upsert sets every field it sends, so it needs update permission on all of them. The only upserts allowed
// are the Retell import ones, whose exact SQL is exercised against the database in tests/retell.test.mjs.
test('no new upserts without a database test for them', async () => {
  const { readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const found = []
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (['node_modules', '.next', '.git', 'tests', 'supabase', 'public'].includes(entry.name)) continue
      const path = join(folder, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (/\.(ts|tsx)$/.test(entry.name)) for (const m of (await readFile(path, 'utf8')).matchAll(/from\('([a-z_]+)'\)\.upsert\(/g)) found.push(m[1])
    }
  }
  await walk(new URL('..', import.meta.url).pathname)
  assert.deepEqual(found.sort(), ['agents', 'calls'])
})
