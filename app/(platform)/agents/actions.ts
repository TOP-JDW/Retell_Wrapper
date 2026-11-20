'use server'
import { redirect } from 'next/navigation'
import { member } from '../../../lib/auth'
import { RetellError, type AgentRow, type CallRow, type RetellFailure } from '../../../lib/retell'
import { retell, retellConfigured } from '../../../lib/retell-server'

const chunks = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

// Reads from Retell and changes nothing there. Both lists are fetched before anything is saved.
async function readRetell(): Promise<
  | { ok: true; agents: AgentRow[]; calls: CallRow[]; skipped: number; truncated: boolean }
  | { ok: false; failure: RetellFailure }
> {
  try {
    const client = retell()
    const agents = await client.listAgents()
    const calls = await client.listCalls()
    return { ok: true, agents: agents.agents, calls: calls.calls, skipped: agents.skipped + calls.skipped, truncated: agents.truncated || calls.truncated }
  } catch (error) {
    const failure = error instanceof RetellError ? error.failure : 'unexpected'
    console.error('Retell read failed:', failure, error instanceof RetellError ? error.message : '')
    return { ok: false, failure }
  }
}

export async function importFromRetell() {
  const { db, membership } = await member()
  if (membership.role !== 'owner') redirect('/agents?error=owner')
  if (!retellConfigured()) redirect('/agents?error=not_configured')

  const fetched = await readRetell()
  if (!fetched.ok) redirect(`/agents?error=retell_${fetched.failure}`)

  const workspace = membership.workspace_id
  const agentIds = new Map<string, string>()
  for (const part of chunks(fetched.agents.map(agent => ({ workspace_id: workspace, ...agent })), 500)) {
    const { data, error } = await db.from('agents').upsert(part, { onConflict: 'retell_agent_id' }).select('id,retell_agent_id')
    if (error) { console.error('Agents could not be saved:', error.message); redirect('/agents?error=save') }
    for (const row of data ?? []) agentIds.set(row.retell_agent_id, row.id)
  }

  let skipped = fetched.skipped
  const callRows = []
  for (const { retell_agent_id, ...call } of fetched.calls) {
    const agentId = agentIds.get(retell_agent_id)
    if (!agentId) { skipped++; continue } // the agent is not a voice agent in this account
    callRows.push({ workspace_id: workspace, agent_id: agentId, ...call })
  }
  for (const part of chunks(callRows, 500)) {
    const { error } = await db.from('calls').upsert(part, { onConflict: 'retell_call_id' })
    if (error) { console.error('Calls could not be saved:', error.message); redirect('/agents?error=save') }
  }

  const summary = new URLSearchParams({
    notice: 'imported', agents: String(agentIds.size), calls: String(callRows.length),
    skipped: String(skipped), more: fetched.truncated ? '1' : '0'
  })
  redirect(`/agents?${summary}`)
}
