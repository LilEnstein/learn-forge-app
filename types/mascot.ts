export type MascotExpression =
  | 'front'
  | 'three-quarter'
  | 'side'
  | 'top-down'
  | 'happy'
  | 'thinking'
  | 'surprised'
  | 'sleeping'
  | 'victory'
  | 'streak-warning'
  | 'welcome'

export type MascotAnimation =
  | 'bounce'
  | 'shake'
  | 'pulse'
  | 'spin'
  | 'float'
  | 'entrance'
  | 'exit'
  | 'wiggle'
  | 'nod'

export type MascotSize = 'sm' | 'md' | 'lg' | 'xl'

export type MascotTrigger =
  | 'correct'
  | 'incorrect'
  | 'perfect'
  | 'lesson_complete'
  | 'upload_processing'
  | 'upload_done'
  | 'upload_error'
  | 'streak_warning'
  | 'streak_milestone'
  | 'idle'
  | 'welcome'
  | 'thinking'

export interface MascotProps {
  expression: MascotExpression
  size?: MascotSize
  animate?: MascotAnimation
  loop?: boolean
}

export interface AnimationConfig {
  initial?: Record<string, unknown>
  animate: Record<string, unknown>
  transition: Record<string, unknown>
}
