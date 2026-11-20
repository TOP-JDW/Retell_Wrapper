'use server'
import { redirect } from 'next/navigation'
import { member } from '../../../lib/auth'
import { parseClientName, parseId } from '../../../lib/clients'

// Owners and admins manage clients. The database enforces the same rule.
async function staff() {
  const { db, membership } = await member()
  if (membership.role !== 'owner' && membership.role !== 'admin') redirect('/clients?error=staff')
  return { db, membership }
}

const duplicate = (error: { code?: string } | null) => error?.code === '23505'

export async function addClient(form: FormData) {
  const { db, membership } = await staff()
  const name = parseClientName(form.get('name'))
  if (!name) redirect('/clients?error=name')
  const { data, error } = await db.from('clients').insert({ workspace_id: membership.workspace_id, name }).select('id').single()
  if (error) {
    if (!duplicate(error)) console.error('Client could not be added:', error.message)
    redirect(`/clients?error=${duplicate(error) ? 'duplicate' : 'save'}`)
  }
  redirect(`/clients/${data.id}?notice=added`)
}

export async function renameClient(form: FormData) {
  const { db, membership } = await staff()
  const id = parseId(form.get('client_id'))
  if (!id) redirect('/clients?error=missing')
  const name = parseClientName(form.get('name'))
  if (!name) redirect(`/clients/${id}?error=name`)
  const { data, error } = await db.from('clients').update({ name })
    .eq('id', id).eq('workspace_id', membership.workspace_id).select('id')
  if (error) {
    if (!duplicate(error)) console.error('Client could not be renamed:', error.message)
    redirect(`/clients/${id}?error=${duplicate(error) ? 'duplicate' : 'save'}`)
  }
  if (!data?.length) redirect('/clients?error=missing')
  redirect(`/clients/${id}?notice=renamed`)
}

// Its agents stay and become unlinked; their calls are untouched.
export async function deleteClient(form: FormData) {
  const { db, membership } = await staff()
  const id = parseId(form.get('client_id'))
  if (!id) redirect('/clients?error=missing')
  const { data, error } = await db.from('clients').delete()
    .eq('id', id).eq('workspace_id', membership.workspace_id).select('id')
  if (error) { console.error('Client could not be deleted:', error.message); redirect(`/clients/${id}?error=save`) }
  if (!data?.length) redirect('/clients?error=missing')
  redirect('/clients?notice=deleted')
}

export async function linkAgent(form: FormData) {
  const { db } = await staff()
  const agent = parseId(form.get('agent_id'))
  const rawClient = form.get('client_id')
  const client = rawClient === '' ? null : parseId(rawClient)
  if (!agent || (rawClient !== '' && !client)) redirect('/agents?error=link')
  const { error } = await db.rpc('set_agent_client', { target_agent: agent, target_client: client })
  if (error) { console.error('Agent link failed:', error.message); redirect('/agents?error=link') }
  redirect('/agents?notice=linked')
}
