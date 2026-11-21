'use server'
import { redirect } from 'next/navigation'
import { member } from '../../../lib/auth'
import { adminClient } from '../../../lib/admin'
import { parseEmail, parseRole, parseUserId } from '../../../lib/members'
import { logActivity } from '../../../lib/activity'

// Every action starts here. The database enforces the same rule; this check stops the secret key being used for anyone else.
async function owner() {
  const { db, membership } = await member()
  if (membership.role !== 'owner') redirect('/permissions?error=owner')
  return { db, membership }
}

export async function inviteMember(form: FormData) {
  const { db, membership } = await owner()
  const email = parseEmail(form.get('email'))
  const role = parseRole(form.get('role'))
  if (!email) redirect('/permissions?error=email')
  if (!role) redirect('/permissions?error=invalid')

  const admin = adminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error || !data.user) {
    console.error('Invitation failed:', error?.code ?? error?.message)
    const exists = error?.code === 'email_exists' || /already been registered/i.test(error?.message ?? '')
    redirect(`/permissions?error=${exists ? 'exists' : error?.code === 'over_email_send_rate_limit' ? 'rate' : 'invite'}`)
  }

  const { error: memberError } = await db.from('memberships')
    .insert({ user_id: data.user.id, workspace_id: membership.workspace_id, role })
  if (memberError) {
    console.error('Membership could not be created:', memberError.message)
    await admin.auth.admin.deleteUser(data.user.id) // do not leave an account that cannot be invited again
    redirect('/permissions?error=invite')
  }
  await logActivity(db, membership.workspace_id, { action: 'member.invited', target_type: 'member', target_id: data.user.id, target_name: email, details: { role } })
  redirect('/permissions?notice=invited')
}

export async function changeRole(form: FormData) {
  const { db, membership } = await owner()
  const userId = parseUserId(form.get('user_id'))
  const role = parseRole(form.get('role'))
  if (!userId || !role) redirect('/permissions?error=invalid')
  if (userId === membership.user_id) redirect('/permissions?error=self')

  const { data: before } = await db.from('memberships').select('email,role').eq('workspace_id', membership.workspace_id).eq('user_id', userId).maybeSingle()
  const { data, error } = await db.from('memberships').update({ role })
    .eq('workspace_id', membership.workspace_id).eq('user_id', userId).select('user_id')
  if (error) {
    console.error('Role change failed:', error.message)
    redirect(`/permissions?error=${/at least one owner/.test(error.message) ? 'last_owner' : 'update'}`)
  }
  if (!data?.length) redirect('/permissions?error=missing')
  if (before?.role !== role)
    await logActivity(db, membership.workspace_id, { action: 'member.role_changed', target_type: 'member', target_id: userId, target_name: before?.email ?? null, details: { from: before?.role ?? null, to: role } })
  redirect('/permissions?notice=updated')
}

export async function removeMember(form: FormData) {
  const { db, membership } = await owner()
  const userId = parseUserId(form.get('user_id'))
  if (!userId) redirect('/permissions?error=invalid')
  if (userId === membership.user_id) redirect('/permissions?error=self')

  const { data, error } = await db.from('memberships').delete()
    .eq('workspace_id', membership.workspace_id).eq('user_id', userId).select('user_id,email')
  if (error) {
    console.error('Removal failed:', error.message)
    redirect(`/permissions?error=${/at least one owner/.test(error.message) ? 'last_owner' : 'update'}`)
  }
  if (!data?.length) redirect('/permissions?error=missing')

  await logActivity(db, membership.workspace_id, { action: 'member.removed', target_type: 'member', target_id: userId, target_name: data[0].email ?? null })

  // Removing the person also deletes their sign-in account, so the same address can be invited again later.
  const { error: accountError } = await adminClient().auth.admin.deleteUser(userId)
  if (accountError) console.error('Account deletion failed:', accountError.code ?? accountError.message)
  redirect(`/permissions?notice=${accountError ? 'removed_account_kept' : 'removed'}`)
}
