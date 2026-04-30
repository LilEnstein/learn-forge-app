'use client'

import { useMemo } from 'react'
import { Mascot } from '@/components/mascots/Mascot'
import type { AvatarKey } from '@/lib/mascots/config'

const ANIMATIONS = ['mascot-bounce', 'mascot-breathe', 'mascot-float', 'mascot-wiggle'] as const
type AnimName = typeof ANIMATIONS[number]

const ANIMATION_DURATION: Record<AnimName, string> = {
  'mascot-bounce':  '0.8s',
  'mascot-breathe': '2.5s',
  'mascot-float':   '2s',
  'mascot-wiggle':  '1.2s',
}

interface Props {
  avatarKey: AvatarKey
}

export function MascotAnimation({ avatarKey }: Props) {
  const anim = useMemo<AnimName>(
    () => ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)],
    []
  )

  return (
    <div
      style={{
        animation: `${anim} ${ANIMATION_DURATION[anim]} ease-in-out infinite`,
        display: 'inline-block',
      }}
    >
      <Mascot avatarKey={avatarKey} size={160} />
    </div>
  )
}
