import type { NextRequest } from 'next/server'
import { database } from '../../../../../lib/auth'
import { parseId } from '../../../../../lib/clients'
import { allowedRecordingUrl, cachedLink, relayHeaders, rememberLink, safeRange } from '../../../../../lib/recording'
import { RetellError } from '../../../../../lib/retell'
import { retell, retellConfigured } from '../../../../../lib/retell-server'

const refuse = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'private, no-store' } })

// Plays a call's recording through the app, so Retell's link never reaches the browser.
// Checked on every request: signed in, owner or admin, and the call is in their workspace.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id)
  if (!id) return refuse(404)
  const db = await database()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return refuse(401)
  const { data: membership } = await db.from('memberships').select('workspace_id,role').eq('user_id', user.id).maybeSingle()
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) return refuse(403)
  const { data: call } = await db.from('calls').select('retell_call_id')
    .eq('id', id).eq('workspace_id', membership.workspace_id).maybeSingle()
  if (!call || !retellConfigured()) return refuse(404)

  let link = cachedLink(call.retell_call_id)
  if (!link) {
    try { link = (await retell().getCall(call.retell_call_id)).recordingUrl }
    catch (error) { console.error('Recording link failed:', error instanceof RetellError ? error.failure : 'unknown'); return refuse(502) }
    if (!link) return refuse(404)
    rememberLink(call.retell_call_id, link)
  }

  const target = allowedRecordingUrl(link)
  if (!target) {
    // Logged with the host only, so a new Retell storage host can be added without exposing the signed link.
    let host = 'unreadable'; try { host = new URL(link).hostname } catch {}
    console.error('Recording refused: unexpected host', host)
    return refuse(502)
  }

  const range = safeRange(request.headers.get('range'))
  let upstream: Response
  try {
    // No key or cookies go to the recording host; only the byte range the player asked for.
    upstream = await fetch(target.href, { headers: range ? { Range: range } : {}, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  } catch { return refuse(502) }
  if (upstream.status !== 200 && upstream.status !== 206) return refuse(upstream.status === 416 ? 416 : 502)
  return new Response(upstream.body, { status: upstream.status, headers: relayHeaders(upstream.headers) })
}
