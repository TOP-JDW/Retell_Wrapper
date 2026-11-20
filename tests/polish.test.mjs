import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { compareValues, matchesSearch, nextDirection, sortRows } from '../lib/table.ts'
import { filterQuery, parseCallFilters } from '../lib/filters.ts'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
async function files(dir, found = []) {
  for (const entry of await readdir(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) await files(path, found); else if (/\.tsx?$/.test(entry.name)) found.push(path)
  }
  return found
}

test('tables sort numbers as numbers, text in dictionary order, and empty values last', () => {
  assert.deepEqual(sortRows([10, 9, null, 100], v => v, 'asc'), [9, 10, 100, null])
  assert.deepEqual(sortRows([10, 9, null, 100], v => v, 'desc'), [100, 10, 9, null])
  assert.deepEqual(sortRows(['agent 10', 'Agent 9', '', 'ábc'], v => v, 'asc'), ['ábc', 'Agent 9', 'agent 10', ''])
  assert.deepEqual(sortRows(['2026-11-19T10:00:00Z', '2026-11-20T09:00:00Z'], v => v, 'desc'), ['2026-11-20T09:00:00Z', '2026-11-19T10:00:00Z'])
  const rows = [{ k: 'a', v: 1 }, { k: 'b', v: 1 }, { k: 'c', v: 0 }]
  assert.deepEqual(sortRows(rows, r => r.v, 'desc').map(r => r.k), ['a', 'b', 'c'], 'equal rows keep their order')
  assert.equal(compareValues(undefined, null, 'asc'), 0)
})

test('the first click sorts the natural way, the next click reverses it', () => {
  assert.equal(nextDirection(null, 0, 'asc'), 'asc')
  assert.equal(nextDirection(null, 3, 'desc'), 'desc')
  assert.equal(nextDirection({ column: 3, direction: 'desc' }, 3, 'desc'), 'asc')
  assert.equal(nextDirection({ column: 3, direction: 'asc' }, 3, 'desc'), 'desc')
  assert.equal(nextDirection({ column: 1, direction: 'asc' }, 3, 'desc'), 'desc')
})

test('search finds every typed word anywhere in the row, ignoring case and accents', () => {
  assert.ok(matchesSearch('Appointment booking North42 Active', 'north book'))
  assert.ok(matchesSearch('Café Rouge', 'cafe'))
  assert.ok(matchesSearch('anything', '   '))
  assert.ok(!matchesSearch('Appointment booking', 'booking triage'))
})

test('Call History sorting is read safely from the address bar and kept when paging', () => {
  assert.deepEqual([parseCallFilters({ sort: 'length', dir: 'asc' }).sort, parseCallFilters({ sort: 'length', dir: 'asc' }).dir], ['length', 'asc'])
  for (const bad of ['agent', 'id); drop', 'toString', '__proto__', '']) assert.equal(parseCallFilters({ sort: bad }).sort, 'started', bad)
  assert.equal(parseCallFilters({ dir: 'sideways' }).dir, 'desc')
  assert.equal(filterQuery(parseCallFilters({ sort: 'length', dir: 'desc' }), { page: 2 }), '?sort=length&dir=desc&page=2')
  assert.equal(filterQuery(parseCallFilters({ sort: 'started', dir: 'desc' })), '', 'the default order is not written out')
})

test('calls are only ordered by an allowed column, and the export uses the same order as the page', async () => {
  const calls = await read('lib/calls.ts')
  assert.match(calls, /sortable\.has\(options\.order\.column\) \? options\.order : \{column: 'started_at', ascending: false\}/)
  for (const path of ['app/(platform)/calls/page.tsx', 'app/(platform)/calls/export/route.ts'])
    assert.match(await read(path), /order: \{ ?column: callSorts\[filters\.sort\], ascending: filters\.dir === 'asc' ?\}/, path)
})

test('every table can be sorted and searched, through the shared table component', async () => {
  for (const path of await files('app')) {
    if (path === 'app/components/DataTable.tsx') continue
    assert.ok(!/<table/.test(await read(path)), `${path} builds its own table`)
  }
})

test('every form button shows progress and cannot be pressed twice', async () => {
  for (const path of await files('app')) {
    const text = await read(path)
    for (const form of text.match(/<form action=\{[^}]+\}[\s\S]*?<\/form>/g) ?? [])
      assert.ok(!/<button(?![^>]*type="button")/.test(form), `${path} has a plain submit button: ${form.slice(0, 60)}`)
  }
  const button = await read('app/components/SubmitButton.tsx')
  assert.match(button, /useFormStatus\(\)/)
  assert.match(button, /disabled=\{status\.pending\}/)
})

test('results of actions show as pop-ups that clear the address bar, and problems stay until closed', async () => {
  for (const path of await files('app'))
    assert.ok(!/className="notice success"/.test(await read(path)), `${path} still shows a fixed success bar`)
  const toast = await read('app/components/Toast.tsx')
  assert.match(toast, /const start = \(\) => \{ if \(tone === 'success'\)/)
  assert.match(toast, /window\.history\.replaceState/)
  assert.match(toast, /role=\{tone === 'problem' \? 'alert' : 'status'\}/)
  assert.match(await read('app/components/Flash.tsx'), /randomUUID\(\)/)
})

test('leaving the branding form with unsaved changes asks first', async () => {
  const form = await read('app/components/ClientBrandingForm.tsx')
  assert.match(form, /useUnsavedWarning\(dirty,/)
  assert.match(form, /onSubmit=\{\(\) => setSaving\(true\)\}/)
  const hook = await read('app/components/useUnsavedWarning.ts')
  assert.match(hook, /addEventListener\('beforeunload'/)
  assert.match(hook, /window\.confirm\(message\)/)
})

test('pages show placeholders while they load', async () => {
  for (const path of ['app/(platform)/loading.tsx', 'app/(preview)/preview/[clientId]/loading.tsx'])
    assert.match(await read(path), /<PageSkeleton\/>/, path)
})
