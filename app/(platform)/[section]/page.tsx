import { notFound } from 'next/navigation'
import { member } from '../../../lib/auth'
import { sections } from '../../../lib/sections'

// Sections without a page of their own yet. Branding for each client comes with client logins.
export default async function Section({params}: {params: Promise<{section: string}>}) {
  const {section} = await params
  const entry = sections.find(([key]) => key === section)
  if (!entry || section !== 'settings') notFound()
  const {db, membership} = await member()
  const {data, error} = await db.from('branding').select('workspace_id,display_name')
    .eq('workspace_id', membership.workspace_id).order('display_name', {ascending: true}).limit(100)
  if (error) throw new Error('Workspace data could not load.')
  return <div className="stack">
    <header className="page-head"><div><h1>{entry[1]}</h1></div></header>
    <div className="panel">{data.length === 0
      ? <div className="empty"><strong>No branding set</strong><p>Branding for each client comes with client logins.</p></div>
      : <ul className="rows">{data.map(row => <li key={row.workspace_id}>{row.display_name}</li>)}</ul>}
    </div>
  </div>
}
