// Messages shown after client actions. Plain words, one job each.
export const clientNotices: Record<string, string> = {
  added: 'Client added. Link its agents on My Agents.',
  renamed: 'Client renamed.',
  deleted: 'Client deleted. Its agents are kept and are no longer linked to a client.',
  branding: 'Branding saved.',
  recordings_on: 'This client can now play recordings and read transcripts.',
  recordings_off: 'This client can no longer play recordings or read transcripts.'
}
export const clientProblems: Record<string, string> = {
  staff: 'Only owners and admins can change clients.',
  name: 'Enter a client name of up to 120 characters.',
  duplicate: 'A client with that name already exists.',
  missing: 'That client could not be found.',
  save: 'The change could not be saved. Try again.',
  brand_name: 'Enter a display name of up to 80 characters.',
  colour: 'Choose a colour as a six-digit hex code, such as #2D3C97.',
  logo_size: 'The logo must be an image of 256 KB or less.',
  logo_type: 'The logo must be a PNG, JPEG, WebP or SVG image.',
  logo_unsafe: 'That SVG contains scripts or outside links, so it cannot be used. Export a plain SVG or a PNG instead.'
}
