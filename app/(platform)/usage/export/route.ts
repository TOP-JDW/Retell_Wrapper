import type { NextRequest } from 'next/server'
import { database } from '../../../../lib/auth'
import { buildUsageWorkbook } from '../../../../lib/export'
import { parseMonth } from '../../../../lib/period'
import { monthUsage } from '../../../../lib/usage'

const refuse = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'private, no-store' } })

// Downloads one month of the Usage & Cost page as an Excel file. Owners and admins only.
export async function GET(request: NextRequest) {
  const db = await database()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return refuse(401)
  const { data: membership } = await db.from('memberships').select('workspace_id,role').eq('user_id', user.id).maybeSingle()
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) return refuse(403)
  const month = parseMonth(request.nextUrl.searchParams.get('month'))
  let rows
  try { rows = await monthUsage(db, membership.workspace_id, month) } catch { return refuse(500) }
  const file = await buildUsageWorkbook(rows, { month, exportedAt: new Date() })
  return new Response(new Uint8Array(file), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="usage-${month}.xlsx"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
  } })
}
