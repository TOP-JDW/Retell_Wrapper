import { notFound } from 'next/navigation'
import { cache } from 'react'
import { member } from './auth'
import { defaultAccent, logoUrl, textOn } from './branding'
import { parseId } from './clients'

// Everything the client preview needs, loaded once per request. Only the signed-in user's workspace,
// and only this client's own agents (transfer agents are left out, as on My Agents).
export const loadPreview = cache(async (rawId: string) => {
  const id = parseId(rawId)
  if (!id) notFound()
  const { db, membership } = await member()
  const [client, branding, agents] = await Promise.all([
    db.from('clients').select('id,name,recordings_for_client').eq('id', id).eq('workspace_id', membership.workspace_id).maybeSingle(),
    db.from('client_branding').select('display_name,accent_colour,logo_mime,logo_base64').eq('client_id', id).eq('workspace_id', membership.workspace_id).maybeSingle(),
    db.from('agents').select('id,name,is_suspended').eq('workspace_id', membership.workspace_id).eq('client_id', id).eq('is_transfer_agent', false).order('name').limit(200)
  ])
  if (client.error || branding.error || agents.error) throw new Error('Preview could not load.')
  if (!client.data) notFound()
  const accent = branding.data?.accent_colour ?? defaultAccent
  return {
    db, membership, client: client.data, agents: agents.data,
    brand: {
      name: branding.data?.display_name ?? client.data.name, accent, onAccent: textOn(accent),
      logo: logoUrl(branding.data?.logo_mime, branding.data?.logo_base64), set: Boolean(branding.data)
    }
  }
})
