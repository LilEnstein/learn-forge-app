import { defaultTips } from './default'
import { pythonTips } from './python'

const tipPools: Record<string, string[]> = {
  python: pythonTips,
  default: defaultTips,
}

export function getTip(topic?: string): string {
  const pool = tipPools[topic ?? 'default'] ?? defaultTips
  return pool[Math.floor(Math.random() * pool.length)]
}
