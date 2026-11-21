import type { SupabaseClient } from '@supabase/supabase-js'
import { monthRange } from './period'

export type ClientUsage = { clientId: string | null; client: string; total: number; connected: number; duration_ms: number; cost_cents: number; costed: number }

// One month's usage per client, named, most expensive first. Shared by the Usage page and its export.
export async function monthUsage(db: SupabaseClient, workspace: string, month: string): Promise<ClientUsage[]> {
  const range = monthRange(month)
  const [usage, clients] = await Promise.all([
    db.rpc('call_usage', { from_ts: range.fromTs, to_ts: range.toTs }),
    db.from('clients').select('id,name').eq('workspace_id', workspace).limit(500)
  ])
  if (usage.error || clients.error) throw new Error('Usage could not load.')
  const names = new Map(clients.data.map(client => [client.id, client.name]))
  return (usage.data as { client_id: string | null; total: number; connected: number; duration_ms: number; cost_cents: number; costed: number }[])
    .map(row => ({ clientId: row.client_id, client: (row.client_id && names.get(row.client_id)) || 'No client', total: +row.total, connected: +row.connected,
      duration_ms: +row.duration_ms, cost_cents: +row.cost_cents, costed: +row.costed }))
}
