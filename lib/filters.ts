// Call History filters read from the address bar. Anything invalid is ignored.
// Kept free of imports from other files so tests can load it directly.
const identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/
export const pageSize = 100

// Columns Call History can sort by, across every page, and the database column behind each.
export const callSorts = { started: 'started_at', status: 'call_status', type: 'call_type', length: 'duration_ms', ended: 'disconnection_reason' } as const
export type CallSort = keyof typeof callSorts
export type SortDirection = 'asc' | 'desc'

export type CallFilters = { client: string | 'none' | null; agent: string | null; from: string | null; to: string | null; page: number; transfers: boolean; sort: CallSort; dir: SortDirection }

function validDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = datePattern.exec(value)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return y >= 2000 && y <= 2100 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value : null
}

export function parseCallFilters(query: Record<string, string | string[] | undefined>): CallFilters {
  const one = (key: string) => { const value = query[key]; return Array.isArray(value) ? value[0] : value }
  const client = one('client')
  const agent = one('agent')
  let from = validDate(one('from'))
  let to = validDate(one('to'))
  if (from && to && from > to) [from, to] = [to, from]
  const page = Number.parseInt(one('page') ?? '', 10)
  return {
    client: client === 'none' ? 'none' : client && identifier.test(client) ? client.toLowerCase() : null,
    agent: agent && identifier.test(agent) ? agent.toLowerCase() : null,
    from, to,
    page: Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
    // Calls handled by transfer agents are hidden unless asked for, as transfer agents are on My Agents.
    transfers: one('transfers') === '1',
    // Newest first unless a column heading was clicked.
    sort: Object.hasOwn(callSorts, one('sort') ?? '') ? one('sort') as CallSort : 'started',
    dir: one('dir') === 'asc' ? 'asc' : 'desc'
  }
}

export function filterQuery(filters: CallFilters, changes: Partial<CallFilters> = {}): string {
  const next = { ...filters, ...changes }
  const params = new URLSearchParams()
  if (next.client) params.set('client', next.client)
  if (next.agent) params.set('agent', next.agent)
  if (next.from) params.set('from', next.from)
  if (next.to) params.set('to', next.to)
  if (next.transfers) params.set('transfers', '1')
  if (next.sort !== 'started' || next.dir !== 'desc') { params.set('sort', next.sort); params.set('dir', next.dir) }
  if (next.page > 1) params.set('page', String(next.page))
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function isFiltered(filters: CallFilters): boolean {
  return Boolean(filters.client || filters.agent || filters.from || filters.to || filters.transfers)
}

export type ScopeAgent = { id: string; client_id: string | null; is_transfer_agent: boolean }

// Which agents' calls to show for these filters, and which transfer agents' calls are being hidden.
// Transfer agents are hidden on My Agents, so their calls are hidden too, unless asked for
// or a transfer agent was chosen in the Agent filter. agentIds undefined means every agent.
export function scopeCalls(agents: ScopeAgent[], filters: CallFilters): { agentIds: string[] | undefined; hiddenIds: string[] } {
  let agentIds: string[] | undefined
  if (filters.client) agentIds = agents.filter(agent => filters.client === 'none' ? !agent.client_id : agent.client_id === filters.client).map(agent => agent.id)
  if (filters.agent) agentIds = (agentIds ?? [filters.agent]).filter(id => id === filters.agent)
  const transferIds = new Set(agents.filter(agent => agent.is_transfer_agent).map(agent => agent.id))
  const hideTransfers = !filters.transfers && !(filters.agent && transferIds.has(filters.agent)) && transferIds.size > 0
  if (!hideTransfers) return { agentIds, hiddenIds: [] }
  const inScope = agentIds ?? agents.map(agent => agent.id)
  return { agentIds: inScope.filter(id => !transferIds.has(id)), hiddenIds: inScope.filter(id => transferIds.has(id)) }
}
