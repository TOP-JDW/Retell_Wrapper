'use client'
import { useEffect, useRef, useState } from 'react'

// Address-bar values that only carry a one-off message. They are removed once the message shows,
// so a refresh or Back does not show it again.
const messageParams = ['notice', 'error', 'agents', 'calls', 'skipped', 'more']

// A pop-up message in the corner of the screen. Success messages close by themselves after a few
// seconds (longer for long messages, and never while the pointer or keyboard focus is on them).
// Problems stay until closed, so nobody misses them.
export function Toast({ message, tone }: { message: string; tone: 'success' | 'problem' }) {
  const [shown, setShown] = useState(false)
  const [closing, setClosing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const ms = Math.min(12000, 5000 + message.length * 50)

  const close = () => { setClosing(true); timer.current = setTimeout(() => setShown(false), 200) }
  const start = () => { if (tone === 'success') { clearTimeout(timer.current); timer.current = setTimeout(close, ms) } }
  const stop = () => clearTimeout(timer.current)

  useEffect(() => {
    // Set the text after mounting, so screen readers announce it.
    setShown(true)
    start()
    const url = new URL(window.location.href)
    if (messageParams.some(key => url.searchParams.has(key))) {
      for (const key of messageParams) url.searchParams.delete(key)
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div role={tone === 'problem' ? 'alert' : 'status'} className="toast-slot">
    {shown && <div className={`toast ${tone}${closing ? ' closing' : ''}`} onMouseEnter={stop} onMouseLeave={start} onFocus={stop} onBlur={start}>
      <span className="toast-icon" aria-hidden="true">{tone === 'success' ? '✓' : '!'}</span>
      <p>{message}</p>
      <button type="button" className="toast-close" onClick={close} aria-label="Close message">×</button>
    </div>}
  </div>
}
