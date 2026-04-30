# Design: Personalized Loading Screen + Dark Mode

**Date:** 2026-04-30
**Status:** Approved

---

## Feature 1 — Personalized Loading Screen with Mascot

### Overview

Full-screen immersive loading overlay that renders instantly on route changes, lesson transitions, AI generation waits, and upload processing. Background color matches the user's chosen mascot accent color. Mascot animates with a randomly-selected CSS keyframe animation. Tip text appears with a typewriter effect.

---

### Data Layer

No new DB fields needed. The existing `User.avatarKey` field (`owl | fox | panda | dragon | bear | cat`) doubles as the mascot identifier.

Each `avatarKey` maps to a config object in `lib/mascots/config.ts`:

```ts
// AvatarKey is derived from the Prisma enum: type AvatarKey = 'owl'|'fox'|'panda'|'dragon'|'bear'|'cat'
export const MASCOT_CONFIG: Record<AvatarKey, MascotConfig> = {
  fox:    { accent: '#f97316', darkAccent: '#7c2d12', personality: 'witty'    },
  owl:    { accent: '#7c3aed', darkAccent: '#3b0764', personality: 'scholarly' },
  panda:  { accent: '#10b981', darkAccent: '#064e3b', personality: 'chill'    },
  cat:    { accent: '#ec4899', darkAccent: '#831843', personality: 'playful'  },
  dragon: { accent: '#ef4444', darkAccent: '#7f1d1d', personality: 'bold'     },
  bear:   { accent: '#f59e0b', darkAccent: '#78350f', personality: 'warm'     },
}
```

`darkAccent` = accent darkened ~40% + desaturated ~20%, used for loading screen background in dark mode.

---

### Component Structure

```
components/loading/
├── LoadingScreen.tsx       ← orchestrator
├── MascotAnimation.tsx     ← random CSS animation per mount
├── TipDisplay.tsx          ← typewriter effect, handles tip swap
└── ContextualProgress.tsx  ← spinner | bar | dots depending on context
```

**`LoadingScreen` props:**

```ts
interface LoadingScreenProps {
  mascotKey: AvatarKey
  context: 'lesson' | 'generating' | 'uploading' | 'transition'
  topic?: string      // selects static tip pool
  courseId?: string   // for RAG tip cache lookup
  userId?: string     // for RAG tip cache key scoping
  progress?: number   // 0–100, for 'uploading' context bar
}
```

---

### Mascot Animation

`MascotAnimation` picks one of four CSS keyframe animations on mount via `useMemo`. The same animation runs for the entire loading duration — no mid-load switching.

```ts
const ANIMATIONS = ['bounce', 'breathe', 'float', 'wiggle'] as const
type AnimKey = typeof ANIMATIONS[number]

// In component:
const anim = useMemo<AnimKey>(
  () => ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)],
  []
)
```

**Keyframe definitions** (in `globals.css` or a colocated CSS module):

```css
@keyframes mascot-bounce  { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-18px)} }
@keyframes mascot-breathe { 0%,100%{transform:scale(1)}         50%{transform:scale(1.08)} }
@keyframes mascot-float   { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-12px) rotate(3deg)} }
@keyframes mascot-wiggle  { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-12deg)} 40%{transform:rotate(12deg)} 60%{transform:rotate(-8deg)} 80%{transform:rotate(8deg)} }
```

---

### Tip System

**Two sources, zero blocking:**

**Source 1 — Static tips (zero latency):**
- `lib/tips/[topic].ts` exports an array of ~30 pre-written tips per topic
- `LoadingScreen` picks one randomly on first render — shown immediately, no API needed
- Tips are written in a neutral, informative tone — no per-personality variants for static tips (personality rewriting is only applied in the RAG path via LLM)

**Source 2 — RAG tips (background, non-blocking):**
- Cache key: `` `rag-tip-${userId}-${courseId}` `` in `localStorage`
  - `userId` is required in the key to prevent cross-user cache leakage on shared browsers
- On mount, `useEffect` checks localStorage. If miss, fires `GET /api/tips/generate?courseId=X`
- Endpoint: RAGs into user's document chunks, extracts a fact, rewrites via LLM using mascot personality
- If tip arrives before loading completes → swap with fade-in (200ms opacity transition)
- If loading completes first → ignore arriving tip, never block

**`TipDisplay` behavior:**
- Typewriter effect: `setInterval` appending one character every ~30ms
- On tip swap: reset typewriter from beginning with new text
- `aria-live="polite"` for accessibility

---

### Context Behavior

| `context`     | Status message                          | Progress indicator          |
|---------------|------------------------------------------|-----------------------------|
| `lesson`      | "Đang chuẩn bị bài học..."              | Indeterminate bar           |
| `generating`  | "AI đang đọc tài liệu của bạn..."       | Spinner                     |
| `uploading`   | "Đang xử lý tài liệu..."               | Determinate bar (via `progress` prop) |
| `transition`  | _(none)_                                | 3-dot pulse in corner only  |

---

### Visual Layout

- Full-screen fixed overlay (`position: fixed; inset: 0; z-index: 50`)
- Background: `MASCOT_CONFIG[mascotKey].accent` (light mode) / `MASCOT_CONFIG[mascotKey].darkAccent` (dark mode)
- Mascot: centered, ~180px diameter, sits at vertical ~35% of screen
- Tip text: below mascot, max-width 320px, `text-white/90`
- Progress indicator: pinned to bottom, 48px from edge
- Mount: fade-in over 150ms. Unmount: fade-out over 200ms, then parent renders page content

---

### API Route: `/api/tips/generate`

- Auth-gated (`getSession()` on first line)
- Input: `courseId` (string), validated with Zod
- Fetches up to 3 relevant chunks from user's course via existing RAG pipeline
- Prompts LLM: extract one interesting fact, rewrite in `personality` tone of user's mascot
- Returns: `{ tip: string }`
- Response cached at edge for 1 hour per `(userId, courseId)` pair

---

## Feature 2 — Dark Mode

### Overview

System-aware dark mode using `next-themes`. Theme persists in `localStorage` for instant load (no flash) and syncs to `User.theme` in DB for cross-device persistence. Toggle lives in sidebar footer. Transition is asymmetric: crossfade when switching to dark, ripple expand when switching to light.

---

### Library

Install `next-themes`. Add `ThemeProvider` inside the existing `components/providers.tsx` (which is already imported by `app/layout.tsx`):

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="lf-theme">
  {children}
</ThemeProvider>
```

`next-themes` writes `class="dark"` on `<html>` — Tailwind's `dark:` prefix activates automatically.

---

### DB Schema Change

Add to `User` model in `prisma/schema.prisma`:

```prisma
theme String? @default("system")  // "light" | "dark" | "system"
```

**Sync flow:**
- On session load, read `User.theme` from DB → pass to `ThemeProvider` as `forcedTheme` only if user has a non-system preference
- On toggle, update `localStorage` immediately (next-themes handles this), then call a Server Action `updateUserTheme(theme)` debounced by 1000ms — fire-and-forget, no await

---

### Toggle Component

Location: sidebar footer, below nav items.

```tsx
// Icon: Sun when dark (click → go light), Moon when light (click → go dark)
<button onClick={handleToggle} aria-label="Toggle theme">
  {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
</button>
```

`handleToggle` calls `useThemeToggle()` hook instead of `setTheme` directly (see transition section).

---

### Transition: Asymmetric

Implemented in `hooks/useThemeToggle.ts`. Exported and used by the sidebar toggle button.

**Light → Dark (crossfade, 300ms):**

1. Add `is-theme-transitioning` class to `<html>`
2. Call `setTheme('dark')`
3. Clear any existing timer, then set new timer to remove class after 350ms:

```ts
clearTimeout(transitionTimer.current)
transitionTimer.current = setTimeout(() => {
  document.documentElement.classList.remove('is-theme-transitioning')
}, 350)
```

CSS (in `globals.css`):

```css
html.is-theme-transitioning *,
html.is-theme-transitioning *::before,
html.is-theme-transitioning *::after {
  transition: background-color 300ms ease, color 300ms ease,
              border-color 300ms ease, fill 300ms ease !important;
}
```

Scoping transitions to `is-theme-transitioning` prevents unwanted transitions during scroll/resize/hover.

**Dark → Light (ripple, 500ms):**

1. Get toggle button coordinates via `getBoundingClientRect()`
2. Create overlay `<div>` appended to `document.body`:
   - `position: fixed; inset: 0; z-index: 9999`
   - `pointer-events: none` — clicks pass through during the animation
   - `clip-path: circle(0px at {x}px {y}px)`
   - `background: var(--bg-primary)` (light mode background color)
3. Trigger reflow, then animate: `clip-path → circle(200vw at {x}px {y}px)` over 500ms ease-in-out
4. At 250ms mark: call `setTheme('light')`
5. At 520ms: remove overlay div

---

### Color Tokens

Defined in `globals.css` as CSS custom properties, consumed via Tailwind where possible:

```css
:root {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f9fafb;
  --text-primary:  #111827;
  --border:        #e5e7eb;
  --accent:        #7c3aed;
  --amber:         #f59e0b;
}
.dark {
  --bg-primary:    #111827;
  --bg-secondary:  #1f2937;
  --text-primary:  #f9fafb;
  --border:        #374151;
  --accent:        #a78bfa;
  --amber:         #fbbf24;
}
```

---

### Loading Screen in Dark Mode

`LoadingScreen` reads current theme from `useTheme()`:

```ts
const { resolvedTheme } = useTheme()
const bgColor = resolvedTheme === 'dark'
  ? MASCOT_CONFIG[mascotKey].darkAccent
  : MASCOT_CONFIG[mascotKey].accent
```

Tip text: `text-white/90` in both modes (works on both accent and darkAccent backgrounds).
Mascot image/emoji: unchanged — no invert filter.

---

## Out of Scope

- Lottie animation files (using CSS keyframes instead)
- Per-exercise-type mascot reactions
- Mascot speaking animations triggered by specific answer outcomes
- High-contrast accessibility mode
