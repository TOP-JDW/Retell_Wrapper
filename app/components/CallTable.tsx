import Link from 'next/link'
import type { CallListRow } from '../../lib/calls'
import { formatDuration, formatTime, plainWords } from '../../lib/format'
import { callTone, capitalise } from '../../lib/status'
import { DataTable, type Cell, type Column } from './DataTable'

export type CallColumn = 'started' | 'agent' | 'client' | 'status' | 'type' | 'length' | 'ended'
type ServerSort = { asc: string; desc: string; active?: 'asc' | 'desc' }

const typeOf = (call: CallListRow) => call.call_type === 'web_call' ? 'Web' : call.direction ? capitalise(plainWords(call.direction)) : 'Unknown'

// The calls table used across the app. With server, the columns it names sort every page through
// the address bar, and the others cannot be sorted (sorting one page would mislead).
export function CallTable({ calls, columns, label = 'Calls', link = true, server, searchHint }: {
  calls: CallListRow[]; columns: CallColumn[]; label?: string; link?: boolean
  server?: Partial<Record<CallColumn, ServerSort>>; searchHint?: string
}) {
  const heads: Record<CallColumn, Column> = {
    started: { label: 'Started', first: 'desc' }, agent: { label: 'Agent' }, client: { label: 'Client' }, status: { label: 'Status' },
    type: { label: 'Type' }, length: { label: 'Length', className: 'num', first: 'desc' }, ended: { label: 'Ended because' }
  }
  const cell = (call: CallListRow, column: CallColumn): Cell => {
    switch (column) {
      case 'started': return { value: call.started_at, text: formatTime(call.started_at),
        content: link ? <Link className="row-link" href={`/calls/${call.id}`}>{formatTime(call.started_at)}</Link> : formatTime(call.started_at) }
      case 'agent': return { value: call.agent_name, className: 'primary-cell', content: call.agent_name }
      case 'client': return { value: call.client_name, text: call.client_name ?? 'No client', className: call.client_name ? 'wrap' : 'wrap unlinked', content: call.client_name ?? 'No client' }
      case 'status': { const s = capitalise(plainWords(call.call_status)); return { value: s, content: <span className={`pill ${callTone(call.call_status)}`}>{s}</span> } }
      case 'type': return { value: typeOf(call), content: typeOf(call) }
      case 'length': return { value: call.duration_ms, text: formatDuration(call.duration_ms), className: 'num', content: formatDuration(call.duration_ms) }
      case 'ended': { const s = capitalise(plainWords(call.disconnection_reason)); return { value: s, className: 'muted wrap', content: s } }
    }
  }
  return <DataTable label={label} searchHint={searchHint ?? 'Search calls'}
    columns={columns.map(c => server ? { ...heads[c], ...(server[c] ? { server: server[c] } : { first: 'none' as const }) } : heads[c])}
    rows={calls.map(call => ({ key: call.id, cells: columns.map(c => cell(call, c)) }))}/>
}
