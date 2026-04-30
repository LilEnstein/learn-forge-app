// lib/mascots/config.ts

export type AvatarKey = 'fox' | 'owl' | 'panda' | 'dragon' | 'bear' | 'cat'
export type Personality = 'witty' | 'scholarly' | 'chill' | 'bold' | 'warm' | 'playful'

export interface MascotConfig {
  accent: string
  darkAccent: string
  personality: Personality
}

export const MASCOT_CONFIG: Record<AvatarKey, MascotConfig> = {
  fox:    { accent: '#f97316', darkAccent: '#7c2d12', personality: 'witty'    },
  owl:    { accent: '#7c3aed', darkAccent: '#3b0764', personality: 'scholarly' },
  panda:  { accent: '#10b981', darkAccent: '#064e3b', personality: 'chill'    },
  cat:    { accent: '#ec4899', darkAccent: '#831843', personality: 'playful'  },
  dragon: { accent: '#ef4444', darkAccent: '#7f1d1d', personality: 'bold'     },
  bear:   { accent: '#f59e0b', darkAccent: '#78350f', personality: 'warm'     },
}
