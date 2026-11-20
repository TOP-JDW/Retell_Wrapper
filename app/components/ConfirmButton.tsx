'use client'
import type { ReactNode } from 'react'

// A submit button that asks for confirmation first. Everything else on the page stays server-rendered.
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return <button className={className} onClick={event => { if (!window.confirm(message)) event.preventDefault() }}>{children}</button>
}
