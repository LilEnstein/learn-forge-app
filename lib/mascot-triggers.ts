import type { MascotAnimation, MascotExpression, MascotTrigger } from '@/types/mascot'

interface TriggerConfig {
  expression: MascotExpression
  animation: MascotAnimation
  message: string | null
}

export const TRIGGER_MAP: Record<MascotTrigger, TriggerConfig> = {
  correct:          { expression: 'happy',          animation: 'nod',      message: 'Chính xác! 🎉' },
  incorrect:        { expression: 'surprised',      animation: 'shake',    message: 'Gần đúng rồi! Thử lại nhé' },
  perfect:          { expression: 'victory',        animation: 'spin',     message: 'Hoàn hảo! +5 gems 💎' },
  lesson_complete:  { expression: 'victory',        animation: 'wiggle',   message: null },
  upload_processing:{ expression: 'thinking',       animation: 'pulse',    message: 'Đang xử lý tài liệu...' },
  upload_done:      { expression: 'victory',        animation: 'entrance', message: 'Khóa học đã sẵn sàng! 🚀' },
  upload_error:     { expression: 'surprised',      animation: 'shake',    message: 'Có lỗi xảy ra. Thử lại nhé!' },
  streak_warning:   { expression: 'streak-warning', animation: 'bounce',   message: 'Streak của bạn sắp mất! Học ngay!' },
  streak_milestone: { expression: 'victory',        animation: 'spin',     message: null },
  idle:             { expression: 'sleeping',       animation: 'float',    message: 'Bạn ổn không? 👀' },
  welcome:          { expression: 'welcome',        animation: 'entrance', message: 'Chào mừng đến LearnForge! 🦉' },
  thinking:         { expression: 'thinking',       animation: 'pulse',    message: null },
}
