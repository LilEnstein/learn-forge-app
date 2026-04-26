# Plan — Feature 05: Gamification Engine

## Prerequisites
- Feature 04 (Exercise Engine) triggers XP/gem/streak updates on lesson completion
- Prisma models: UserGamification, StreakRecord, DailyQuest, DailyQuestProgress, LeagueEntry, Transaction

---

## Implementation Steps

### Step 1 — Prisma schema & migration
- [ ] Add all gamification models to `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name add-gamification`
- [ ] Seed DailyQuest records (3 quest templates)

### Step 2 — XP logic
- [ ] Create `lib/gamification/xp.ts`
  - `calculateXp(lessonType: string, perfect: boolean): { xp, gems }`
  - Standard + perfect: `{ xp: 15, gems: 5 }`; standard: `{ xp: 10, gems: 0 }`; checkpoint: `{ xp: 25, gems: 15 }`
  - `awardXp(userId, amount, reason): Promise<void>` — updates UserGamification + writes Transaction

### Step 3 — Gems logic
- [ ] Create `lib/gamification/gems.ts`
  - `awardGems(userId, amount, reason): Promise<void>` — updates UserGamification + Transaction
  - `spendGems(userId, amount, reason): Promise<void>` — validates balance, deducts, writes Transaction
  - Throws `InsufficientGemsError` if balance < amount

### Step 4 — Hearts logic
- [ ] Create `lib/gamification/hearts.ts`
  - `deductHeart(userId): Promise<UserGamification>` — decrements hearts, sets lastHeartAt
  - `refillHearts(userId): Promise<void>` — compute hearts earned since lastHeartAt (1 per 30 min), cap at maxHearts
  - `refillAllWithGems(userId): Promise<void>` — calls `spendGems(150)` then sets hearts = maxHearts
  - `getHearts(userId): Promise<{ hearts, maxHearts, nextRefillAt }>`

### Step 5 — Streak logic
- [ ] Create `lib/gamification/streak.ts`
  - `recordActivity(userId): Promise<StreakRecord>` — upsert lastActivityAt, increment streak if new day
  - `checkAndResetStreaks(): Promise<void>` — cron target: iterate users with lastActivityAt < yesterday, reset streak (unless frozenAt = yesterday)
  - `consumeFreeze(userId): Promise<void>` — deduct 1 streakFreeze, set frozenAt = today
  - `checkMilestone(streak: number): number` — returns gem reward for milestone streak values

### Step 6 — League logic
- [ ] Create `lib/gamification/league.ts`
  - `addWeeklyXp(userId, xp): Promise<void>` — upsert LeagueEntry for current weekId
  - `finalizeWeek(weekId: string): Promise<void>` — rank all entries, set promoted/relegated flags
  - `getCurrentWeekId(): string` — returns ISO week string e.g. `"2024-W23"`

### Step 7 — Daily quests
- [ ] `lib/gamification/quests.ts`
  - `getUserQuests(userId): Promise<DailyQuestProgress[]>` — fetch or create today's 3 quest progress records
  - `updateQuestProgress(userId, type, increment): Promise<void>` — update matching quest, mark complete + award gems if target reached

### Step 8 — Gamification API routes
- [ ] `app/api/gamification/me/route.ts` (GET)
  - Return `{ streak, hearts, nextRefillAt, gems, totalXp, weeklyXp, quests }`
  - Calls `refillHearts` to update stale heart count before returning
- [ ] `app/api/gamification/shop/route.ts` (POST)
  - Body: `{ item: "streak_freeze" | "heart_refill" | "cosmetic_theme" | "weekend_shield" }`
  - Dispatch to appropriate spend function
  - Return updated UserGamification
- [ ] `app/api/gamification/streak/freeze/route.ts` (POST)
  - Calls `consumeFreeze(userId)`

### Step 9 — Cron jobs (pg-boss schedules)
- [ ] Register schedule `streak-daily-check` — `0 5 * * *` (00:05 UTC+7 = 17:05 UTC)
  - Calls `checkAndResetStreaks()`
- [ ] Register schedule `league-weekly-finalize` — `0 0 * * 1` (Monday 00:00 UTC+7)
  - Calls `finalizeWeek(previousWeekId)`, then resets weeklyXp for new week
- [ ] Register repeating job for heart refill — per-user, scheduled when hearts < max

### Step 10 — Gamification UI components
- [ ] `components/gamification/StreakBadge.tsx` — flame icon + day count
- [ ] `components/gamification/GemCounter.tsx` — gem icon + count
- [ ] `components/gamification/XPBar.tsx` — XP bar with level thresholds
- [ ] `components/gamification/LeagueBadge.tsx` — tier icon + label
- [ ] `components/gamification/DailyQuest.tsx` — progress bar per quest + gem reward
- [ ] `components/gamification/StreakFreezeModal.tsx` — confirm freeze purchase dialog
- [ ] Hook: `hooks/useGamification.ts` — fetches `/api/gamification/me`, exposes all state
- [ ] Hook: `hooks/useStreak.ts` — streak + freeze actions
- [ ] Hook: `hooks/useHearts.ts` — hearts count + refill countdown

### Step 11 — Shop & Leaderboard pages
- [ ] `app/(app)/shop/page.tsx` — item grid with gem costs, buy buttons
- [ ] `app/(app)/leaderboard/page.tsx` — weekly league table, user's rank highlighted

---

## Acceptance Criteria
- [ ] Completing a lesson awards correct XP and gems, reflected immediately in UI
- [ ] Wrong answer deducts 1 heart; UI updates instantly
- [ ] Hearts refill over time (verifiable by manipulating `lastHeartAt` in test)
- [ ] Streak increments on first lesson of a new day, does not double-count same day
- [ ] Streak resets to 0 at 00:05 for users who skipped yesterday (cron test)
- [ ] Freeze prevents streak reset for one missed day
- [ ] Gem spend fails gracefully when balance is insufficient
- [ ] League leaderboard shows correct weekly ranking by topic
