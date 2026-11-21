import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describeActivity } from '../lib/activity-text.ts'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('activity is described in plain sentences, whatever the details hold', () => {
  assert.equal(describeActivity({ action: 'client.renamed', target_name: 'North 42', details: { from: 'North42' } }), 'Renamed client North42 to North 42')
  assert.equal(describeActivity({ action: 'member.role_changed', target_name: 'sam@example.com', details: { from: 'viewer', to: 'admin' } }), 'Changed sam@example.com from Viewer to Admin')
  assert.equal(describeActivity({ action: 'agent.linked', target_name: 'Reception', details: { client: null } }), 'Removed the client from agent Reception')
  assert.equal(describeActivity({ action: 'retell.imported', target_name: null, details: { agents: 4, calls: '<b>x</b>' } }), 'Imported 4 agents and 0 calls from Retell')
  assert.equal(describeActivity({ action: 'client.added', target_name: null, details: null }), 'Added client an item')
  assert.equal(describeActivity({ action: 'something.new', target_name: null, details: {} }), 'something new')
})

test('every staff change is recorded in the activity log', async () => {
  const clients = await read('app/(platform)/clients/actions.ts')
  for (const action of ['client.added', 'client.renamed', 'client.deleted', 'agent.linked', 'client.branding_saved'])
    assert.ok(clients.includes(`action: '${action}'`), action)
  assert.match(clients, /action: on \? 'client\.recordings_on' : 'client\.recordings_off'/)
  const members = await read('app/(platform)/permissions/actions.ts')
  for (const action of ['member.invited', 'member.role_changed', 'member.removed']) assert.ok(members.includes(`action: '${action}'`), action)
  assert.ok((await read('app/(platform)/agents/actions.ts')).includes("action: 'retell.imported'"))
  // Logged through the person's own access, so the database records who did it. Never with the secret key.
  assert.ok(!(await read('lib/activity.ts')).includes('admin'))
})

test('the activity page is for owners and admins, and its filter only accepts known kinds', async () => {
  const page = await read('app/(platform)/activity/page.tsx')
  assert.match(page, /if \(membership\.role !== 'owner' && membership\.role !== 'admin'\) return/)
  assert.match(page, /kinds\.some\(\(\[key\]\) => key && key === raw\)/)
  assert.match(page, /\.eq\('workspace_id', membership\.workspace_id\)/)
})

test('the call page offers newer and older calls in this workspace, with a safely quoted time', async () => {
  const page = await read('app/(platform)/calls/[id]/page.tsx')
  assert.equal(page.split(".eq('workspace_id', membership.workspace_id)\n      .or(").length - 1, 2)
  assert.match(page, /started_at\.gt\."\$\{at\}"/)
  assert.match(page, /started_at\.lt\."\$\{at\}"/)
})

test('player shortcuts never fire while typing, and speed is remembered only on this browser', async () => {
  const nav = await read('app/components/CallNav.tsx')
  assert.match(nav, /closest\('input, textarea, select, \[contenteditable="true"\]'\)/)
  const player = await read('app/components/CallPlayer.tsx')
  assert.match(player, /if \(typing\(event\)\) return/)
  assert.match(player, /try \{ localStorage\.setItem\(speedKey, String\(next\)\) \} catch \{\}/)
  assert.match(player, /const speeds = \[1, 1\.25, 1\.5, 2\] as const/)
})

test('the setup checklist shows only to owners and admins, until every step is done', async () => {
  const page = await read('app/(platform)/clients/[id]/page.tsx')
  assert.match(page, /\{isStaff && doneCount < steps\.length && <section/)
  assert.match(page, /\.in\('action', \['client\.recordings_on', 'client\.recordings_off'\]\)/)
})
