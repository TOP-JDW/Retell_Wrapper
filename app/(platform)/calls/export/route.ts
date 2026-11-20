import type { NextRequest } from 'next/server'
import { database } from '../../../../lib/auth'
import { findCalls } from '../../../../lib/calls'
import { buildCallWorkbook, maximumExportRows, type ExportCall } from '../../../../lib/export'
import { filterQuery, parseCallFilters, scopeCalls } from '../../../../lib/filters'
import { addDays, londonMidnight, londonToday } from '../../../../lib/period'

const refuse = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'private, no-store' } })

// Downloads the calls Call History is showing, with the same filters, as an Excel file. Owners and admins only.
export async function GET(request: NextRequest) {
  const db = await database()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return refuse(401)
  const { data: membership } = await db.from('memberships').select('workspace_id,role').eq('user_id', user.id).maybeSingle()
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) return refuse(403)
  const workspace = membership.workspace_id

  const filters = parseCallFilters(Object.fromEntries(request.nextUrl.searchParams))
  const { data: agents, error } = await db.from('agents').select('id,client_id,is_transfer_agent').eq('workspace_id', workspace).limit(500)
  if (error) return refuse(500)
  const { agentIds } = scopeCalls(agents, filters)
  const range = {
    fromTs: filters.from ? londonMidnight(filters.from).toISOString() : undefined,
    toTs: filters.to ? londonMidnight(addDays(filters.to, 1)).toISOString() : undefined
  }

  // The database API returns at most 1,000 rows at a time, so the export reads in pages.
  const calls: ExportCall[] = []
  let total = 0
  for (let offset = 0; offset < maximumExportRows; offset += 1000) {
    const { rows, count } = await findCalls(db, workspace, { limit: 1000, offset, agentIds, count: offset === 0, ...range })
    if (offset === 0) total = count
    if (rows.length === 0) break
    const { data: ids, error: idError } = await db.from('calls').select('id,retell_call_id').in('id', rows.map(row => row.id))
    if (idError) return refuse(500)
    const retellIds = new Map(ids.map(row => [row.id, row.retell_call_id]))
    for (const row of rows) calls.push({ ...row, retell_call_id: retellIds.get(row.id) ?? '' })
    if (rows.length < 1000) break
  }

  const file = await buildCallWorkbook(calls, {
    filters: filterQuery({ ...filters, page: 1 }).replace(/^\?/, '').replace(/&/g, ', '),
    truncated: total > calls.length, origin: request.nextUrl.origin, exportedAt: new Date()
  })
  return new Response(new Uint8Array(file), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="calls-${londonToday()}.xlsx"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
  } })
}
