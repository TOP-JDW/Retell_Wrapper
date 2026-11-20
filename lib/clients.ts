// Input checks for client management. Kept free of imports so tests can load it directly.
export const maximumClientName = 120
const identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseClientName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length >= 1 && name.length <= maximumClientName ? name : null
}

export function parseId(value: unknown): string | null {
  return typeof value === 'string' && identifier.test(value) ? value.toLowerCase() : null
}
