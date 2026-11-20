// Which colour each state gets. The word is always shown too, so colour is never the only signal.
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'brand' | 'neutral'

export function callTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'ended': return 'ok'
    case 'ongoing': return 'info'
    case 'error': return 'bad'
    case 'not_connected': return 'warn'
    default: return 'neutral'
  }
}

export function roleTone(role: string | null | undefined): Tone {
  return role === 'owner' ? 'brand' : role === 'admin' ? 'info' : 'neutral'
}

export function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
