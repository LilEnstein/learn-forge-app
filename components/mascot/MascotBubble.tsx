"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Mascot } from "./Mascot"
import type { MascotAnimation, MascotExpression, MascotSize } from "@/types/mascot"

interface Props {
  expression: MascotExpression
  size?: MascotSize
  animate?: MascotAnimation
  message: string
  onDismiss?: () => void
  autoHide?: number
}

export function MascotBubble({
  expression,
  size = 'md',
  animate,
  message,
  onDismiss,
  autoHide = 4000,
}: Props) {
  const [displayedText, setDisplayedText] = useState('')
  const [visible, setVisible] = useState(true)

  // Typewriter effect
  useEffect(() => {
    setDisplayedText('')
    let i = 0
    const timer = setInterval(() => {
      i++
      setDisplayedText(message.slice(0, i))
      if (i >= message.length) clearInterval(timer)
    }, 30)
    return () => clearInterval(timer)
  }, [message])

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, autoHide)
    return () => clearTimeout(timer)
  }, [autoHide, onDismiss])

  function dismiss() {
    setVisible(false)
    onDismiss?.()
  }

  return (
    <AnimatePresence>
      {visible && (
        <div
          className="flex items-end gap-2 cursor-pointer"
          onClick={dismiss}
        >
          <Mascot expression={expression} size={size} animate={animate} loop />
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{ transformOrigin: 'bottom left' }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="relative bg-white rounded-2xl shadow-lg border border-purple-100 px-3 py-2 max-w-[180px]"
          >
            {/* Bubble tail */}
            <div
              className="absolute -bottom-2 left-3 w-0 h-0"
              style={{
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid white',
              }}
            />
            <p className="text-xs text-slate-700 leading-tight">{displayedText}</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
