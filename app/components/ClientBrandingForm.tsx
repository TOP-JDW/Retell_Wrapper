'use client'
import { useEffect, useState } from 'react'
import { useUnsavedWarning } from './useUnsavedWarning'
import { SubmitButton } from './SubmitButton'
import { contrast, maximumDisplayName, maximumLogoBytes, parseAccent, textOn } from '../../lib/branding'

type Props = {
  clientId: string
  initial: { displayName: string; accent: string; logo: string | null }
  action: (form: FormData) => Promise<void>
}

// Branding fields with a live preview of the client's portal. Nothing is saved until "Save branding".
export function ClientBrandingForm({ clientId, initial, action }: Props) {
  const [name, setName] = useState(initial.displayName)
  const [accentText, setAccentText] = useState(initial.accent)
  const [logo, setLogo] = useState<string | null>(initial.logo)
  const [remove, setRemove] = useState(false)
  const [fileProblem, setFileProblem] = useState<string | null>(null)
  const [fileChosen, setFileChosen] = useState(false)
  const [saving, setSaving] = useState(false)
  // Unsaved when anything differs from what was loaded. Sending the form clears the warning.
  const dirty = !saving && (name !== initial.displayName || accentText.toUpperCase() !== initial.accent.toUpperCase() || remove || fileChosen)
  useUnsavedWarning(dirty, 'The branding changes are not saved. Leave without saving?')
  const accent = parseAccent(accentText) ?? initial.accent
  const light = contrast(accent, '#FFFFFF') < 3
  const shownLogo = remove ? null : logo

  useEffect(() => () => { if (logo?.startsWith('blob:')) URL.revokeObjectURL(logo) }, [logo])

  function chooseFile(file: File | undefined) {
    setFileProblem(null)
    setFileChosen(Boolean(file))
    if (!file) { setLogo(initial.logo); return }
    if (file.size > maximumLogoBytes) { setFileProblem('This file is over 256 KB, so it will not be accepted.'); return }
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) { setFileProblem('SVG logos are not accepted. Export the logo as a PNG.'); return }
    setRemove(false)
    setLogo(URL.createObjectURL(file))
  }

  return <div className="branding-grid">
    <form action={action} className="branding-form" onSubmit={() => setSaving(true)}>
      <input type="hidden" name="client_id" value={clientId}/>
      <label>Display name<input name="display_name" value={name} onChange={e => setName(e.target.value)} required maxLength={maximumDisplayName} autoComplete="off"/></label>
      <label>Main colour
        <span className="colour-field">
          <input type="color" value={accent.toLowerCase()} onChange={e => setAccentText(e.target.value.toUpperCase())} aria-label="Pick a colour"/>
          <input name="accent_colour" value={accentText} onChange={e => setAccentText(e.target.value)} required pattern="#[0-9A-Fa-f]{6}" maxLength={7} spellCheck={false}/>
        </span>
      </label>
      {light && <p className="hint">This colour is light, so button text on it will be dark. Thin lines in it may be hard to see.</p>}
      <label>Logo<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" onChange={e => chooseFile(e.target.files?.[0])}/></label>
      <p className="hint">PNG, JPEG or WebP, 256 KB at most. A logo made for a white background works best.</p>
      {fileProblem && <p role="alert" className="notice problem">{fileProblem}</p>}
      {initial.logo && <label className="check"><input type="checkbox" name="remove_logo" checked={remove} onChange={e => setRemove(e.target.checked)}/>Remove the current logo</label>}
      <div className="form-actions"><SubmitButton pending="Saving…">Save branding</SubmitButton>{dirty && <span className="unsaved">Unsaved changes</span>}</div>
    </form>

    <figure className="brand-preview" aria-label="Preview of the client's portal">
      <div className="bp-frame" style={{ ['--accent' as string]: accent, ['--on-accent' as string]: textOn(accent) }}>
        <div className="bp-bar" aria-hidden="true"><i/><i/><i/><span className="bp-tab">{name.trim() || 'Display name'}</span></div>
        <div className="bp-body">
          <aside className="bp-side">
            <div className="bp-brand">{shownLogo ? <img src={shownLogo} alt=""/> : <span>{name.trim() || 'Display name'}</span>}</div>
            <ul aria-hidden="true"><li className="on">Dashboard</li><li>Calls</li><li>Agents</li></ul>
          </aside>
          <div className="bp-main" aria-hidden="true">
            <p className="bp-title">Dashboard</p>
            <div className="bp-stats"><div><span>Calls</span><b>128</b></div><div><span>Connected</span><b>81%</b></div><div><span>Average length</span><b>2:41</b></div></div>
            <div className="bp-chart">{[38, 52, 44, 70, 61, 84, 58, 66, 90, 74, 63, 80].map((h, i) => <i key={i} style={{ height: `${h}%` }}/>)}</div>
            <span className="bp-button">View calls</span>
          </div>
        </div>
      </div>
      <figcaption>How {name.trim() || 'this client'}'s portal will look when client logins arrive. The display name is the browser tab title, and shows in place of a logo when there is none. Sample figures.</figcaption>
    </figure>
  </div>
}
