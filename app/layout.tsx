import '@fontsource-variable/plus-jakarta-sans'
import './style.css'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { parseTheme, themeCookie } from '../lib/theme'

export const metadata = { title: { default: 'The One Point AI Voice', template: '%s | The One Point AI Voice' } }

export default async function Layout({children}: {children: ReactNode}) {
  // A chosen theme is drawn by the server, so the page never flashes the wrong colours. Auto is left to the device.
  const theme = parseTheme((await cookies()).get(themeCookie)?.value)
  return <html lang="en-GB" data-theme={theme === 'auto' ? undefined : theme}><body>{children}</body></html>
}
