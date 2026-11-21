import type { SupabaseClient } from '@supabase/supabase-js'
import type { HealthRow } from './insights'

// Each agent's recent activity, measured up to the newest imported call, so an old import does not make every agent look quiet.
export async function loadHealth(db: SupabaseClient, workspace: string) {
  const newest = await db.from('calls').select('started_at').eq('workspace_id', workspace).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (newest.error) throw new Error('Agent health could not load.')
  const measuredAt: string | null = newest.data?.started_at ?? null
  if (!measuredAt) return { measuredAt, byAgent: new Map<string, HealthRow>() }
  const health = await db.rpc('agent_health', { at: measuredAt })
  if (health.error) throw new Error('Agent health could not load.')
  return { measuredAt, byAgent: new Map((health.data as HealthRow[]).map(row => [row.agent_id, row])) }
}
