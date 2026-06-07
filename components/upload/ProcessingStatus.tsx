"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { ProgressEvent, ProgressStep } from "@/types/progress"
import { useMascot } from "@/hooks/useMascot"
import { MascotFloat } from "@/components/mascot/MascotFloat"

interface Props {
  docId: string
  onComplete: (courseId: string) => void
  onError: () => void
}

interface LogLine {
  id: number
  time: string
  message: string
  detail?: string
  step: ProgressStep
}

const STEPS: { step: ProgressStep; label: string; icon: string }[] = [
  { step: "parse",      label: "Đọc tài liệu",       icon: "📄" },
  { step: "chunk",      label: "Chia nhỏ nội dung",   icon: "✂️" },
  { step: "embed",      label: "Tạo vector",           icon: "🧠" },
  { step: "curriculum", label: "Sinh lộ trình",        icon: "🗺️" },
  { step: "exercises",  label: "Tạo bài tập",          icon: "📝" },
  { step: "done",       label: "Hoàn thành",           icon: "✅" },
]

const STEP_COLOR: Record<ProgressStep, string> = {
  upload:     "text-slate-400",
  parse:      "text-cyan-400",
  chunk:      "text-yellow-400",
  embed:      "text-purple-400",
  curriculum: "text-blue-400",
  exercises:  "text-green-400",
  done:       "text-green-400",
  error:      "text-red-400",
}

function getStepState(
  step: ProgressStep,
  activeStep: ProgressStep | null
): "pending" | "active" | "done" {
  const order = STEPS.map((s) => s.step)
  const stepIdx = order.indexOf(step)
  const activeIdx = activeStep ? order.indexOf(activeStep) : -1
  if (activeIdx === -1) return "pending"
  if (stepIdx < activeIdx) return "done"
  if (stepIdx === activeIdx) return "active"
  return "pending"
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function ProcessingStatus({ docId, onComplete, onError }: Props) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [progress, setProgress] = useState(0)
  const [activeStep, setActiveStep] = useState<ProgressStep | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [isError, setIsError] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(null)
  const logCounter = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { show, react } = useMascot()

  useEffect(() => {
    let finished = false
    let es: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const stop = () => {
      if (es) { es.close(); es = null }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    }

    const handle = (event: ProgressEvent) => {
      setActiveStep(event.step)
      if (event.progress !== undefined) setProgress(event.progress)

      // Mascot reactions per pipeline step
      if (event.step === "upload")     show('side',      'Đang đọc tài liệu của bạn...')
      if (event.step === "parse")      show('thinking',  'Đang phân tích nội dung...')
      if (event.step === "chunk")      show('thinking')
      if (event.step === "embed")      show('thinking',  'Đang tạo vector embedding...')
      if (event.step === "curriculum") show('top-down',  'Đang xây dựng lộ trình học...')
      if (event.step === "exercises")  show('top-down',  'Đang tạo bài tập...')
      if (event.step === "done")       react('upload_done')
      if (event.step === "error")      react('upload_error')

      setLogs((prev) => {
        const next = [
          ...prev,
          {
            id: ++logCounter.current,
            time: formatTime(event.timestamp),
            message: event.message,
            detail: event.detail,
            step: event.step,
          },
        ]
        return next.length > 50 ? next.slice(-50) : next
      })

      if (event.step === "done") {
        finished = true
        setIsDone(true)
        if (event.courseId) setCourseId(event.courseId)
        stop()
      }
      if (event.step === "error") {
        finished = true
        setIsError(true)
        stop()
      }
    }

    // Polling fallback — used on serverless (Vercel), where the SSE/LISTEN
    // stream is unavailable. Derives whole-pipeline progress from the status
    // endpoint until the course is fully ready.
    const STEP_MESSAGES: Record<ProgressStep, string> = {
      upload: "Đang tải lên...",
      parse: "Đang đọc tài liệu...",
      chunk: "Đang chia nhỏ nội dung...",
      embed: "Đang tạo vector embedding...",
      curriculum: "Đang xây dựng lộ trình học...",
      exercises: "Đang tạo bài tập...",
      done: "Khóa học đã sẵn sàng!",
      error: "Đã xảy ra lỗi khi xử lý tài liệu",
    }

    const startPolling = () => {
      if (pollTimer || finished) return
      const tick = async () => {
        try {
          const res = await fetch(`/api/upload/status/${docId}`)
          if (res.status === 404) { stop(); return }
          if (!res.ok) return
          const d = await res.json()
          handle({
            step: d.step as ProgressStep,
            message: STEP_MESSAGES[d.step as ProgressStep] ?? "Đang xử lý...",
            progress: d.progress,
            timestamp: Date.now(),
            courseId: d.courseId,
          })
        } catch {
          // transient — keep polling
        }
      }
      void tick()
      pollTimer = setInterval(tick, 2000)
    }

    // Prefer the live SSE stream (rich sub-step % + log lines locally). But on
    // serverless (Vercel+Neon) the stream can connect yet stay silent (LISTEN
    // doesn't bridge across pooled connections) — onerror never fires. So also
    // arm a grace timer: if no SSE event has arrived shortly, start polling too.
    // Both sources feed handle(); whichever reaches "done" stops everything.
    let sawSseEvent = false
    let graceTimer: ReturnType<typeof setTimeout> | null = null

    const armPollingFallback = () => {
      if (!finished && !sawSseEvent) startPolling()
    }

    try {
      es = new EventSource(`/api/upload/progress/${docId}`)
      es.onmessage = (e) => {
        sawSseEvent = true
        if (graceTimer) { clearTimeout(graceTimer); graceTimer = null }
        handle(JSON.parse(e.data) as ProgressEvent)
      }
      es.onerror = () => {
        if (es) { es.close(); es = null }
        armPollingFallback()
      }
      // If SSE produces nothing within the grace window, poll anyway.
      graceTimer = setTimeout(armPollingFallback, 3500)
    } catch {
      startPolling()
    }

    const origStop = stop
    return () => {
      if (graceTimer) clearTimeout(graceTimer)
      origStop()
    }
  }, [docId])

  // Auto-scroll to newest log line
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex flex-col gap-2">
        {STEPS.map(({ step, label, icon }) => {
          const state = getStepState(step, activeStep)
          return (
            <div key={step} className="flex items-center gap-3">
              <div className="w-6 text-base leading-none">
                {state === "done" ? (
                  <span className="text-green-500">✓</span>
                ) : state === "active" ? (
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    {icon}
                  </motion.span>
                ) : (
                  <span className="text-slate-500">{icon}</span>
                )}
              </div>
              <span
                className={`text-sm transition-colors ${
                  state === "done"
                    ? "text-green-600 line-through decoration-green-400"
                    : state === "active"
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Terminal log panel */}
      <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs h-48 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-slate-500 animate-pulse">Đang chờ kết nối...</div>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map((line) => (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-2"
              >
                <span className="text-slate-500 shrink-0">[{line.time}]</span>
                <span className={STEP_COLOR[line.step]}>{line.message}</span>
                {line.detail && (
                  <span className="text-slate-400 ml-1">{line.detail}</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Tiến độ</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Done state */}
      {isDone && (
        <div className="text-center space-y-2 pt-2">
          <p className="text-green-600 font-medium text-sm">🎉 Khóa học đã sẵn sàng!</p>
          <button
            onClick={() => courseId && onComplete(courseId)}
            className="px-6 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
          >
            Bắt đầu học →
          </button>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="text-center space-y-2 pt-2">
          <p className="text-destructive text-sm">
            {logs.at(-1)?.message ?? "Đã xảy ra lỗi"}
          </p>
          <button
            onClick={onError}
            className="px-6 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Thử lại
          </button>
        </div>
      )}

      <MascotFloat position="bottom-left" />
    </div>
  )
}
