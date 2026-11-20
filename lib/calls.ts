import type { SupabaseClient } from '@supabase/supabase-js'

export type CallListRow = {
  id: string; agent_id: string; started_at: string; call_status: string | null; call_type: string | null
  direction: string | null; disconnection_reason: string | null; duration_ms: number | null; agent_name: string; client_name: string | null
}
type Options = { limit: number; offset?: number; agentIds?: string[]; fromTs?: string; toTs?: string; count?: boolean; order?: { column: string; ascending: boolean } }
const sortable = new Set(['started_at', 'call_status', 'call_type', 'duration_ms', 'disconnection_reason'])

// Calls in a workspace, newest first unless another order is given, with each agent's name and client. Shared by the dashboard,
// Call History and the client page. An empty agentIds list means no calls can match.
export async function findCalls(db: SupabaseClient, workspace: string, options: Options): Promise<{rows: CallListRow[]; count: number}> {
  if (options.agentIds && options.agentIds.length === 0) return {rows: [], count: 0}
  const offset = options.offset ?? 0
  let query = db.from('calls')
    .select('id,agent_id,started_at,call_status,call_type,direction,disconnection_reason,duration_ms', options.count ? {count: 'exact'} : undefined)
    .eq('workspace_id', workspace)
  if (options.agentIds) query = query.in('agent_id', options.agentIds)
  if (options.fromTs) query = query.gte('started_at', options.fromTs)
  if (options.toTs) query = query.lt('started_at', options.toTs)
  const order = options.order && sortable.has(options.order.column) ? options.order : {column: 'started_at', ascending: false}
  query = query.order(order.column, {ascending: order.ascending, nullsFirst: false})
  // Ties (and phone or web calls sorted by type) keep a stable order: newest first, then by id.
  if (order.column === 'call_type') query = query.order('direction', {ascending: order.ascending, nullsFirst: false})
  if (order.column !== 'started_at') query = query.order('started_at', {ascending: false})
  const {data, error, count} = await query.order('id', {ascending: true}).range(offset, offset + options.limit - 1)
  if (error) throw new Error('Calls could not load.')
  return {rows: await withNames(db, data), count: count ?? data.length}
}

export async function latestCalls(db: SupabaseClient, workspace: string, limit: number, onlyAgents?: string[]): Promise<CallListRow[]> {
  return (await findCalls(db, workspace, {limit, agentIds: onlyAgents})).rows
}

// Agent and client names for a set of agent ids.
export async function agentNames(db: SupabaseClient, agentIds: string[]) {
  const agents = new Map<string, {name: string; client_id: string | null; is_transfer_agent: boolean}>()
  const clients = new Map<string, string>()
  if (agentIds.length === 0) return {agents, clients}
  const {data: rows, error} = await db.from('agents').select('id,name,client_id,is_transfer_agent').in('id', agentIds)
  if (error) throw new Error('Calls could not load.')
  for (const agent of rows) agents.set(agent.id, {name: agent.name, client_id: agent.client_id, is_transfer_agent: agent.is_transfer_agent})
  const clientIds = [...new Set(rows.map(agent => agent.client_id).filter((id): id is string => Boolean(id)))]
  if (clientIds.length > 0) {
    const {data: found, error: clientError} = await db.from('clients').select('id,name').in('id', clientIds)
    if (clientError) throw new Error('Calls could not load.')
    for (const client of found) clients.set(client.id, client.name)
  }
  return {agents, clients}
}

async function withNames(db: SupabaseClient, data: Omit<CallListRow, 'agent_name' | 'client_name'>[]): Promise<CallListRow[]> {
  const {agents, clients} = await agentNames(db, [...new Set(data.map(call => call.agent_id))])
  return data.map(call => {
    const agent = agents.get(call.agent_id)
    return {...call, agent_name: agent?.name ?? 'Unknown', client_name: agent?.client_id ? clients.get(agent.client_id) ?? null : null}
  })
}
