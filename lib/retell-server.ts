import 'server-only'
import { createRetell } from './retell'

// The only place the Retell key is read. Use a restricted key that can only read agents and call history.
export function retellConfigured() {
  return Boolean(process.env.RETELL_API_KEY)
}

export function retell() {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) throw new Error('Retell is not configured.')
  return createRetell({ apiKey })
}
