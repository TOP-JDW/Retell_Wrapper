'use server'
import { member } from '../../../lib/auth'
import type { SearchItem } from '../../../lib/search'

// Names of the signed-in user's agents and clients for quick search. Row-level security limits them to their workspace.
export async function searchIndex(): Promise<SearchItem[]> {
  const { db, membership } = await member()
  const [agents, clients] = await Promise.all([
    db.from('agents').select('id,name,client_id,is_transfer_agent').eq('workspace_id', membership.workspace_id).order('name').limit(500),
    db.from('clients').select('id,name').eq('workspace_id', membership.workspace_id).order('name').limit(500)
  ])
  if (agents.error || clients.error) throw new Error('Search could not load.')
  const clientNames = new Map(clients.data.map(client => [client.id, client.name]))
  return [
    ...agents.data.map(agent => ({ kind: 'agent' as const, label: agent.name, href: `/agents/${agent.id}`,
      hint: agent.is_transfer_agent ? 'Transfer agent' : (agent.client_id && clientNames.get(agent.client_id)) || 'Agent' })),
    ...clients.data.map(client => ({ kind: 'client' as const, label: client.name, href: `/clients/${client.id}`, hint: 'Client' }))
  ]
}
