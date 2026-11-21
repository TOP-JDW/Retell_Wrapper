// Plain sentences for the activity log. No imports, so tests can load it directly.
export type ActivityRow = { action: string; target_name: string | null; details: Record<string, unknown> | null }

const text = (value: unknown) => typeof value === 'string' && value ? value : null
const role = (value: unknown) => typeof value === 'string' ? value.charAt(0).toUpperCase() + value.slice(1) : 'unknown'

export function describeActivity(row: ActivityRow): string {
  const d = row.details ?? {}
  const name = row.target_name ?? 'an item'
  switch (row.action) {
    case 'client.added': return `Added client ${name}`
    case 'client.renamed': return `Renamed client ${text(d.from) ?? 'a client'} to ${name}`
    case 'client.deleted': return `Deleted client ${name}`
    case 'client.branding_saved': return `Saved branding for ${name}${text(d.changes) ? ` (${d.changes})` : ''}`
    case 'client.recordings_on': return `Turned on recordings for ${name}`
    case 'client.recordings_off': return `Turned off recordings for ${name}`
    case 'agent.linked': return text(d.client) ? `Linked agent ${name} to ${d.client}` : `Removed the client from agent ${name}`
    case 'member.invited': return `Invited ${name} as ${role(d.role)}`
    case 'member.role_changed': return `Changed ${name} from ${role(d.from)} to ${role(d.to)}`
    case 'member.removed': return `Removed ${name}`
    case 'retell.imported': return `Imported ${Number(d.agents) || 0} agents and ${Number(d.calls) || 0} calls from Retell`
    default: return row.action.replace(/[._]/g, ' ')
  }
}
