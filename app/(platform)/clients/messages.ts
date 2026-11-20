// Messages shown after client actions. Plain words, one job each.
export const clientNotices: Record<string, string> = {
  added: 'Client added. Link its agents on My Agents.',
  renamed: 'Client renamed.',
  deleted: 'Client deleted. Its agents are kept and are no longer linked to a client.'
}
export const clientProblems: Record<string, string> = {
  staff: 'Only owners and admins can change clients.',
  name: 'Enter a client name of up to 120 characters.',
  duplicate: 'A client with that name already exists.',
  missing: 'That client could not be found.',
  save: 'The change could not be saved. Try again.'
}
