"use client"

import { useEffect, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Mascot } from "./Mascot"
import type { MascotExpression } from "@/types/mascot"

interface Props {
  expression: MascotExpression
  message: string
  onClose: () => void
}

interface ConfettiPiece {
  id: number
  left: string
  color: string
  delay: number
  duration: number
  rotate: number
}

export function MascotOverlay({ expression, message, onClose }: Props) {
  // Auto-close after 3s
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  const confetti: ConfettiPiece[] = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      color: i % 3 === 0 ? '#f9e2af' : i % 3 === 1 ? '#cba6f7' : '#89dceb',
      delay: Math.random() * 0.6,
      duration: 1.2 + Math.random() * 0.8,
      rotate: Math.random() * 360,
    })),
  [])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer"
        style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      >
        {/* Confetti */}
        {confetti.map((piece) => (
          <motion.div
            key={piece.id}
            className="absolute top-0 rounded-sm"
            style={{
              left: piece.left,
              width: 8,
              height: 8,
              background: piece.color,
              rotate: piece.rotate,
            }}
            initial={{ y: -20, opacity: 1 }}
            animate={{ y: '105vh', opacity: 0 }}
            transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeIn' }}
          />
        ))}

        {/* Mascot */}
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Mascot expression={expression} size="xl" animate="spin" />
        </motion.div>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-2xl font-bold text-white text-center drop-shadow-lg"
        >
          {message}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-3 text-sm text-white/60"
        >
          Nhấn bất kỳ để tiếp tục
        </motion.p>
      </motion.div>
    </AnimatePresence>
  )
}
