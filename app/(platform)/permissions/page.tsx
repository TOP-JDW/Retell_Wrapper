import { member } from '../../../lib/auth'
import { roles } from '../../../lib/members'
import { capitalise, roleTone } from '../../../lib/status'
import { DataTable } from '../../components/DataTable'
import { Flash } from '../../components/Flash'
import { SubmitButton } from '../../components/SubmitButton'
import { changeRole, inviteMember, removeMember } from './actions'

const notices: Record<string, string> = {
  invited: 'Invitation sent. The person will be able to sign in once they accept it.',
  updated: 'Role updated.',
  removed: 'Member removed and their account deleted.',
  removed_account_kept: 'Member removed from the workspace, but their sign-in account could not be deleted. Delete it in Supabase.'
}
const problems: Record<string, string> = {
  owner: 'Only owners can manage members.',
  email: 'Enter a valid email address.',
  invalid: 'That request was not valid.',
  exists: 'That email address already has an account.',
  rate: 'Too many invitations have been sent recently. Wait a few minutes and try again.',
  invite: 'The invitation could not be sent. Check the email settings and try again.',
  self: 'You cannot change your own role or remove yourself. Ask another owner.',
  last_owner: 'A workspace must keep at least one owner.',
  missing: 'That member could not be found.',
  update: 'The change could not be saved. Try again.'
}

export default async function Permissions({searchParams}: {searchParams: Promise<{notice?: string; error?: string}>}) {
  const {notice, error} = await searchParams
  const {db, membership} = await member()
  const isOwner = membership.role === 'owner'
  const {data, error: failure} = await db.from('memberships').select('user_id,email,role')
    .eq('workspace_id', membership.workspace_id).order('email', {ascending: true}).limit(100)
  if (failure) throw new Error('Members could not load.')

  return <div className="stack">
    <header className="page-head"><div><h1>User Permissions</h1>
      <p>{isOwner ? 'Owners invite people, change roles and remove access. Admins manage clients. Viewers can only look.' : 'Only owners can add, change or remove members. You can see your own role below.'}</p></div></header>
    <Flash success={notice && notices[notice]} problem={error && problems[error]}/>
    <div className="panel"><DataTable label="Members" searchHint="Search members or roles"
      columns={[{label: 'Member'}, {label: 'Role'}, ...(isOwner ? [{label: 'Actions', className: 'num', hideLabel: true, first: 'none' as const}] : [])]}
      rows={data.map(row => {
        const self = row.user_id === membership.user_id
        const email = row.email ?? 'Unknown'
        const cells = [{value: email, text: `${email}${self ? ' You' : ''}`, className: 'primary-cell', content: <>{email}{self && <span className="sub">You</span>}</>}]
        if (isOwner && !self) return {key: row.user_id, cells: [...cells,
          {value: row.role, content: <form action={changeRole} className="inline"><input type="hidden" name="user_id" value={row.user_id}/>
            <select name="role" defaultValue={row.role} aria-label={`Role for ${email}`}>{roles.map(role => <option key={role} value={role}>{capitalise(role)}</option>)}</select>
            <SubmitButton className="quiet small" pending="Saving…">Save</SubmitButton></form>},
          {text: '', className: 'num', content: <form action={removeMember} className="inline" style={{justifyContent: 'flex-end'}}><input type="hidden" name="user_id" value={row.user_id}/>
            <SubmitButton className="danger small" pending="Removing…" confirm={`Remove ${email}? Their account will be deleted.`}>Remove</SubmitButton></form>}]}
        return {key: row.user_id, cells: [...cells, {value: row.role, content: <span className={`pill ${roleTone(row.role)}`}>{capitalise(row.role)}</span>}, ...(isOwner ? [{text: '', content: null}] : [])]}
      })}/></div>
    {isOwner && <section className="panel panel-body" aria-labelledby="invite">
      <div className="section-head"><h2 id="invite">Invite a member</h2></div>
      <p className="hint" style={{marginBottom: '1rem'}}>They get an email to accept the invitation and choose a password.</p>
      <form action={inviteMember} className="invite">
        <label>Email address<input type="email" name="email" autoComplete="off" required maxLength={320}/></label>
        <label>Role<select name="role" defaultValue="viewer">{roles.map(role => <option key={role} value={role}>{capitalise(role)}</option>)}</select></label>
        <SubmitButton pending="Sending…">Send invitation</SubmitButton>
      </form>
    </section>}
  </div>
}
