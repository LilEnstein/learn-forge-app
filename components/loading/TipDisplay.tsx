'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  tip: string
}

export function TipDisplay({ tip }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [opacity, setOpacity] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Fade out, then reset typewriter with new tip
    setOpacity(0)

    const fadeTimeout = setTimeout(() => {
      setDisplayed('')
      setOpacity(1)

      let i = 0
      intervalRef.current = setInterval(() => {
        i++
        setDisplayed(tip.slice(0, i))
        if (i >= tip.length && intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }, 30)
    }, 200)

    return () => {
      clearTimeout(fadeTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [tip])

  return (
    <p
      aria-live="polite"
      className="text-white/90 text-sm text-center max-w-xs leading-relaxed min-h-[3rem]"
      style={{ opacity, transition: 'opacity 200ms ease' }}
    >
      {displayed}
      <span className="opacity-50">|</span>
    </p>
  )
}
