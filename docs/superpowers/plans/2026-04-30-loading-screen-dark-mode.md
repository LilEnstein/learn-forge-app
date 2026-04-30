# Loading Screen + Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personalized full-screen immersive loading overlay (mascot + typewriter tip + context progress) and an asymmetric dark mode system (crossfade light→dark, ripple dark→light) with DB persistence.

**Architecture:** Loading screen is a composable overlay rendered over page content — mascot config drives accent color and personality; static tips load at zero latency; RAG tips swap in non-blockingly via a cached API route. Dark mode uses `next-themes` with `class` strategy on `<html>`; transition logic lives in a single `useThemeToggle` hook; theme persists to `User.theme` in DB via a debounced Server Action.

**Tech Stack:** Next.js App Router, `next-themes`, Tailwind CSS (`dark:` prefix), Prisma (add `theme` field), `lucide-react` (Sun/Moon icons), existing `lib/ai/rag/retrieve.ts` + `lib/ai/provider.ts` for tips API.

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `lib/mascots/config.ts` | `AvatarKey` type, `MascotConfig` interface, `MASCOT_CONFIG` record |
| `lib/tips/default.ts` | Generic learning tips (fallback for unknown topic) |
| `lib/tips/python.ts` | Python-specific static tips |
| `lib/tips/index.ts` | `getTip(topic?)` — picks a random tip from the right pool |
| `components/loading/ContextualProgress.tsx` | Spinner / indeterminate bar / determinate bar / 3-dot corner |
| `components/loading/MascotAnimation.tsx` | Randomly picks 1 of 4 CSS keyframe animations on mount |
| `components/loading/TipDisplay.tsx` | Typewriter effect; fade-swaps tip text when prop changes |
| `components/loading/LoadingScreen.tsx` | Orchestrator: full-screen overlay, calls all sub-components |
| `hooks/useThemeToggle.ts` | Asymmetric transition: crossfade (light→dark) + ripple (dark→light) |
| `components/ui/ThemeToggle.tsx` | Client button: Sun/Moon icon, calls `useThemeToggle` |
| `app/actions/theme.ts` | Server Action `updateUserTheme(theme)` — writes to `User.theme` |
| `app/api/tips/generate/route.ts` | Auth-gated RAG tip endpoint |

### Modified files
| Path | Change |
|------|--------|
| `app/globals.css` | Add 4 mascot keyframes + `html.is-theme-transitioning` CSS |
| `prisma/schema.prisma` | Add `theme String? @default("system")` to `User` model |
| `components/providers.tsx` | Wrap children with `ThemeProvider` from `next-themes` |
| `app/layout.tsx` | Add `<Providers>` wrapper + `suppressHydrationWarning` on `<html>` |
| `app/app/layout.tsx` | Add `<ThemeToggle>` in sidebar footer + pass `avatarKey`/`userId` to sidebar user card area |

---

## Task 1: Mascot Config + AvatarKey Types

**Files:**
- Create: `lib/mascots/config.ts`

- [ ] **Step 1: Create the config file**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `lib/mascots/config.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/mascots/config.ts
git commit -m "feat(mascot): add AvatarKey types and MASCOT_CONFIG"
```

---

## Task 2: Static Tip Pools

**Files:**
- Create: `lib/tips/default.ts`
- Create: `lib/tips/python.ts`
- Create: `lib/tips/index.ts`

- [ ] **Step 1: Create default tips**

```ts
// lib/tips/default.ts
export const defaultTips = [
  "Spaced repetition is the most evidence-backed study technique — review material at increasing intervals.",
  "The Feynman technique: explain a concept in simple words to identify gaps in your understanding.",
  "Active recall beats re-reading. Close the book and try to remember before checking.",
  "Sleep is when your brain consolidates learning — pulling an all-nighter before a test backfires.",
  "Interleaving topics (switching between subjects) leads to deeper learning than blocking by topic.",
  "The 2-minute rule: if understanding something takes less than 2 minutes, do it now.",
  "Teaching others is the fastest way to find what you don't know.",
  "Break large topics into chunks of 25–50 minutes. Your focus degrades sharply after that.",
  "Error-making is learning — the brain pays more attention to mistakes than correct answers.",
  "Connecting new knowledge to something you already know makes it stick far longer.",
]
```

- [ ] **Step 2: Create Python tips**

```ts
// lib/tips/python.ts
export const pythonTips = [
  "Python lists are dynamic arrays — appending is amortized O(1) but insertion at index 0 is O(n).",
  "Use `enumerate()` instead of `range(len(x))` to get both index and value in a loop.",
  "`collections.defaultdict` prevents KeyError and removes the need for `if key not in dict` guards.",
  "List comprehensions are faster than equivalent for-loops because they avoid repeated attribute lookups.",
  "The walrus operator `:=` lets you assign and test in one expression: `if n := len(a): ...`",
  "f-strings (Python 3.6+) are faster than `.format()` and `%` formatting at runtime.",
  "`is` tests identity (same object), `==` tests equality (same value). Never use `is` for string comparison.",
  "`functools.lru_cache` turns a recursive function into a memoized one with one decorator line.",
  "Python's GIL means CPU-bound threads don't run in parallel — use `multiprocessing` for that.",
  "Generator expressions (`(x for x in y)`) are lazy — they compute values only when consumed.",
]
```

- [ ] **Step 3: Create index with `getTip` function**

```ts
// lib/tips/index.ts
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/tips/
git commit -m "feat(tips): add static tip pools and getTip helper"
```

---

## Task 3: CSS — Mascot Keyframes + Theme Transition

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append keyframes and transition CSS to `app/globals.css`**

Add at the end of the file (after the existing `.checkpoint-shimmer` block):

```css
/* Mascot loading animations */
@keyframes mascot-bounce {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-18px); }
}
@keyframes mascot-breathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.08); }
}
@keyframes mascot-float {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50%       { transform: translateY(-12px) rotate(3deg); }
}
@keyframes mascot-wiggle {
  0%, 100% { transform: rotate(0deg); }
  20%       { transform: rotate(-12deg); }
  40%       { transform: rotate(12deg); }
  60%       { transform: rotate(-8deg); }
  80%       { transform: rotate(8deg); }
}

/* Dark mode crossfade transition — only active during the toggle, not on scroll/hover */
html.is-theme-transitioning *,
html.is-theme-transitioning *::before,
html.is-theme-transitioning *::after {
  transition: background-color 300ms ease, color 300ms ease,
              border-color 300ms ease, fill 300ms ease !important;
}
```

- [ ] **Step 2: Verify dev server still starts**

```bash
npm run dev
```

Expected: compiles without CSS errors. Open `http://localhost:3000` — page loads normally.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(css): add mascot keyframes and theme transition styles"
```

---

## Task 4: ContextualProgress Component

**Files:**
- Create: `components/loading/ContextualProgress.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/loading/ContextualProgress.tsx
'use client'

export type LoadingContext = 'lesson' | 'generating' | 'uploading' | 'transition'

interface Props {
  context: LoadingContext
  progress?: number  // 0–100, only used when context === 'uploading'
}

export function ContextualProgress({ context, progress }: Props) {
  if (context === 'transition') {
    return (
      <div className="fixed bottom-8 right-8 flex gap-1.5">
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
```

Also add the indeterminate bar keyframe to `app/globals.css`:

```css
@keyframes indeterminate-bar {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/loading/ContextualProgress.tsx app/globals.css
git commit -m "feat(loading): add ContextualProgress component"
```

---

## Task 5: MascotAnimation Component

**Files:**
- Create: `components/loading/MascotAnimation.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/loading/MascotAnimation.tsx
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/loading/MascotAnimation.tsx
git commit -m "feat(loading): add MascotAnimation with random CSS keyframe"
```

---

## Task 6: TipDisplay Component

**Files:**
- Create: `components/loading/TipDisplay.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/loading/TipDisplay.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  tip: string
}

export function TipDisplay({ tip }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [opacity, setOpacity] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Fade out, then reset typewriter with new tip
    setOpacity(0)

    const fadeTimeout = setTimeout(() => {
      setDisplayed('')
      setOpacity(1)

      let i = 0
      intervalRef.current = setInterval(() => {
        i++
        setDisplayed(tip.slice(0, i))
        if (i >= tip.length && intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }, 30)
    }, 200)

    return () => {
      clearTimeout(fadeTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [tip])

  return (
    <p
      aria-live="polite"
      className="text-white/90 text-sm text-center max-w-xs leading-relaxed min-h-[3rem]"
      style={{ opacity, transition: 'opacity 200ms ease' }}
    >
      {displayed}
      <span className="opacity-50">|</span>
    </p>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/loading/TipDisplay.tsx
git commit -m "feat(loading): add TipDisplay with typewriter and fade-swap"
```

---

## Task 7: LoadingScreen Orchestrator

**Files:**
- Create: `components/loading/LoadingScreen.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/loading/LoadingScreen.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
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
  const { resolvedTheme } = useTheme()
  const config = MASCOT_CONFIG[avatarKey]
  const bgColor = resolvedTheme === 'dark' ? config.darkAccent : config.accent

  const [tip, setTip] = useState(() => getTip(topic))
  const [visible, setVisible] = useState(false)
  const mountedRef = useRef(true)

  // Fade in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => {
      cancelAnimationFrame(t)
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
      {/* Mascot — vertical ~35% */}
      <div style={{ marginTop: '-10vh' }}>
        <MascotAnimation avatarKey={avatarKey} />
      </div>

      {/* Tip text */}
      <TipDisplay tip={tip} />

      {/* Context message */}
      {message && (
        <p className="text-white/60 text-xs tracking-wide">{message}</p>
      )}

      {/* Progress indicator */}
      <div className="absolute bottom-12">
        <ContextualProgress context={context} progress={progress} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. (Note: `useTheme` from `next-themes` will produce an error until Task 10 installs the package — if so, add a `// @ts-ignore` on the import temporarily and remove it in Task 10.)

- [ ] **Step 3: Commit**

```bash
git add components/loading/LoadingScreen.tsx
git commit -m "feat(loading): add LoadingScreen orchestrator"
```

---

## Task 8: DB Schema — Add theme Field

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `theme` field to User model**

Open `prisma/schema.prisma`. Find the `User` model. Add this line after the `avatarKey` field:

```prisma
theme     String?  @default("system")
```

The User model section should now include:

```prisma
avatarKey String?  @default("owl")
theme     String?  @default("system")
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-user-theme
```

Expected output includes: `The following migration(s) have been applied` and the migration file name.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx tsc --noEmit
```

Expected: no type errors. `prisma.user.findUnique({ select: { theme: true } })` should be valid.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add User.theme field for dark mode persistence"
```

---

## Task 9: Install next-themes + Update Providers + Layout

**Files:**
- Modify: `components/providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install next-themes**

```bash
npm install next-themes
```

Expected: package added to `node_modules` and `package.json`.

- [ ] **Step 2: Update `components/providers.tsx`**

Replace the entire file content:

```tsx
// components/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="lf-theme">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 3: Update `app/layout.tsx`**

Replace the entire file content:

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LearnForge',
  description: 'Self-hostable learning platform with RAG + Duolingo-style gamification',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

Also remove the inner `<Providers>` wrapper from `app/app/layout.tsx` since it's now at the root. Open `app/app/layout.tsx` and change line 68:

```tsx
// Before:
<div className="flex-1 p-6"><Providers>{children}</Providers></div>

// After:
<div className="flex-1 p-6">{children}</div>
```

Also remove the `Providers` import from `app/app/layout.tsx`:

```tsx
// Remove this line:
import { Providers } from "@/components/providers";
```

- [ ] **Step 4: Remove the now-redundant `@ts-ignore` in LoadingScreen.tsx if it was added in Task 7 Step 2**

Open `components/loading/LoadingScreen.tsx` and remove any `// @ts-ignore` comment added temporarily.

- [ ] **Step 5: Verify no flash of wrong theme**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Hard reload (Ctrl+Shift+R). There should be no white flash before dark mode applies if your OS is set to dark mode.

- [ ] **Step 6: Commit**

```bash
git add components/providers.tsx app/layout.tsx app/app/layout.tsx package.json package-lock.json
git commit -m "feat(theme): install next-themes and add ThemeProvider at root"
```

---

## Task 10: useThemeToggle Hook

**Files:**
- Create: `hooks/useThemeToggle.ts`

- [ ] **Step 1: Create the hook**

```ts
// hooks/useThemeToggle.ts
'use client'

import { useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'

export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggle = useCallback((buttonEl: HTMLElement | null) => {
    if (resolvedTheme === 'light') {
      // Light → Dark: crossfade
      document.documentElement.classList.add('is-theme-transitioning')
      setTheme('dark')
      if (transitionTimer.current) clearTimeout(transitionTimer.current)
      transitionTimer.current = setTimeout(() => {
        document.documentElement.classList.remove('is-theme-transitioning')
      }, 350)
    } else {
      // Dark → Light: ripple from button position
      const rect = buttonEl?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

      const overlay = document.createElement('div')
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9999',
        'pointer-events:none',
        `clip-path:circle(0px at ${x}px ${y}px)`,
        'background:hsl(var(--background))',
        'transition:clip-path 500ms ease-in-out',
      ].join(';')
      document.body.appendChild(overlay)

      // Trigger reflow so transition fires
      void overlay.getBoundingClientRect()
      overlay.style.clipPath = `circle(200vw at ${x}px ${y}px)`

      setTimeout(() => setTheme('light'), 250)
      setTimeout(() => overlay.remove(), 520)
    }
  }, [resolvedTheme, setTheme])

  return { resolvedTheme, toggle }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useThemeToggle.ts
git commit -m "feat(theme): add useThemeToggle with asymmetric crossfade+ripple"
```

---

## Task 11: ThemeToggle Button + Wire into Sidebar

**Files:**
- Create: `components/ui/ThemeToggle.tsx`
- Modify: `app/app/layout.tsx`

- [ ] **Step 1: Create the ThemeToggle client component**

```tsx
// components/ui/ThemeToggle.tsx
'use client'

import { useRef } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useThemeToggle } from '@/hooks/useThemeToggle'

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useThemeToggle()
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={buttonRef}
      onClick={() => toggle(buttonRef.current)}
      aria-label="Toggle theme"
      className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
```

- [ ] **Step 2: Add ThemeToggle to sidebar in `app/app/layout.tsx`**

Open `app/app/layout.tsx`. Add the import at the top:

```tsx
import { ThemeToggle } from "@/components/ui/ThemeToggle";
```

Find the user card block (around line 46–52) and add `<ThemeToggle />` just before it, so the sidebar footer now reads:

```tsx
<div className="mt-auto flex flex-col gap-2">
  <div className="flex justify-end">
    <ThemeToggle />
  </div>
  <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
    <Mascot avatarKey={avatarKey} size={32} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{session.user.name ?? "Learner"}</p>
      <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Test dark mode toggle in browser**

```bash
npm run dev
```

1. Open `http://localhost:3000/app/dashboard`
2. Click the Moon icon in the sidebar footer
3. **Expected (light → dark):** All colors fade to dark theme in ~300ms. No abrupt jump.
4. Click the Sun icon
5. **Expected (dark → light):** A white ripple expands from the button position, revealing the light theme.

- [ ] **Step 4: Commit**

```bash
git add components/ui/ThemeToggle.tsx app/app/layout.tsx
git commit -m "feat(theme): add ThemeToggle button and wire into sidebar"
```

---

## Task 12: Server Action — updateUserTheme

**Files:**
- Create: `app/actions/theme.ts`
- Modify: `hooks/useThemeToggle.ts`

- [ ] **Step 1: Create the Server Action**

```ts
// app/actions/theme.ts
'use server'

import { requireSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export async function updateUserTheme(theme: string) {
  const session = await requireSession()
  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme },
  })
}
```

- [ ] **Step 2: Wire into useThemeToggle with debounce**

Open `hooks/useThemeToggle.ts`. Add the import and debounced sync call:

```ts
// hooks/useThemeToggle.ts
'use client'

import { useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import { updateUserTheme } from '@/app/actions/theme'

export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggle = useCallback((buttonEl: HTMLElement | null) => {
    const nextTheme = resolvedTheme === 'light' ? 'dark' : 'light'

    // Debounce DB sync — fire-and-forget after 1s
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      updateUserTheme(nextTheme).catch(() => {/* silent — localStorage is authoritative */})
    }, 1000)

    if (resolvedTheme === 'light') {
      document.documentElement.classList.add('is-theme-transitioning')
      setTheme('dark')
      if (transitionTimer.current) clearTimeout(transitionTimer.current)
      transitionTimer.current = setTimeout(() => {
        document.documentElement.classList.remove('is-theme-transitioning')
      }, 350)
    } else {
      const rect = buttonEl?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

      const overlay = document.createElement('div')
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:9999', 'pointer-events:none',
        `clip-path:circle(0px at ${x}px ${y}px)`,
        'background:hsl(var(--background))',
        'transition:clip-path 500ms ease-in-out',
      ].join(';')
      document.body.appendChild(overlay)
      void overlay.getBoundingClientRect()
      overlay.style.clipPath = `circle(200vw at ${x}px ${y}px)`
      setTimeout(() => setTheme('light'), 250)
      setTimeout(() => overlay.remove(), 520)
    }
  }, [resolvedTheme, setTheme])

  return { resolvedTheme, toggle }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test DB sync**

1. Toggle dark mode in the browser
2. Wait 1.5s
3. Run in a separate terminal:

```bash
npx prisma studio
```

Open `http://localhost:5555`, find the User table, check that `theme` column updated to `"dark"` or `"light"`.

- [ ] **Step 5: Commit**

```bash
git add app/actions/theme.ts hooks/useThemeToggle.ts
git commit -m "feat(theme): add updateUserTheme Server Action with debounced sync"
```

---

## Task 13: API Route — /api/tips/generate

**Files:**
- Create: `app/api/tips/generate/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/tips/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { retrieveChunks } from '@/lib/ai/rag/retrieve'
import { getLLM } from '@/lib/ai/provider'
import { MASCOT_CONFIG, type AvatarKey } from '@/lib/mascots/config'

const querySchema = z.object({ courseId: z.string().min(1) })

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const userId = session.user.id

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  }
  const { courseId } = parsed.data

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarKey: true },
  })
  const personality = MASCOT_CONFIG[(user?.avatarKey ?? 'owl') as AvatarKey].personality

  const chunks = await retrieveChunks('interesting fact', userId, { courseId, topK: 3 })
  if (chunks.length === 0) {
    return NextResponse.json({ tip: null }, { status: 200 })
  }

  const context = chunks.map((c) => c.content).join('\n\n')

  const personalityInstruction: Record<string, string> = {
    witty:    'Be concise and add a clever observation or light pun. Max 1 sentence.',
    scholarly:'Quote or reference the concept formally. Add depth. Max 2 sentences.',
    chill:    'Keep it relaxed and encouraging. Add a relevant emoji at the end. Max 1 sentence.',
    playful:  'Make it fun and energetic. Use an exclamation. Max 1 sentence.',
    bold:     'State it as a powerful fact. Direct and confident. Max 1 sentence.',
    warm:     'Make it feel supportive and friendly. Max 1 sentence.',
  }

  const llm = getLLM()
  const result = await llm([
    {
      role: 'user',
      content: `From the following course material, extract ONE interesting fact and rewrite it in a ${personality} tone.
${personalityInstruction[personality]}
Respond with ONLY the tip text — no labels, no quotes, no explanation.

Material:
${context}`,
    },
  ])

  const tip = typeof result === 'string' ? result.trim() : result.content?.trim() ?? ''

  return NextResponse.json({ tip }, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. If `getLLM()` return type causes inference issues, check `lib/ai/provider.ts` for the exact return shape and adjust the `result` handling accordingly.

- [ ] **Step 3: Test with curl**

First get a session cookie by logging in, then:

```bash
curl -H "Cookie: <your-session-cookie>" \
  "http://localhost:3000/api/tips/generate?courseId=<a-real-course-id>"
```

Expected response:
```json
{"tip":"Some interesting fact from your course material."}
```

If no chunks exist for the courseId, expected:
```json
{"tip":null}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/tips/generate/
git commit -m "feat(tips): add /api/tips/generate RAG-powered endpoint"
```

---

## Usage: Wiring LoadingScreen into Pages

This plan builds the system. To wire `LoadingScreen` into any existing page or component, follow this pattern:

```tsx
// Example: show LoadingScreen while lesson data loads
'use client'
import { useState } from 'react'
import { LoadingScreen } from '@/components/loading/LoadingScreen'

export function LessonWrapper({ avatarKey, userId, courseId, topic, children }) {
  const [ready, setReady] = useState(false)

  if (!ready) {
    return (
      <LoadingScreen
        avatarKey={avatarKey}
        context="lesson"
        topic={topic}
        courseId={courseId}
        userId={userId}
      />
    )
  }
  return children
}
```

For the `uploading` context, pass a real `progress` prop (0–100) sourced from SSE or polling.

---

## Self-Review Checklist (completed inline)

- [x] **Spec coverage:** mascot config ✓, static tips ✓, RAG tips ✓, 4 animation styles + random ✓, typewriter ✓, tip swap ✓, all 4 contexts ✓, LoadingScreen layout ✓, next-themes ✓, DB field ✓, crossfade ✓, ripple with pointer-events:none ✓, clearTimeout guard ✓, userId in cache key ✓, updateUserTheme Server Action ✓, /api/tips/generate ✓
- [x] **Placeholder scan:** All steps have code or exact commands. No TBD/TODO.
- [x] **Type consistency:** `AvatarKey`, `LoadingContext`, `MascotConfig`, `Personality` defined in Task 1 and used consistently in Tasks 4–13. `useThemeToggle` signature stable from Task 10 through Task 12.
