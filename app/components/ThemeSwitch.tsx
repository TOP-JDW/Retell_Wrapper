'use client'
import { useState } from 'react'
import { themeCookie, themes, type Theme } from '../../lib/theme'

const labels: Record<Theme, string> = { light: 'Light', dark: 'Dark', auto: 'Auto' }

// Light, dark, or follow the device. Changes the page at once and remembers the choice for a year.
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial)
  const choose = (next: Theme) => {
    setTheme(next)
    if (next === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = next
    document.cookie = `${themeCookie}=${next}; path=/; max-age=31536000; samesite=lax`
  }
  return <div className="theme-switch" role="radiogroup" aria-label="Colour theme">
    {themes.map(option => <button key={option} type="button" role="radio" aria-checked={theme === option}
      title={option === 'auto' ? 'Follow your device setting' : undefined} onClick={() => choose(option)}>{labels[option]}</button>)}
  </div>
}
