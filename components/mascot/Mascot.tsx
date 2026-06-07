"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { MASCOT_ANIMATIONS } from "@/lib/mascot-animations"
import type { MascotProps, MascotSize } from "@/types/mascot"

const SIZE_MAP: Record<MascotSize, number> = {
  sm: 48,
  md: 80,
  lg: 120,
  xl: 200,
}

const ASPECT = 205 / 236

export function Mascot({ expression, size = 'md', animate, loop }: MascotProps) {
  const px = SIZE_MAP[size]
  const h = Math.round(px * ASPECT)

  const animConfig = animate ? MASCOT_ANIMATIONS[animate] : null
  const motionProps = animConfig
    ? {
        ...animConfig,
        transition: loop && animConfig.transition.repeat === undefined
          ? { ...animConfig.transition, repeat: Infinity }
          : animConfig.transition,
      }
    : {}

  return (
    <motion.div {...motionProps} style={{ width: px, height: h, display: 'inline-block' }}>
      <Image
        src={`/mascot/${expression}.png`}
        alt={expression}
        width={px}
        height={h}
        className="object-contain"
        onError={(e) => {
          const img = e.currentTarget
          img.style.display = 'none'
          if (img.parentElement) img.parentElement.textContent = '🦉'
        }}
      />
    </motion.div>
  )
}
