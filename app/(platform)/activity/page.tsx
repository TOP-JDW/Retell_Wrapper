import Link from 'next/link'
import { member } from '../../../lib/auth'
import { describeActivity } from '../../../lib/activity-text'
import { formatTime } from '../../../lib/format'
import { DataTable } from '../../components/DataTable'

const kinds = [['', 'Everything'], ['client', 'Clients'], ['agent', 'Agents'], ['member', 'Members'], ['retell', 'Imports']] as const

// Who changed what, newest first. Owners and admins only; the database refuses everyone else.
export default async function Activity({searchParams}: {searchParams: Promise<{kind?: string}>}) {
  const {db, membership} = await member()
  if (membership.role !== 'owner' && membership.role !== 'admin') return <div className="stack">
    <header className="page-head"><div><h1>Activity</h1></div></header>
    <div className="panel"><div className="empty"><strong>Only owners and admins can see activity</strong></div></div>
  </div>
  const raw = (await searchParams).kind
  const kind = kinds.some(([key]) => key && key === raw) ? raw! : ''
  let query = db.from('activity_log').select('id,action,actor_email,target_type,target_id,target_name,details,created_at')
    .eq('workspace_id', membership.workspace_id).order('created_at', {ascending: false}).order('id', {ascending: false}).limit(300)
  if (kind) query = query.eq('target_type', kind)
  const {data, error} = await query
  if (error) throw new Error('Activity could not load.')

  return <div className="stack">
    <header className="page-head">
      <div><h1>Activity</h1><p>Changes made in the portal, newest first. Times are UK time. Only the latest 300 are shown.</p></div>
      <nav className="segmented" aria-label="Show">{kinds.map(([key, label]) =>
        <Link key={label} href={key ? `/activity?kind=${key}` : '/activity'} aria-current={key === kind ? 'true' : undefined}>{label}</Link>)}</nav>
    </header>
    <div className="panel">{data.length === 0
      ? <div className="empty"><strong>No activity yet</strong><p>Changes to clients, branding, agent links, members and imports appear here from now on.</p></div>
      : <DataTable label="Activity" searchHint="Search activity"
          columns={[{label: 'When', first: 'desc'}, {label: 'Who'}, {label: 'What'}]}
          rows={data.map(row => {
            const what = describeActivity(row)
            const link = row.target_id && row.target_type === 'client' && row.action !== 'client.deleted' ? `/clients/${row.target_id}`
              : row.target_id && row.target_type === 'agent' ? `/agents/${row.target_id}` : null
            return {key: String(row.id), cells: [
              {value: row.created_at, text: formatTime(row.created_at), className: 'muted', content: formatTime(row.created_at)},
              {value: row.actor_email ?? 'Unknown', content: row.actor_email ?? 'Unknown'},
              {value: what, className: 'wrap', content: link ? <Link href={link}>{what}</Link> : what}
            ]}
          })}/>}
    </div>
  </div>
}
