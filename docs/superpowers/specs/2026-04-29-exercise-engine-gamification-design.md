# Design: Exercise Engine + Gamification (Features 04 + 05)

**Date:** 2026-04-29  
**Scope:** Chunk 3 (MVP) + Chunk 4 (Full Gamification) combined  
**Approach:** Service layer — thin API handlers delegating to focused lib modules

---

## Decisions Made

| Question | Decision |
|---|---|
| Chunk scope | Full Feature 04 + Full Feature 05 (Chunks 3 + 4) in one pass |
| Wrong answer behavior | Advance to next exercise (Duolingo-style), score recorded |
| Code editor | `react-simple-code-editor` + Prism now; Monaco-swappable via `CodeEditor` interface |
| Drag & drop | `@dnd-kit/sortable` for Ordering; Matching uses click-to-pair (no drag) |
| State sync | React Query; `useExercise` invalidates `['gamification']` after each submit |

---

## Architecture

### Submit Flow

```
POST /api/lessons/[id]/submit
  1. getSession() — auth guard
  2. fetch exercise from DB (with correctAnswer)
  3. validateAnswer(exercise, answer) → boolean

  4. if wrong:
       deductHeart(userId) → { heartsRemaining, heartsExhausted }
       return { correct: false, explanation, heartsRemaining, heartsExhausted }

  5. if lesson not yet complete:
       return { correct: true, explanation, heartsRemaining: current }

  6. if lesson complete:
       a. idempotency guard: check LessonProgress.status !== "completed"
          → if already completed, return early (no double-award)

       b. prisma.$transaction([
            upsert LessonProgress { status:"completed", score, xpEarned, completedAt },
            awardXp(userId, xp, reason, tx),
            awardGems(userId, gems, reason, tx),
            recordActivity(userId, tx),
            updateQuestProgress(userId, { lessonCompleted, xpEarned, perfectScore }, tx)
          ])

       c. after transaction: unlockNextLesson(lessonId, userId)  ← outside transaction

       d. return { correct: true, explanation, heartsRemaining, heartsExhausted: false,
                   xpEarned, gemsEarned, streakDay, lessonComplete: true }
```

**Timezone rule:** All "today" comparisons use `YYYY-MM-DD` date string in UTC+7.  
`StreakRecord.lastActivityDate` is stored as `String`, not `DateTime`.  
Cron string: `"5 17 * * *"` UTC = 00:05 UTC+7.

---

## Service Modules

### `lib/exercise/`

| File | Exports |
|---|---|
| `validate.ts` | `validateAnswer(exercise, answer): boolean` — per-type: exact, case-insensitive-trim, array-order, set-of-pairs, whitespace-normalized |
| `unlock.ts` | `unlockNextLesson(lessonId, userId): Promise<void>` — finds next lesson by order; crosses chapter boundary if needed; upserts LessonProgress `"available"` |

### `lib/gamification/`

| File | Exports |
|---|---|
| `xp.ts` | `calculateXp(lessonType, perfect): { xp, gems }` · `awardXp(userId, xp, reason, tx?)` |
| `gems.ts` | `awardGems(userId, gems, reason, tx?)` · `spendGems(userId, amount, reason)` → throws `InsufficientGemsError` |
| `hearts.ts` | `deductHeart(userId): { heartsRemaining, heartsExhausted }` · `computeHearts(gamification): { hearts, nextRefillAt }` (pure, no DB) · `persistHeartRefill(userId)` (write, called on exercise screen open) · `refillAllWithGems(userId)` |
| `streak.ts` | `recordActivity(userId, tx?)` — uses `lastActivityDate` string; increments streak if new day; checks milestones · `checkAndResetStreaks()` — cron target · `consumeFreeze(userId)` — guards: no freezes → `NoFreezesError`; already frozen today → return early |
| `quests.ts` | `updateQuestProgress(userId, { lessonCompleted, xpEarned, perfectScore }, tx?)` · `getUserQuests(userId): Promise<DailyQuestProgress[]>` |
| `league.ts` | `addWeeklyXp(userId, xp)` · `finalizeWeek(weekId)` · `getCurrentWeekId(): string` |

### `lib/errors.ts`

```ts
InsufficientGemsError  → HTTP 400
NoFreezesError         → HTTP 400
NoHeartsError          → HTTP 403
LessonNotAvailableError → HTTP 403
```

All `tx?` parameters accept an optional Prisma transaction client. When omitted, functions use the global prisma singleton.

---

## API Routes

```
GET  /api/lessons/[id]
  → calls persistHeartRefill(userId) — writes any elapsed heart refill to DB
  → return lesson + exercises (correctAnswer EXCLUDED) + user's LessonProgress

POST /api/lessons/[id]/submit
  → body: { exerciseId, answer, timeSpentMs }  (Zod validated)
  → full submit flow above

GET  /api/gamification/me
  → NO DB writes — computeHearts() is pure calculation
  → return { streak, hearts (computed), nextRefillAt, gems, totalXp, weeklyXp, quests }

POST /api/gamification/shop
  → body: { item: "streak_freeze" | "heart_refill" | "cosmetic_theme" | "weekend_shield" }
  → "heart_refill": prisma.$transaction([ spendGems(150), setHearts(maxHearts) ])
  → "streak_freeze": prisma.$transaction([ spendGems(100), incrementFreezes(+1) ])
  → return updated UserGamification

POST /api/gamification/streak/freeze
  → guard 1: streakFreezes === 0 → NoFreezesError
  → guard 2: frozenAt === todayString → return early
  → consumeFreeze(userId)

GET  /api/leaderboard?courseId=
  → LeagueEntry for current weekId scoped by course topic, ranked list
```

---

## Frontend

### State Management Rule

`useExercise` is the single source of truth during a lesson. After each submit response:
1. Updates local `heartsRemaining`
2. Calls `queryClient.invalidateQueries(['gamification'])` to sync `useGamification`

No parallel truth sources for hearts state.

### Hooks

| Hook | Responsibility |
|---|---|
| `useExercise(lessonId)` | Lesson state machine: `currentIndex`, `results[]`, `isComplete`, `heartsRemaining` |
| `useGamification()` | React Query fetch of `/api/gamification/me`; invalidated after submit |
| `useHearts()` | Derived from `useGamification`; countdown timer to `nextRefillAt` |

### Exercise Components (`components/exercise/`)

| Component | Notes |
|---|---|
| `ExerciseScreen.tsx` | Orchestrator; renders current type + FeedbackOverlay + ProgressBar + HeartDisplay |
| `ProgressBar.tsx` | Filled segments: `currentIndex / total` |
| `HeartDisplay.tsx` | N heart icons; animates on loss |
| `FeedbackOverlay.tsx` | Green/red banner + explanation; "Continue" advances index |
| `ResultScreen.tsx` | XP, accuracy %, streak day, "Continue" button |
| `ExerciseLoading.tsx` | Skeleton for client-side navigation loading state |

### Exercise Types (`components/exercise/types/`)

| Component | Key Detail |
|---|---|
| `MultipleChoice.tsx` | 2×2 grid; selected state; confirm button |
| `TrueFalse.tsx` | Two buttons; immediate submit on click |
| `FillBlank.tsx` | Sentence with `___` → `<input>`; submit button |
| `Matching.tsx` | Click left → highlight + cursor hint right; second left click deselects; left click on paired item replaces pair |
| `Ordering.tsx` | `@dnd-kit/sortable` vertical list; submit button |
| `CodeFillBlank.tsx` | `<pre>` static + inline `<input>` at blanks; abstracted behind `CodeEditor` interface for future Monaco swap |

### Gamification Components (`components/gamification/`)

`StreakBadge`, `GemCounter`, `XPBar`, `LeagueBadge`, `DailyQuest`, `StreakFreezeModal`, `NoHeartsModal`

### Pages

| Route | Type | Notes |
|---|---|---|
| `app/(app)/learn/[courseId]/lesson/[lessonId]/page.tsx` | Server component | Fetches lesson; passes to `<ExerciseScreen>` |
| `app/(app)/shop/page.tsx` | Client | Item grid with gem costs + buy buttons |
| `app/(app)/leaderboard/page.tsx` | Client | Weekly league table; user's rank highlighted |

---

## Cron Jobs (pg-boss schedules)

| Job | Schedule (UTC) | Action |
|---|---|---|
| `streak-daily-check` | `5 17 * * *` (= 00:05 UTC+7) | `checkAndResetStreaks()` |
| `league-weekly-reset` | `0 17 * * 0` (= 00:00 UTC+7 Monday) | `finalizeWeek(prevWeekId)` + reset `weeklyXp` |

Heart refill is computed lazily (`computeHearts`) — no recurring job needed.

---

## Dependencies to Add

```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
react-simple-code-editor
prismjs
@types/prismjs
@tanstack/react-query        (if not already present)
@tanstack/react-query-devtools
```

---

## XP & Gem Rewards (from spec)

```
Standard lesson complete:       +10 XP,  +0 gems
Perfect score (no mistakes):    +15 XP,  +5 gems
Checkpoint lesson complete:     +25 XP, +15 gems
Daily quest complete:           +10–30 gems (varies)
Streak milestone 7-day:         +30 gems
Streak milestone 30-day:        +100 gems
```

---

## Acceptance Criteria

- [ ] All 6 exercise types render and accept input
- [ ] Correct answer → green feedback → progress advances
- [ ] Wrong answer → red feedback + 1 heart deducted → advance to next exercise
- [ ] Hearts at 0 → `NoHeartsModal` shown; submit blocked
- [ ] Completing lesson → idempotent XP/gem award → ResultScreen
- [ ] Next lesson unlocked in DB after completion
- [ ] Streak increments once per day; does not double-count
- [ ] Streak resets at 00:05 UTC+7 for inactive users (cron)
- [ ] Freeze prevents one missed day; idempotent (one freeze per day)
- [ ] Gem spend fails gracefully when balance insufficient
- [ ] `GET /api/gamification/me` has no DB write side effects
- [ ] League leaderboard shows correct weekly ranking by topic
- [ ] Shop purchases are atomic (gems + item granted together or not at all)
