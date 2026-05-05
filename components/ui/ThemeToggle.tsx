'use client'

import { useEffect, useRef, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useThemeToggle } from '@/hooks/useThemeToggle'

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useThemeToggle()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <button
      ref={buttonRef}
      onClick={() => toggle(buttonRef.current)}
      aria-label="Toggle theme"
      className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {mounted ? (resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />) : <span style={{ display: 'block', width: 18, height: 18 }} />}
    </button>
  )
}
