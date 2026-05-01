'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { LoadingScreen } from './LoadingScreen'
import type { AvatarKey } from '@/lib/mascots/config'
import type { LoadingContext } from './ContextualProgress'

const MIN_MS = 3000
const FADE_MS = 400
const MAX_MS = 12000 // safety cap if navigation stalls

function contextFromHref(href: string): LoadingContext {
  if (/\/lesson\//.test(href)) return 'lesson'
  return 'transition'
}

export function NavigationOverlay({ avatarKey }: { avatarKey: AvatarKey }) {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [fading, setFading] = useState(false)
  const [context, setContext] = useState<LoadingContext>('transition')

  const prevPathRef = useRef(pathname)
  const startMsRef = useRef(0)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    const elapsed = Date.now() - startMsRef.current
    const remaining = Math.max(0, MIN_MS - elapsed)
    hideTimerRef.current = setTimeout(() => {
      setFading(true)
      fadeTimerRef.current = setTimeout(() => {
        setShow(false)
        setFading(false)
      }, FADE_MS)
    }, remaining)
  }, [])

  // When pathname changes, navigation completed — schedule the hide
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      if (show) triggerHide()
    }
  }, [pathname, show, triggerHide])

  // Intercept internal link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest<HTMLAnchorElement>('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href.startsWith('/') || href === pathname) return

      // Clear any pending hide from a previous navigation
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)

      startMsRef.current = Date.now()
      setContext(contextFromHref(href))
      setFading(false)
      setShow(true)

      // Safety cap: hide after MAX_MS even if navigation never completes
      hideTimerRef.current = setTimeout(triggerHide, MAX_MS)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname, triggerHide])

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
  }, [])

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <LoadingScreen avatarKey={avatarKey} context={context} />
    </div>
  )
}
