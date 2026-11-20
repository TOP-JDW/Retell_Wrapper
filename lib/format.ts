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
