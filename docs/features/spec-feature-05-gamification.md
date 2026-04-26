# Feature 05 — Gamification Engine

## Overview
Duolingo-style gamification: streak tracking, hearts system, XP + gems economy, daily quests, and a weekly league leaderboard.

---

## User Stories
- As a user, my streak increases each day I complete at least one lesson
- As a user, I lose 1 heart per wrong answer; hearts refill over time
- As a user, I earn XP and gems for completing lessons and daily quests
- As a user, I can spend gems in the shop (streak freeze, heart refill, cosmetics)
- As a user, I compete weekly in a league ranked by XP earned that week
- As a user, I receive daily quests that reset at midnight and reward gems

---

## Streak System
- **Earn:** Complete at least 1 lesson per day (UTC+7 timezone)
- **Reset:** Missed day resets streak to 0 (unless a freeze is active)
- **Freeze:** Consuming 1 Streak Freeze preserves streak across one missed day
- **Milestones:**
  - 7-day streak → +30 gems
  - 30-day streak → +100 gems
  - 100-day streak → special badge
- **Cron job:** Runs 00:05 daily — checks and resets streak for inactive users

---

## Hearts System
- Default: 5 hearts
- Lose 1 heart per wrong answer
- Refill rate: 1 heart per 30 minutes (automatic)
- Unlimited hearts: Pro users
- Refill with gems: 150 gems → full hearts
- No hearts remaining: modal with options — "Wait for refill" or "Use gems"

---

## XP & Gems Earned
```
Standard lesson complete:          +10 XP,  +0 gems
Perfect score (no mistakes):       +15 XP,  +5 gems
Checkpoint lesson complete:        +25 XP, +15 gems
Daily quest complete:              +10-30 gems (varies by quest)
Streak milestone (7/30/100 days):  +30-100 gems
```

---

## Gem Economy
```
Earn:  Daily quests, streak milestones, perfect scores, invite friends
Spend:
  Streak Freeze:      100 gems
  Heart Refill:       150 gems
  Cosmetic themes:    500 gems
  Weekend Shield:     200 gems
```

---

## Daily Quests (3 per day, reset at 00:00)
```
1. Complete 1 lesson         → +20 gems
2. Earn 50 XP today          → +25 gems
3. No mistakes in 1 lesson   → +30 gems
```

---

## League System
- Ranked by weekly XP; resets every Monday
- 5 tiers: Bronze → Silver → Gold → Platinum → Diamond
- Top 3 → promoted; bottom 5 (if enough members) → relegated
- Leaderboard scoped by topic (prevents unfair cross-topic comparison)

---

## Database Models

```prisma
model UserGamification {
  id            String    @id @default(cuid())
  userId        String    @unique
  gems          Int       @default(0)
  totalXp       Int       @default(0)
  weeklyXp      Int       @default(0)
  hearts        Int       @default(5)
  maxHearts     Int       @default(5)
  lastHeartAt   DateTime?
  streakFreezes Int       @default(0)
  user          User      @relation(fields: [userId], references: [id])
}

model StreakRecord {
  id             String    @id @default(cuid())
  userId         String    @unique
  currentStreak  Int       @default(0)
  longestStreak  Int       @default(0)
  lastActivityAt DateTime?
  frozenAt       DateTime?
  user           User      @relation(fields: [userId], references: [id])
}

model DailyQuest {
  id          String @id @default(cuid())
  type        String // "complete_lesson" | "earn_xp" | "perfect_score" | "no_mistakes"
  title       String
  description String
  target      Int
  gemReward   Int
  xpReward    Int
}

model DailyQuestProgress {
  id        String   @id @default(cuid())
  userId    String
  questId   String
  date      DateTime @default(now())
  progress  Int      @default(0)
  completed Boolean  @default(false)
  user      User     @relation(fields: [userId], references: [id])
  @@unique([userId, questId, date])
}

model LeagueEntry {
  id        String  @id @default(cuid())
  userId    String
  league    String  // "bronze" | "silver" | "gold" | "platinum" | "diamond"
  weekId    String  // e.g. "2024-W23"
  weeklyXp  Int     @default(0)
  rank      Int?
  promoted  Boolean @default(false)
  relegated Boolean @default(false)
  user      User    @relation(fields: [userId], references: [id])
  @@unique([userId, weekId])
}

model Transaction {
  id        String   @id @default(cuid())
  userId    String
  type      String   // "earn_gems" | "spend_gems" | "earn_xp" | "earn_streak_freeze"
  amount    Int
  reason    String   // "lesson_complete" | "purchase_freeze" | "daily_quest" ...
  createdAt DateTime @default(now())
}
```

---

## API Routes
```
GET  /api/gamification/me                  # Current user's streak, hearts, gems, XP, quests
POST /api/gamification/shop                # Purchase item with gems
POST /api/gamification/streak/freeze       # Consume a streak freeze
GET  /api/leaderboard?courseId=            # Weekly league leaderboard by topic
```

---

## Key Files
```
lib/gamification/
  streak.ts        # Streak increment, reset, freeze logic
  hearts.ts        # Heart deduction, timed refill
  xp.ts            # XP calculation per lesson type
  gems.ts          # Earn/spend gem logic + Transaction writes
  league.ts        # Weekly league ranking, promotion/relegation
components/gamification/
  StreakBadge.tsx
  GemCounter.tsx
  XPBar.tsx
  LeagueBadge.tsx
  DailyQuest.tsx
  StreakFreezeModal.tsx
app/(app)/shop/page.tsx
app/(app)/leaderboard/page.tsx
hooks/
  useStreak.ts
  useHearts.ts
  useGamification.ts
```

---

## Cron Jobs
| Job | Schedule | Action |
|---|---|---|
| Daily streak check | 00:05 daily | Reset streak for users with no activity yesterday |
| Weekly league reset | Monday 00:00 | Finalize ranks, apply promotions/relegations, start new week |
| Heart refill | Every 30 min per user | Increment hearts up to maxHearts |
