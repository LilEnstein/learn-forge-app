'use client'

import { useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import { updateUserTheme } from '@/app/actions/theme'

export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggle = useCallback((buttonEl: HTMLElement | null) => {
    const nextTheme = resolvedTheme === 'light' ? 'dark' : 'light'

    // Debounce DB sync — fire-and-forget after 1s
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      updateUserTheme(nextTheme).catch(() => {/* silent — localStorage is authoritative */})
    }, 1000)

    if (resolvedTheme === 'light') {
      // Light → Dark: crossfade
      document.documentElement.classList.add('is-theme-transitioning')
      setTheme('dark')
      if (transitionTimer.current) clearTimeout(transitionTimer.current)
      transitionTimer.current = setTimeout(() => {
        document.documentElement.classList.remove('is-theme-transitioning')
      }, 350)
    } else {
      // Dark → Light: ripple from button position
      const rect = buttonEl?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

      const overlay = document.createElement('div')
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9999',
        'pointer-events:none',
        `clip-path:circle(0px at ${x}px ${y}px)`,
        'background:hsl(var(--background))',
        'transition:clip-path 500ms ease-in-out',
      ].join(';')
      document.body.appendChild(overlay)

      void overlay.getBoundingClientRect()
      overlay.style.clipPath = `circle(200vw at ${x}px ${y}px)`
      setTimeout(() => setTheme('light'), 250)
      setTimeout(() => overlay.remove(), 520)
    }
  }, [resolvedTheme, setTheme])

  return { resolvedTheme, toggle }
}
