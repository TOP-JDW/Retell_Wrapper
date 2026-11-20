'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { search, type SearchItem } from '../../lib/search'
import { searchIndex } from '../(platform)/search/actions'

const groupName = { page: 'Pages', agent: 'Agents', client: 'Clients' }

// Ctrl+K (or ⌘K) from anywhere: type, use the arrow keys, press Enter.
export function QuickSearch({ pages }: { pages: readonly (readonly [string, string])[] }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState(0)
  const [mac, setMac] = useState(false)

  const pageItems = useMemo<SearchItem[]>(() => pages.map(([key, label]) => ({ kind: 'page', label, hint: 'Page', href: `/${key}` })), [pages])
  const results = useMemo(() => search(query, [...pageItems, ...(index ?? [])]), [query, pageItems, index])

  function open() {
    setQuery(''); setSelected(0)
    dialog.current?.showModal()
    input.current?.focus()
    if (!index) searchIndex().then(setIndex, () => setFailed(true))
  }
  function go(item: SearchItem | undefined) {
    if (!item) return
    dialog.current?.close()
    router.push(item.href)
  }

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform))
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (dialog.current?.open) dialog.current.close(); else open() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => { setSelected(0) }, [query])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); go(results[selected]) }
  }
  useEffect(() => { document.getElementById(`qs-${selected}`)?.scrollIntoView({ block: 'nearest' }) }, [selected])

  return <>
    <button type="button" className="search-trigger" onClick={open} aria-keyshortcuts="Control+K Meta+K">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      <span>Search</span><kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
    <dialog ref={dialog} className="search-dialog" aria-label="Quick search" onClick={e => { if (e.target === dialog.current) dialog.current?.close() }}>
      <div className="search-box">
        <input ref={input} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Search pages, agents and clients"
          role="combobox" aria-expanded="true" aria-controls="qs-results" aria-activedescendant={results.length ? `qs-${selected}` : undefined} aria-autocomplete="list"/>
        <ul id="qs-results" role="listbox" className="search-results">
          {results.map((item, i) => <li key={item.href} id={`qs-${i}`} role="option" aria-selected={i === selected}
            className={i === selected ? 'selected' : ''} onMouseMove={() => setSelected(i)} onClick={() => go(item)}>
            {(i === 0 || results[i - 1].kind !== item.kind) && <span className="group">{groupName[item.kind]}</span>}
            <span className="label">{item.label}</span><span className="hint">{item.hint}</span>
          </li>)}
          {results.length === 0 && <li className="none" role="presentation">{failed ? 'Search could not load. Close and try again.' : index ? 'Nothing matches.' : 'Loading…'}</li>}
        </ul>
        <p className="search-help" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> to move, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close</p>
      </div>
    </dialog>
  </>
}
