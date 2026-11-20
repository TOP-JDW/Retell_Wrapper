'use client'
import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

// A form's submit button that says what is happening while the form is sent, and cannot be
// pressed twice. With confirm, it asks first.
export function SubmitButton({ children, pending, className, confirm }: { children: ReactNode; pending: string; className?: string; confirm?: string }) {
  const status = useFormStatus()
  return <button className={className} disabled={status.pending} aria-disabled={status.pending}
    onClick={confirm ? event => { if (!window.confirm(confirm)) event.preventDefault() } : undefined}>
    {status.pending ? <><span className="spinner" aria-hidden="true"/>{pending}</> : children}
  </button>
}
