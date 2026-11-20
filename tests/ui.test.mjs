import test from 'node:test'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { callTone, roleTone, capitalise } from '../lib/status.ts'

test('each call state gets a fitting colour, and unknown states stay neutral', () => {
  assert.equal(callTone('ended'), 'ok')
  assert.equal(callTone('ongoing'), 'info')
  assert.equal(callTone('error'), 'bad')
  assert.equal(callTone('not_connected'), 'warn')
  for (const other of ['registered', 'something_new', null, undefined]) assert.equal(callTone(other), 'neutral')
})

test('roles get distinct colours and readable names', () => {
  assert.deepEqual(['owner', 'admin', 'viewer'].map(roleTone), ['brand', 'info', 'neutral'])
  assert.equal(capitalise('owner'), 'Owner')
  assert.equal(capitalise(''), '')
})

test('the brand assets the screens use are in the repo', async () => {
  for (const file of ['../public/brand/logo.png', '../public/brand/logo-reverse.png', '../app/icon.png'])
    await access(new URL(file, import.meta.url))
})
