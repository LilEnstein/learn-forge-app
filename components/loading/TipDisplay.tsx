'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  tip: string
}

export function TipDisplay({ tip }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [opacity, setOpacity] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevTipRef = useRef('')

  useEffect(() => {
    // Only fade out when the tip actually changes (e.g. RAG tip replaces static tip).
    // On first mount skip the delay so text is visible immediately.
    const tipChanged = prevTipRef.current !== '' && prevTipRef.current !== tip
    prevTipRef.current = tip

    if (intervalRef.current) clearInterval(intervalRef.current)

    const startTyping = () => {
      setDisplayed('')
      let i = 0
      intervalRef.current = setInterval(() => {
        i++
        setDisplayed(tip.slice(0, i))
        if (i >= tip.length && intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }, 30)
    }

    if (tipChanged) {
      setOpacity(0)
      const fadeTimeout = setTimeout(() => {
        setOpacity(1)
        startTyping()
      }, 200)
      return () => {
        clearTimeout(fadeTimeout)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    // First mount: type immediately, no fade delay
    startTyping()

    return () => {
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
