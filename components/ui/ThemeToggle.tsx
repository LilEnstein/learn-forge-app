'use client'

import { useRef } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useThemeToggle } from '@/hooks/useThemeToggle'

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useThemeToggle()
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={buttonRef}
      onClick={() => toggle(buttonRef.current)}
      aria-label="Toggle theme"
      className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
