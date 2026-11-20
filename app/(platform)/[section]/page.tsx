import { notFound } from 'next/navigation'
import { member } from '../../../lib/auth'
import { sections } from '../../../lib/sections'

export default async function Section({params}: {params: Promise<{section: string}>}) {
  const {section} = await params
  const entry = sections.find(([key]) => key === section)
  if (!entry) notFound()
  const {db, membership} = await member()
  const workspace = membership.workspace_id
  if (section === 'dashboard') {
    const totals = await Promise.all(['agents','calls','clients'].map(async table => {
      const {count,error} = await db.from(table).select('*',{count:'exact',head:true}).eq('workspace_id', workspace)
      if (error) throw new Error('Dashboard could not load.')
      return count
    }))
    return <><h1>Dashboard</h1><div className="metrics">{['Agents','Calls','Clients'].map((label,i) => <article key={label}><small>{label}</small><b>{totals[i]}</b></article>)}</div></>
  }
  const lists = {
    agents: ['agents','name','No agents have been imported.'],
    calls: ['calls','started_at','No calls have been imported.'],
    clients: ['clients','name','No clients have been added.'],
    permissions: ['memberships','role','No members are visible.'],
    settings: ['branding','display_name','Workspace branding has not been set.']
  } as const
  const [table,column,empty] = lists[section as keyof typeof lists]
  const {data,error} = await db.from(table).select('*').eq('workspace_id',workspace).order(column,{ascending:section !== 'calls'}).limit(100)
  if (error) throw new Error('Workspace data could not load.')
  return <><h1>{entry[1]}</h1>{data.length === 0 ? <p>{empty}</p> :
    <ul>{data.map(row => <li key={row.id ?? row.user_id ?? workspace}>{section === 'permissions' ? row.user_id+' · ' : ''}{String(row[column])}</li>)}</ul>}</>
}
