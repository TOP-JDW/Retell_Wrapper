import type { SupabaseClient } from '@supabase/supabase-js'

export type CallListRow = {
  id: string; agent_id: string; started_at: string; call_status: string | null; call_type: string | null
  direction: string | null; disconnection_reason: string | null; duration_ms: number | null; agent_name: string; client_name: string | null
}

// The newest calls in a workspace, with each agent's name and client. Optionally limited to some agents.
// Shared by the dashboard, Call History and the client page.
export async function latestCalls(db: SupabaseClient, workspace: string, limit: number, onlyAgents?: string[]): Promise<CallListRow[]> {
  if (onlyAgents && onlyAgents.length === 0) return []
  let query = db.from('calls')
    .select('id,agent_id,started_at,call_status,call_type,direction,disconnection_reason,duration_ms')
    .eq('workspace_id', workspace).order('started_at', {ascending: false}).limit(limit)
  if (onlyAgents) query = query.in('agent_id', onlyAgents)
  const {data, error} = await query
  if (error) throw new Error('Calls could not load.')

  const agentIds = [...new Set(data.map(call => call.agent_id))]
  const agents = new Map<string, {name: string; client_id: string | null}>()
  if (agentIds.length > 0) {
    const {data: rows, error: agentError} = await db.from('agents').select('id,name,client_id').in('id', agentIds)
    if (agentError) throw new Error('Calls could not load.')
    for (const agent of rows) agents.set(agent.id, {name: agent.name, client_id: agent.client_id})
  }
  const clientIds = [...new Set([...agents.values()].map(agent => agent.client_id).filter((id): id is string => Boolean(id)))]
  const clients = new Map<string, string>()
  if (clientIds.length > 0) {
    const {data: rows, error: clientError} = await db.from('clients').select('id,name').in('id', clientIds)
    if (clientError) throw new Error('Calls could not load.')
    for (const client of rows) clients.set(client.id, client.name)
  }
  return data.map(call => {
    const agent = agents.get(call.agent_id)
    return {...call, agent_name: agent?.name ?? 'Unknown', client_name: agent?.client_id ? clients.get(agent.client_id) ?? null : null}
  })
}
