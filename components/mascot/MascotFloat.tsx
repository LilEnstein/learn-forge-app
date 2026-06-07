"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useMascot } from "@/hooks/useMascot"
import { Mascot } from "./Mascot"
import { MascotBubble } from "./MascotBubble"

interface Props {
  position?: 'bottom-left' | 'bottom-right'
}

export function MascotFloat({ position = 'bottom-right' }: Props) {
  const { expression, animation, message, visible, show } = useMascot()

  const posClass = position === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6'
  const hasMessage = Boolean(message)

  return (
    <div
      className={`fixed ${posClass} z-50`}
      style={{ pointerEvents: hasMessage ? 'auto' : 'none' }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {hasMessage ? (
              <MascotBubble
                expression={expression}
                size="sm"
                animate={animation ?? 'float'}
                message={message!}
                onDismiss={() => show(expression)}
              />
            ) : (
              <Mascot
                expression={expression}
                size="sm"
                animate={animation ?? 'float'}
                loop
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
