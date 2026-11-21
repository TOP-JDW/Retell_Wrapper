// Display helpers. Times are shown in UK time because the product is used in the UK.
export function formatTime(value: string | null | undefined): string {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(date)
}

export function formatDuration(milliseconds: number | null | undefined): string {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0) return 'Unknown'
  const total = Math.round(milliseconds / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function plainWords(value: string | null | undefined): string {
  return value ? value.replace(/_/g, ' ') : 'Unknown'
}

export function formatTalkTime(milliseconds: number): string {
  const minutes = Math.round(Math.max(0, milliseconds) / 60000)
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

export function formatPercent(rate: number | null): string {
  return rate === null ? 'None yet' : `${Math.round(rate * 100)}%`
}

// Retell reports costs in US cents.
export function formatCost(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 'Unknown'
  return `$${(cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatMinutes(milliseconds: number): string {
  return (Math.max(0, milliseconds) / 60000).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// A cost per minute, to a tenth of a cent, because these are small numbers.
export function formatRate(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 'None yet'
  return `$${(cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
}
