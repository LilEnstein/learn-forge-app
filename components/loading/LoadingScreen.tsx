// components/loading/LoadingScreen.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { MascotAnimation } from './MascotAnimation'
import { TipDisplay } from './TipDisplay'
import { ContextualProgress, type LoadingContext } from './ContextualProgress'
import { MASCOT_CONFIG, type AvatarKey } from '@/lib/mascots/config'
import { getTip } from '@/lib/tips'

interface Props {
  avatarKey: AvatarKey
  context: LoadingContext
  topic?: string
  courseId?: string
  userId?: string
  progress?: number
}

const CONTEXT_MESSAGES: Record<LoadingContext, string | null> = {
  lesson:     'Đang chuẩn bị bài học...',
  generating: 'AI đang đọc tài liệu của bạn...',
  uploading:  'Đang xử lý tài liệu...',
  transition: null,
}

export function LoadingScreen({ avatarKey, context, topic, courseId, userId, progress }: Props) {
  const config = MASCOT_CONFIG[avatarKey]
  const [isDark, setIsDark] = useState(false)
  const [tip, setTip] = useState(() => getTip(topic))
  const [visible, setVisible] = useState(false)
  const mountedRef = useRef(true)

  // Detect dark mode from html class
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  // Fade in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => {
      cancelAnimationFrame(id)
      mountedRef.current = false
    }
  }, [])

  // Background RAG tip fetch (non-blocking)
  useEffect(() => {
    if (!courseId || !userId) return
    const cacheKey = `rag-tip-${userId}-${courseId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) { setTip(cached); return }

    fetch(`/api/tips/generate?courseId=${courseId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { tip: string } | null) => {
        if (data?.tip && mountedRef.current) {
          localStorage.setItem(cacheKey, data.tip)
          setTip(data.tip)
        }
      })
      .catch(() => {/* keep static tip */})
  }, [courseId, userId])

  const bgColor = isDark ? config.darkAccent : config.accent
  const message = CONTEXT_MESSAGES[context]

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8"
      style={{
        backgroundColor: bgColor,
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
    >
      <div style={{ marginTop: '-10vh' }}>
        <MascotAnimation avatarKey={avatarKey} />
      </div>

      <TipDisplay tip={tip} />

      {message && (
        <p className="text-white/60 text-xs tracking-wide">{message}</p>
      )}

      <div className="absolute bottom-12">
        <ContextualProgress context={context} progress={progress} />
      </div>
    </div>
  )
}
