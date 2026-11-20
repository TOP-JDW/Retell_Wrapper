// The colour theme a person chose. Stored in a cookie so the server draws the page in the right colours
// from the first paint. 'auto' follows the device.
export const themes = ['light', 'dark', 'auto'] as const
export type Theme = (typeof themes)[number]
export const themeCookie = 'theme'
export const parseTheme = (value: unknown): Theme => value === 'light' || value === 'dark' ? value : 'auto'
