import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseTheme, themes } from '../lib/theme.ts'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('only light, dark or auto can be chosen; anything else follows the device', () => {
  assert.deepEqual([...themes], ['light', 'dark', 'auto'])
  assert.equal(parseTheme('dark'), 'dark')
  assert.equal(parseTheme('light'), 'light')
  for (const bad of ['auto', 'DARK', '"><script>', undefined, null, 1]) assert.equal(parseTheme(bad), 'auto')
})

test('dark colours apply when chosen or when the device is dark, but never inside a client\'s portal or logos', async () => {
  const css = await read('app/style.css')
  assert.match(css, /:root, \.cp, \.bp-frame, \.logo-tile \{\n  color-scheme: light;/)
  assert.match(css, /:root\[data-theme='dark'\] \{\n  color-scheme: dark;/)
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\n  :root:not\(\[data-theme='light'\]\) \{\n  color-scheme: dark;/)
  assert.match(css, /\.cp, \.bp-frame, \.logo-tile \{ color: var\(--text\); \}/, 'light areas reset the inherited text colour')
  assert.ok(!/\.cp button[ ,]/.test(css), 'the client colour is not put on every button in the preview')
  // Outside the colour sets, surfaces and lines come from the theme, not fixed light colours.
  const rules = css.replace(/\{[^{}]*--[a-z-]+:[^{}]*\}/g, '')
  for (const fixed of ['#FAFBFD', '#F9FBFE', '#EEF1FB', '#F2C4BF'])
    assert.ok(!rules.includes(fixed), fixed)
})

test('the theme is drawn by the server from the cookie, and the switch writes the same cookie', async () => {
  assert.match(await read('app/layout.tsx'), /data-theme=\{theme === 'auto' \? undefined : theme\}/)
  const toggle = await read('app/components/ThemeSwitch.tsx')
  assert.match(toggle, /document\.cookie = `\$\{themeCookie\}=\$\{next\}; path=\/; max-age=31536000; samesite=lax`/)
  assert.match(toggle, /role="radiogroup"/)
})

test('the dashboard leaves out transfer calls unless asked, in its figures and its latest calls', async () => {
  const page = await read('app/(platform)/dashboard/page.tsx')
  assert.match(page, /const transfers = query\.transfers === '1'/)
  assert.match(page, /\.\.\.\(transfers \? \{include_transfers: true\} : \{\}\)/)
  assert.match(page, /\.eq\('is_transfer_agent', false\)/)
  assert.match(page, /latestCalls\(db, membership\.workspace_id, 5, shownAgents\)/)
})

test('in the preview, calls open only when the client\'s recordings setting is on', async () => {
  for (const path of ['app/(preview)/preview/[clientId]/page.tsx', 'app/(preview)/preview/[clientId]/calls/page.tsx'])
    assert.match(await read(path), /link=\{client\.recordings_for_client \? `[^`]+` : false\}/, path)
  const call = await read('app/(preview)/preview/[clientId]/calls/[callId]/page.tsx')
  assert.match(call, /\.eq\('workspace_id', membership\.workspace_id\)\.in\('agent_id', agentIds\)/, 'only this client\'s own calls')
})
