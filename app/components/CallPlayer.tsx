'use client'
import { useEffect, useRef, useState } from 'react'

type Line = { role: 'agent' | 'user' | 'transfer_target'; text: string; start: number | null; end: number | null }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// The recording with its transcript. The line being spoken is highlighted; choosing a line plays from there.
export function CallPlayer({ src, lines, plain, agentName }: { src: string | null; lines: Line[]; plain: string | null; agentName: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const box = useRef<HTMLOListElement>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const speaker = { agent: agentName, user: 'Caller', transfer_target: 'Transferred to' }

  const active = lines.reduce((found, line, i) => (line.start !== null && line.start <= time + 0.05 ? i : found), -1)

  useEffect(() => {
    if (!playing || active < 0 || !box.current) return
    const item = box.current.children[active] as HTMLElement | undefined
    if (!item) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box.current.scrollTo({ top: item.offsetTop - box.current.clientHeight / 3, behavior: smooth ? 'smooth' : 'auto' })
  }, [active, playing])

  function playFrom(start: number | null) {
    if (start === null || !audio.current) return
    audio.current.currentTime = start
    void audio.current.play().catch(() => undefined)
  }

  return <div className="player">
    {src && !failed
      ? <audio ref={audio} src={src} controls preload="metadata" onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}/>
      : <p className="notice">{failed ? 'The recording could not be played. Try again in a moment.' : 'No recording is available for this call.'}</p>}
    {lines.length > 0
      ? <ol className="transcript" ref={box} aria-label="Transcript">{lines.map((line, i) =>
          <li key={i} className={`line ${line.role === 'user' ? 'caller' : 'agent'}${i === active ? ' active' : ''}`} aria-current={i === active ? 'true' : undefined}>
            <button type="button" onClick={() => playFrom(line.start)} disabled={!src || failed || line.start === null}
              aria-label={`${speaker[line.role]}${line.start !== null ? ` at ${clock(line.start)}` : ''}: ${line.text}`}>
              <span className="who">{speaker[line.role]}{line.start !== null && <time>{clock(line.start)}</time>}</span>
              <span className="said">{line.text}</span>
            </button>
          </li>)}</ol>
      : plain ? <pre className="transcript plain">{plain}</pre> : <p className="hint">No transcript is available for this call.</p>}
  </div>
}
