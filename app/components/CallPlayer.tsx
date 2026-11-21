'use client'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { matchesSearch } from '../../lib/table'
import { typing } from './CallNav'

type Line = { role: 'agent' | 'user' | 'transfer_target'; text: string; start: number | null; end: number | null }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const speeds = [1, 1.25, 1.5, 2] as const
const speedKey = 'player-speed'

// Marks each searched word in a line of text.
function highlight(text: string, query: string): ReactNode {
  const words = query.trim().split(/\s+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (words.length === 0) return text
  return text.split(new RegExp(`(${words.join('|')})`, 'gi')).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part)
}

// The recording with its transcript. The line being spoken is highlighted; choosing a line plays from there.
// Speed, transcript search and keyboard shortcuts make long calls quick to review.
export function CallPlayer({ src, lines, plain, agentName }: { src: string | null; lines: Line[]; plain: string | null; agentName: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const box = useRef<HTMLOListElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState(0)
  const speaker = { agent: agentName, user: 'Caller', transfer_target: 'Transferred to' }
  const canPlay = Boolean(src) && !failed

  const active = lines.reduce((found, line, i) => (line.start !== null && line.start <= time + 0.05 ? i : found), -1)
  const matches = useMemo(() => query.trim() ? lines.flatMap((line, i) => matchesSearch(line.text, query) ? [i] : []) : [], [lines, query])

  // The chosen speed is remembered on this browser only.
  useEffect(() => {
    try { const saved = Number(localStorage.getItem(speedKey)); if ((speeds as readonly number[]).includes(saved)) setSpeed(saved) } catch {}
  }, [])
  useEffect(() => { if (audio.current) audio.current.playbackRate = speed }, [speed, canPlay])
  const chooseSpeed = (next: number) => { setSpeed(next); try { localStorage.setItem(speedKey, String(next)) } catch {} }

  const scrollTo = (index: number) => {
    const item = box.current?.children[index] as HTMLElement | undefined
    if (!item || !box.current) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box.current.scrollTo({ top: item.offsetTop - box.current.clientHeight / 3, behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => { if (playing && active >= 0 && !query.trim()) scrollTo(active) }, [active, playing, query])
  useEffect(() => { setHit(0); if (matches.length) scrollTo(matches[0]) }, [matches])

  function playFrom(start: number | null) {
    if (start === null || !audio.current) return
    audio.current.currentTime = start
    void audio.current.play().catch(() => undefined)
  }
  const nextMatch = (step: number) => {
    if (!matches.length) return
    const next = (hit + step + matches.length) % matches.length
    setHit(next); scrollTo(matches[next])
  }

  // Space or K plays and pauses; arrows jump 5 seconds; S changes speed; / searches the transcript.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (typing(event)) return
      const a = audio.current
      if (event.key === '/' && search.current) { event.preventDefault(); search.current.focus(); return }
      if (!a || !canPlay) return
      if (event.key === ' ' || event.key === 'k' || event.key === 'K') {
        if ((event.target as HTMLElement | null)?.closest('button, a, audio')) return
        event.preventDefault(); if (a.paused) void a.play().catch(() => undefined); else a.pause()
      } else if (event.key === 'ArrowLeft') { event.preventDefault(); a.currentTime = Math.max(0, a.currentTime - 5) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); a.currentTime = Math.min(a.duration || Infinity, a.currentTime + 5) }
      else if (event.key === 's' || event.key === 'S') { event.preventDefault(); chooseSpeed(speeds[(speeds.indexOf(speed as typeof speeds[number]) + 1) % speeds.length]) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canPlay, speed])

  return <div className="player">
    {canPlay
      ? <div className="player-bar">
          <audio ref={audio} src={src!} controls preload="metadata" onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}/>
          <div className="speed" role="group" aria-label="Playback speed">{speeds.map(s =>
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => chooseSpeed(s)}>{s}×</button>)}</div>
        </div>
      : <p className="notice">{failed ? 'The recording could not be played. Try again in a moment.' : 'No recording is available for this call.'}</p>}
    {lines.length > 0
      ? <>
          <div className="transcript-tools">
            <label className="table-search"><span className="visually-hidden">Search the transcript</span>
              <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              <input ref={search} type="search" value={query} placeholder="Search the transcript" autoComplete="off" aria-keyshortcuts="/"
                onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nextMatch(e.shiftKey ? -1 : 1) } }}/>
            </label>
            {query.trim() && <span className="table-count" role="status">{matches.length ? `${hit + 1} of ${matches.length} ${matches.length === 1 ? 'line' : 'lines'}` : 'No lines match'}</span>}
            {matches.length > 1 && <span className="match-steps">
              <button type="button" className="quiet small" onClick={() => nextMatch(-1)} aria-label="Previous match">↑</button>
              <button type="button" className="quiet small" onClick={() => nextMatch(1)} aria-label="Next match">↓</button></span>}
          </div>
          <ol className="transcript" ref={box} aria-label="Transcript">{lines.map((line, i) => {
            const found = matches.includes(i)
            return <li key={i} className={`line ${line.role === 'user' ? 'caller' : 'agent'}${i === active ? ' active' : ''}${found ? ' found' : ''}${found && matches[hit] === i ? ' current' : ''}${query.trim() && !found ? ' dim' : ''}`}
              aria-current={i === active ? 'true' : undefined}>
              <button type="button" onClick={() => playFrom(line.start)} disabled={!canPlay || line.start === null}
                aria-label={`${speaker[line.role]}${line.start !== null ? ` at ${clock(line.start)}` : ''}: ${line.text}`}>
                <span className="who">{speaker[line.role]}{line.start !== null && <time>{clock(line.start)}</time>}</span>
                <span className="said">{highlight(line.text, query)}</span>
              </button>
            </li>
          })}</ol>
          {canPlay && <p className="shortcuts hint"><kbd>Space</kbd> play or pause · <kbd>←</kbd> <kbd>→</kbd> 5 seconds · <kbd>S</kbd> speed · <kbd>/</kbd> search · <kbd>N</kbd> <kbd>P</kbd> older or newer call</p>}
        </>
      : plain ? <pre className="transcript plain">{plain}</pre> : <p className="hint">No transcript is available for this call.</p>}
  </div>
}
