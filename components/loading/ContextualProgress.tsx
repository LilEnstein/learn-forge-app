'use client'

export type LoadingContext = 'lesson' | 'generating' | 'uploading' | 'transition'

interface Props {
  context: LoadingContext
  progress?: number  // 0–100, only used when context === 'uploading'
}

export function ContextualProgress({ context, progress }: Props) {
  if (context === 'transition') {
    return (
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-white/70"
            style={{ animation: `mascot-bounce 1s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
    )
  }

  if (context === 'generating') {
    return (
      <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
    )
  }

  if (context === 'uploading' && progress !== undefined) {
    return (
      <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    )
  }

  // 'lesson' — indeterminate bar
  return (
    <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
      <div
        className="h-full bg-white rounded-full w-1/3"
        style={{ animation: 'indeterminate-bar 1.5s ease-in-out infinite' }}
      />
    </div>
  )
}
