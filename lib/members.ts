// Input checks for member management. Kept free of imports so tests can load it directly.
export const roles = ['owner', 'admin', 'viewer'] as const
export type Role = (typeof roles)[number]

export const minimumPasswordLength = 12
export const maximumPasswordLength = 1024

const identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const address = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseRole(value: unknown): Role | null {
  return typeof value === 'string' && (roles as readonly string[]).includes(value) ? (value as Role) : null
}

export function parseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 320 && address.test(email) ? email : null
}

export function parseUserId(value: unknown): string | null {
  return typeof value === 'string' && identifier.test(value) ? value.toLowerCase() : null
}

export function checkPassword(password: string, confirmation: string): 'ok' | 'short' | 'long' | 'mismatch' {
  if (password.length < minimumPasswordLength) return 'short'
  if (password.length > maximumPasswordLength) return 'long'
  return password === confirmation ? 'ok' : 'mismatch'
}
