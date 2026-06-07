import { create } from 'zustand'
import { TRIGGER_MAP } from '@/lib/mascot-triggers'
import type { MascotAnimation, MascotExpression, MascotTrigger } from '@/types/mascot'

interface MascotState {
  expression: MascotExpression
  animation: MascotAnimation | null
  message: string | null
  visible: boolean
}

interface MascotActions {
  react: (trigger: MascotTrigger) => void
  show: (expression: MascotExpression, message?: string) => void
  hide: () => void
  setMessage: (message: string | null) => void
}

let messageTimer: ReturnType<typeof setTimeout> | null = null

function scheduleMessageClear(set: (fn: (s: MascotState & MascotActions) => Partial<MascotState>) => void) {
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    set(() => ({ message: null }))
  }, 4000)
}

export const useMascot = create<MascotState & MascotActions>((set) => ({
  expression: 'front',
  animation: null,
  message: null,
  visible: false,

  react: (trigger: MascotTrigger) => {
    const config = TRIGGER_MAP[trigger]
    set(() => ({
      expression: config.expression,
      animation: config.animation,
      message: config.message,
      visible: true,
    }))
    if (config.message) scheduleMessageClear(set)
  },

  show: (expression: MascotExpression, message?: string) => {
    set(() => ({
      expression,
      animation: null,
      message: message ?? null,
      visible: true,
    }))
    if (message) scheduleMessageClear(set)
  },

  hide: () => set(() => ({ visible: false })),

  setMessage: (message: string | null) => {
    set(() => ({ message }))
    if (message) scheduleMessageClear(set)
  },
}))
