// Call History filters read from the address bar. Anything invalid is ignored.
// Kept free of imports from other files so tests can load it directly.
const identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/
export const pageSize = 100

export type CallFilters = { client: string | 'none' | null; agent: string | null; from: string | null; to: string | null; page: number }

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
    page: Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1
  }
}

export function filterQuery(filters: CallFilters, changes: Partial<CallFilters> = {}): string {
  const next = { ...filters, ...changes }
  const params = new URLSearchParams()
  if (next.client) params.set('client', next.client)
  if (next.agent) params.set('agent', next.agent)
  if (next.from) params.set('from', next.from)
  if (next.to) params.set('to', next.to)
  if (next.page > 1) params.set('page', String(next.page))
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function isFiltered(filters: CallFilters): boolean {
  return Boolean(filters.client || filters.agent || filters.from || filters.to)
}
