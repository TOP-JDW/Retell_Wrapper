import './style.css'
import type { ReactNode } from 'react'
export const metadata = { title: 'Voice Operations · Retell Management' }
export default function Layout({children}: {children: ReactNode}) {
  return <html lang="en-GB"><body>{children}</body></html>
}
