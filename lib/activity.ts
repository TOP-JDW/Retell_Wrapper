import type { SupabaseClient } from '@supabase/supabase-js'

export type Activity = {
  action: string; target_type?: 'client' | 'agent' | 'member' | 'retell'; target_id?: string | null; target_name?: string | null
  details?: Record<string, string | number | boolean | null>
}

// Records what a staff member did. The database adds who and when. Logging never stops the action itself;
// a failure is written to the server log instead.
export async function logActivity(db: SupabaseClient, workspace: string, entry: Activity) {
  const { error } = await db.from('activity_log').insert({
    workspace_id: workspace, action: entry.action, target_type: entry.target_type ?? null, target_id: entry.target_id ?? null,
    target_name: entry.target_name ? entry.target_name.slice(0, 200) : null, details: entry.details ?? {}
  })
  if (error) console.error('Activity could not be recorded:', entry.action, error.message)
}
