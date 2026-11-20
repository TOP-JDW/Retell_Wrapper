import test from 'node:test'
import assert from 'node:assert/strict'
import { score, search } from '../lib/search.ts'

const items = [
  { kind: 'page', label: 'Call History', hint: 'Page', href: '/calls' },
  { kind: 'page', label: 'Client Management', hint: 'Page', href: '/clients' },
  { kind: 'agent', label: 'Acc Man Triage Agent – Client Facing – TESTING', hint: 'Think360', href: '/agents/1' },
  { kind: 'agent', label: 'Transfer Agent for Acc Man Triage Agent – Client Facing – TESTING', hint: 'Transfer agent', href: '/agents/2' },
  { kind: 'client', label: 'Think360', hint: 'Client', href: '/clients/1' },
  { kind: 'client', label: 'Café Rouge', hint: 'Client', href: '/clients/2' }
]

test('every typed word must match, in any order and any case', () => {
  assert.deepEqual(search('triage testing', items).map(i => i.href), ['/agents/1', '/agents/2'])
  assert.deepEqual(search('THINK', items).map(i => i.href), ['/clients/1'])
  assert.deepEqual(search('zzz', items), [])
})

test('names that start with the search come first', () => {
  assert.equal(search('acc', items)[0].href, '/agents/1')
  assert.equal(search('cli', items)[0].href, '/clients')
  assert.ok(score('call', 'Call History') > score('call', 'Recall list'))
})

test('accents do not get in the way', () => {
  assert.deepEqual(search('cafe', items).map(i => i.href), ['/clients/2'])
})

test('an empty search lists pages first, then agents, then clients, up to the limit', () => {
  assert.deepEqual(search('', items).map(i => i.kind), ['page', 'page', 'agent', 'agent', 'client', 'client'])
  assert.equal(search('', items, 3).length, 3)
})
