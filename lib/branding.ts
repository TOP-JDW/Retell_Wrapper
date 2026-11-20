// Checks for client branding. Kept free of imports so tests can load it directly.
export const maximumLogoBytes = 256 * 1024
export const maximumDisplayName = 80
export const defaultAccent = '#2D3C97'
// The only fields a save may change on existing branding. They match the database's update permission;
// the client and workspace are fixed once branding exists. Tests check this list against the database.
export const brandingUpdateFields = ['display_name', 'accent_colour', 'logo_mime', 'logo_base64', 'updated_at'] as const
export type BrandingChanges = Partial<Record<(typeof brandingUpdateFields)[number], string | null>>
export type LogoType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml'

export function parseAccent(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const hex = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : null
}

export function parseDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length >= 1 && name.length <= maximumDisplayName ? name : null
}

// What the file really is, judged by its first bytes rather than its name or the browser's claim.
export function sniffLogo(bytes: Uint8Array): LogoType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  const head = new TextDecoder().decode(bytes.slice(0, 1024)).replace(/^﻿/, '').trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml'
  return null
}

// Logos are only ever shown as images, where scripts cannot run, but unsafe SVGs are refused anyway.
export function svgIsSafe(text: string): boolean {
  const lower = text.toLowerCase()
  return !/<script|<foreignobject|javascript:|\son[a-z]+\s*=|<!entity|<iframe|<object|<embed/.test(lower)
    && !/(href|src)\s*=\s*["']?\s*(https?:|\/\/|data:)/.test(lower)
}

export type LogoCheck = { ok: true; mime: LogoType; base64: string } | { ok: false; problem: 'logo_size' | 'logo_type' | 'logo_unsafe' }

export function checkLogo(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0 || bytes.length > maximumLogoBytes) return { ok: false, problem: 'logo_size' }
  const mime = sniffLogo(bytes)
  if (!mime) return { ok: false, problem: 'logo_type' }
  if (mime === 'image/svg+xml' && !svgIsSafe(new TextDecoder().decode(bytes))) return { ok: false, problem: 'logo_unsafe' }
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { ok: true, mime, base64: btoa(binary) }
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// Button text on the client's colour: white when it reads well, otherwise near-black.
export function textOn(accent: string): '#FFFFFF' | '#091B2D' {
  return contrast(accent, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#091B2D'
}

export function logoUrl(mime: string | null | undefined, base64: string | null | undefined): string | null {
  return mime && base64 ? `data:${mime};base64,${base64}` : null
}

// Chart colours for a client's portal: their colour for connected calls and a neutral grey for the rest.
// If their colour is itself greyish and close to that grey, a darker grey keeps the two apart.
export function previewChartColours(accent: string): { connected: string; other: string } {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16))
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
  const other = saturation < 0.2 && contrast(accent, '#B4BDCA') < 1.6 ? '#6B7585' : '#B4BDCA'
  return { connected: accent, other }
}
