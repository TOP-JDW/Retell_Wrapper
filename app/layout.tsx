import '@fontsource-variable/plus-jakarta-sans'
import './style.css'
import type { ReactNode } from 'react'

export const metadata = { title: { default: 'The One Point AI Voice', template: '%s | The One Point AI Voice' } }

export default function Layout({children}: {children: ReactNode}) {
  return <html lang="en-GB"><body>{children}</body></html>
}
