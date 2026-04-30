# Design: Chunks 5, 7, 8 — Learning Map Gaps + AI Companion + Profile & Stats

**Date:** 2026-05-01  
**Approach:** Sequential C — F06 → F07 → F08

---

## Feature 06 — Learning Map (Gap Fill)

### Status
Core implementation is complete (~85%). Three targeted additions only.

### Additions

**1. Animated SVG Connector**
Replace the plain `<div>` connector between map nodes with an SVG `<line>` animated via Framer Motion `pathLength` (0→1). Drawn in on mount, duration 0.4s. Stagger delay = `index * 0.08s` so the path feels flowing on maps with many nodes. Color: violet for standard connectors, amber for pre-checkpoint. Implemented inline in `LearningMap.tsx` (≈15 lines, no separate file).

**2. Accessibility on `MapNode`**
- Locked: `aria-disabled="true"` + `title="Hoàn thành bài trước để mở khóa"`
- Available: `aria-label="{lesson.title} — {lesson.xpReward} XP — available"`
- Completed: `aria-label="{lesson.title} — completed"`

**3. Locked Node Tooltip**
CSS-only via existing `group` / `group-hover:opacity-100` pattern already on the node. Tooltip element must have `pointer-events: none` to avoid blocking clicks on nodes below it.

### Files changed
- `components/map/MapNode.tsx` — accessibility attrs + tooltip
- `components/map/LearningMap.tsx` — SVG connector inline

---

## Feature 07 — AI Companion (Full Implementation)

### Architecture

```
app/app/layout.tsx
  └── <CompanionBubble />          always mounted, reads pathname

components/companion/
  CompanionBubble.tsx              floating button + popover container
  CompanionChat.tsx                message list + input + streaming render

lib/companion/
  useCompanionContext.ts           pathname → typed context object

lib/ai/provider.ts
  + getLLMStream()                 new export, streaming variant of getLLM()

app/api/companion/route.ts         POST, streams via ReadableStream
```

### Context Hook

`useCompanionContext()` reads `usePathname()` and returns:

```ts
type CompanionContext =
  | { type: "lesson"; courseId: string; lessonId: string }
  | { type: "map";    courseId: string }
  | { type: "general" }
```

Pure URL parsing — no DB calls. Regex matches:
- `/app/learn/[courseId]/lesson/[lessonId]` → `lesson`
- `/app/learn/[courseId]` → `map`
- Everything else → `general`

### `/api/companion` Route (POST)

**Request body:**
```ts
{
  messages: { role: "user" | "assistant"; content: string }[];
  context: CompanionContext;
}
```

**Server flow:**
1. `requireSession()` — authenticated route.
2. Resolve context strings from DB (lesson title, course title/topic) using IDs from `context`. One query, select only title fields. Results cached in a module-level `Map<string, { title: string; topic?: string }>` with 5-minute TTL — avoids re-fetching same course/lesson data on every message in a conversation.
3. Build system prompt with injected context strings.
4. Call `getLLMStream()`, pipe to `ReadableStream`.
5. Stream tokens as `data: <token>\n\n` SSE. Send `data: [DONE]\n\n` sentinel at end.

**`getLLMStream()` in `lib/ai/provider.ts`:**
New export alongside existing `getLLM()`. Uses provider-native streaming APIs (OpenAI `stream: true`, Gemini `sendMessageStream`, Ollama stream mode). Returns `AsyncIterable<string>` (token chunks).

### System Prompt Templates

```
general:
"You are an AI learning assistant for {userName}. Answer in Vietnamese, concisely."

map:
"You are an AI learning assistant for {userName}. They are viewing the learning map
for course '{courseTitle}' (topic: {courseTopic}). Answer questions about this course
in Vietnamese, concisely."

lesson:
"You are an AI learning assistant for {userName}. They are currently doing lesson
'{lessonTitle}' in course '{courseTitle}'. Answer questions about this lesson in
Vietnamese, using examples. Be concise."
```

### `CompanionBubble` Component

- Fixed position: `bottom-6 right-6 z-50`.
- Violet gradient circle, 56px. Click toggles `isOpen` (local state).
- When open: popover panel `320px × 480px`, slides up via `framer-motion`. `flex flex-col h-full`.
- Passes `context` from `useCompanionContext()` to `<CompanionChat>`.

### `CompanionChat` Component

- Layout: `flex flex-col h-full`. Messages: `flex-1 overflow-y-auto`. Input row: `flex-shrink-0`.
- Messages stored in local state `Message[]`. Auto-scroll to bottom on new token.
- On submit: append user message → POST `/api/companion` with messages + context → read `ReadableStream` chunk-by-chunk → append tokens to last assistant message in state.
- Stream termination: detect `[DONE]` sentinel = clean end. If stream closes without `[DONE]`, show error message: "Companion gặp sự cố, thử lại nhé."
- Markdown: bold (`**`), italic (`*`), inline code (`` ` ``) rendered inline — no markdown lib needed.

### Files created/modified
- `components/companion/CompanionBubble.tsx` — new
- `components/companion/CompanionChat.tsx` — new
- `lib/companion/useCompanionContext.ts` — new
- `lib/ai/provider.ts` — add `getLLMStream()` export
- `app/api/companion/route.ts` — new
- `app/app/layout.tsx` — add `<CompanionBubble />`
- `app/app/companion/page.tsx` — replace placeholder with `<CompanionChat>` full-page variant

### Out of scope
Proactive notifications (streak warnings, milestone nudges via SSE polling) — deferred to a future session.

---

## Feature 08 — Profile & Statistics (Full Implementation)

### Architecture

```
app/api/profile/[userId]/route.ts    GET, public — no auth required
lib/profile/badges.ts                deriveBadges(data) — pure function

components/profile/
  IdentityBlock.tsx                  avatar + name + XP + streak + league badge
  ProfileTabs.tsx                    tab switcher + 3 tab panels
  ActivityHeatmap.tsx                12-month CSS grid
  XPChart.tsx                        recharts BarChart, 8-week
  BadgeGrid.tsx                      earned (color) + locked (greyscale + lock icon)
  CourseStatCard.tsx                 per-course progress bar + accuracy stat

app/app/profile/page.tsx             own profile
app/app/profile/[userId]/page.tsx    public profile view (same layout)
```

### `/api/profile/[userId]` (GET)

Public route — no `requireSession()`. Four parallel queries via `Promise.all`:

1. `User` + `UserGamification` + `StreakRecord` + `LeagueEntry` (current weekId)
2. `LessonProgress` with `include: { lesson: { include: { chapter: true } } }` to traverse `LessonProgress → Lesson → Chapter → Course` (there is no direct `courseId` on `LessonProgress`). Group client-side by `lesson.chapter.courseId`: completion count, avg `score` (accuracy).
3. `Transaction` where `type = "earn_xp"`, last 8 ISO weeks → `{ week, xp }[]`
4. Raw SQL: `LessonProgress.completedAt` last 12 months, grouped by `DATE(completedAt AT TIME ZONE 'Asia/Ho_Chi_Minh')` → `{ date, count }[]`

Returns single combined JSON object.

### `deriveBadges(data)` — `lib/profile/badges.ts`

Pure function — takes data already fetched, no extra DB queries.

| Badge | Condition |
|---|---|
| Streak 7 | `streakRecord.currentStreak >= 7` |
| Streak 30 | `streakRecord.currentStreak >= 30` |
| Streak 100 | `streakRecord.currentStreak >= 100` |
| Perfect score | any `LessonProgress` with `score === 100` |
| Course complete | any course where `completed === total` |
| League promoted | any `LeagueEntry` with `promoted === true` |

Returns `Badge[]` with `{ id, label, icon, earned: boolean }`. No new DB migration needed — `perfect` derived from `score === 100`.

### Profile Page Layout

```
<IdentityBlock />          ← always visible, outside tabs
  avatar | name | XP | streak | league badge

<ProfileTabs defaultTab="overview">
  Overview:
    <ActivityHeatmap />    ← 12-month CSS grid
    <BadgeGrid />          ← earned + locked badges
    daily quest summary    ← own profile only; fetched separately on the page (not via profile API);
                             shows completed/total count for today. Hidden on public profile.

  Stats:
    <XPChart />            ← recharts BarChart, 8 weeks
    streak stats           ← current, longest, freeze count

  Courses:
    <CourseStatCard />[]   ← one per enrolled course
</ProfileTabs>
```

### `ActivityHeatmap`

Pure CSS grid — no external lib. 52 columns (weeks) × 7 rows (days), rendered from `{ date, count }[]`. Color via Tailwind classes:
- 0: `bg-muted`
- 1: `bg-green-200`
- 2: `bg-green-400`
- 3+: `bg-green-600`

Tooltip via `title` attribute on each cell (native browser tooltip). No Radix needed.

### `XPChart`

`recharts` `BarChart`. Install: `npm i recharts`. X-axis = week label (e.g. "W18"), Y-axis = XP. Single bar series, `fill="#7c3aed"`.

### Own vs Public Profile

- `app/app/profile/page.tsx` — gets userId from session server-side, fetches `/api/profile/[userId]`.
- `app/app/profile/[userId]/page.tsx` — uses URL param, fetches same route.
- Same component tree. No edit controls on either page (profile editing out of scope).

### Leaderboard
Already fully implemented. No changes.

### Dependencies to install
```bash
npm i recharts
```

---

## Implementation Order (Approach C)

1. **F06** — Map gaps (accessibility + tooltip + SVG connector). Fast, low risk. Commit.
2. **F07** — AI Companion (provider stream + API route + components + layout injection). Commit.
3. **F08** — Profile & Stats (API + badge logic + components + page). Commit.
