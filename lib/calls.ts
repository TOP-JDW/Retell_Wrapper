import type { SupabaseClient } from '@supabase/supabase-js'

export type CallListRow = {
  id: string; agent_id: string; started_at: string; call_status: string | null; call_type: string | null
  direction: string | null; disconnection_reason: string | null; duration_ms: number | null; agent_name: string
}

// The newest calls in a workspace, with each agent's name. Shared by the dashboard and Call History.
export async function latestCalls(db: SupabaseClient, workspace: string, limit: number): Promise<CallListRow[]> {
  const {data, error} = await db.from('calls')
    .select('id,agent_id,started_at,call_status,call_type,direction,disconnection_reason,duration_ms')
    .eq('workspace_id', workspace).order('started_at', {ascending: false}).limit(limit)
  if (error) throw new Error('Calls could not load.')
  const agentIds = [...new Set(data.map(call => call.agent_id))]
  const names = new Map<string, string>()
  if (agentIds.length > 0) {
    const {data: agents, error: agentError} = await db.from('agents').select('id,name').in('id', agentIds)
    if (agentError) throw new Error('Calls could not load.')
    for (const agent of agents) names.set(agent.id, agent.name)
  }
  return data.map(call => ({...call, agent_name: names.get(call.agent_id) ?? 'Unknown'}))
}
