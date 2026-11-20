import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseEmail, parseRole, parseUserId, checkPassword } from '../lib/members.ts'

test('roles are limited to the three known values', () => {
  for (const role of ['owner', 'admin', 'viewer']) assert.equal(parseRole(role), role)
  for (const bad of ['superuser', 'Owner', '', null, undefined, 1, ['owner']]) assert.equal(parseRole(bad), null)
})

test('email addresses are trimmed, lower-cased and checked', () => {
  assert.equal(parseEmail('  Person@Example.COM '), 'person@example.com')
  for (const bad of ['', 'nobody', 'a@b', 'a b@c.com', '@c.com', null, 42, `${'a'.repeat(320)}@x.com`]) assert.equal(parseEmail(bad), null)
})

test('user identifiers must be UUIDs', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  assert.equal(parseUserId(id), id)
  assert.equal(parseUserId(id.toUpperCase()), id)
  for (const bad of ['', 'x', `${id} `, "' or 1=1 --", null, undefined]) assert.equal(parseUserId(bad), null)
})

test('passwords need 12 characters and a matching confirmation', () => {
  assert.equal(checkPassword('short', 'short'), 'short')
  assert.equal(checkPassword('a-long-enough-password', 'a-long-enough-password'), 'ok')
  assert.equal(checkPassword('a-long-enough-password', 'different-password-here'), 'mismatch')
  assert.equal(checkPassword('x'.repeat(1025), 'x'.repeat(1025)), 'long')
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

test('the Supabase secret key stays on the server and inside two files', async () => {
  const files = await sourceFiles()
  const reading = [], importing = []
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    if (text.includes('SUPABASE_SECRET_KEY')) reading.push(file.split('retell_wrapper/').pop().split('/app/../').pop())
    if (/from ['"].*lib\/admin['"]/.test(text)) importing.push(file)
    assert.ok(!/NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE)/.test(text), `${file} exposes a secret through a public variable`)
    if (/^['"]use client['"]/m.test(text)) assert.ok(!text.includes('lib/admin') && !text.includes('SUPABASE_SECRET_KEY'), `${file} is a client component`)
  }
  assert.equal(reading.length, 1)
  assert.match(reading[0], /lib\/admin\.ts$/)
  assert.equal(importing.length, 1)
  assert.match(importing[0], /permissions\/actions\.ts$/)
  assert.match(await readFile(new URL('../lib/admin.ts', import.meta.url), 'utf8'), /^import 'server-only'/)
})

test('every member action starts by requiring an owner', async () => {
  const text = await readFile(new URL('../app/(platform)/permissions/actions.ts', import.meta.url), 'utf8')
  const actions = text.split(/export async function /).slice(1)
  assert.equal(actions.length, 3)
  for (const action of actions) assert.match(action, /await owner\(\)/, action.split('(')[0])
})
