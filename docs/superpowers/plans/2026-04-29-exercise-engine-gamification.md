# Exercise Engine + Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full exercise engine (6 exercise types, lesson completion flow) and gamification system (XP, gems, hearts, streaks, daily quests, league, shop) as a unified feature.

**Architecture:** Service layer pattern — thin API handlers delegate to focused modules in `lib/exercise/` and `lib/gamification/`. The submit endpoint orchestrates all gamification side-effects via a single `prisma.$transaction` callback. React Query manages server state on the frontend; local React state drives exercise progression.

**Tech Stack:** Next.js 14 App Router, Prisma 5, pg-boss 12, @tanstack/react-query, @dnd-kit/sortable, react-simple-code-editor + prismjs, Zod, Tailwind CSS.

**Design doc:** `docs/superpowers/specs/2026-04-29-exercise-engine-gamification-design.md`

---

## File Map

### New files
```
lib/errors.ts
lib/exercise/validate.ts
lib/exercise/unlock.ts
lib/gamification/xp.ts
lib/gamification/gems.ts
lib/gamification/hearts.ts
lib/gamification/streak.ts
lib/gamification/quests.ts
lib/gamification/league.ts
app/api/lessons/[id]/route.ts
app/api/lessons/[id]/submit/route.ts
app/api/gamification/me/route.ts
app/api/gamification/shop/route.ts
app/api/gamification/streak/freeze/route.ts
app/api/leaderboard/route.ts
components/providers.tsx
hooks/useGamification.ts
hooks/useHearts.ts
hooks/useExercise.ts
components/exercise/ProgressBar.tsx
components/exercise/HeartDisplay.tsx
components/exercise/FeedbackOverlay.tsx
components/exercise/ExerciseLoading.tsx
components/exercise/ResultScreen.tsx
components/exercise/ExerciseScreen.tsx
components/exercise/types/MultipleChoice.tsx
components/exercise/types/TrueFalse.tsx
components/exercise/types/FillBlank.tsx
components/exercise/types/Matching.tsx
components/exercise/types/Ordering.tsx
components/exercise/types/CodeFillBlank.tsx
components/gamification/StreakBadge.tsx
components/gamification/GemCounter.tsx
components/gamification/XPBar.tsx
components/gamification/LeagueBadge.tsx
components/gamification/DailyQuest.tsx
components/gamification/StreakFreezeModal.tsx
components/gamification/NoHeartsModal.tsx
app/app/learn/[courseId]/lesson/[lessonId]/page.tsx
app/app/shop/page.tsx
app/app/leaderboard/page.tsx
prisma/seed.ts
vitest.config.ts
lib/exercise/validate.test.ts
lib/gamification/xp.test.ts
lib/gamification/hearts.test.ts
```

### Modified files
```
prisma/schema.prisma          — schema fixes (see Task 3)
lib/queue/workers.ts          — add cron job registrations
app/app/layout.tsx            — wrap children in QueryClientProvider
```

---

## Task 1: Commit all pending changes

- [ ] **Step 1: Stage and commit all current working changes**

```bash
git add -A
git commit -m "chore: pre-feature-04-05 checkpoint"
```

Expected: clean working tree after commit.

---

## Task 2: Install dependencies

- [ ] **Step 1: Install new packages**

```bash
npm install @tanstack/react-query @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-simple-code-editor prismjs
npm install -D vitest @vitejs/plugin-react @vitest/ui @types/prismjs
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('@tanstack/react-query'); require('@dnd-kit/core'); require('prismjs'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-query, dnd-kit, react-simple-code-editor, vitest"
```

---

## Task 3: Vitest config

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 2: Add test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify vitest runs**

```bash
npx vitest run --reporter=verbose 2>&1 | head -5
```

Expected: vitest starts without errors (even with no test files yet).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: add vitest config"
```

---

## Task 4: Prisma schema migration

The current schema has date fields that need to be timezone-safe strings, and `LessonProgress` needs exercise tracking.

- [ ] **Step 1: Update `prisma/schema.prisma`**

Make the following changes:

In `StreakRecord` — change `lastActivityAt` and `frozenAt` to String:
```prisma
model StreakRecord {
  id              String  @id @default(cuid())
  userId          String  @unique
  currentStreak   Int     @default(0)
  longestStreak   Int     @default(0)
  lastActivityDate String?  // YYYY-MM-DD in UTC+7 (was lastActivityAt DateTime?)
  frozenAt        String?  // YYYY-MM-DD in UTC+7 (was DateTime?)
  user            User    @relation(fields: [userId], references: [id])
}
```

In `DailyQuestProgress` — change `date` from `DateTime` to `String`:
```prisma
model DailyQuestProgress {
  id        String  @id @default(cuid())
  userId    String
  questId   String
  date      String  // YYYY-MM-DD in UTC+7
  progress  Int     @default(0)
  completed Boolean @default(false)
  user      User    @relation(fields: [userId], references: [id])

  @@unique([userId, questId, date])
}
```

In `LessonProgress` — add `answeredIds` to track correctly answered exercises, and `perfect` to track no-wrong-answer sessions:
```prisma
model LessonProgress {
  id          String    @id @default(cuid())
  userId      String
  lessonId    String
  status      String    @default("locked")
  score       Int?
  attempts    Int       @default(0)
  xpEarned    Int       @default(0)
  answeredIds Json      @default("[]")   // ← add this line
  perfect     Boolean   @default(true)  // ← add this line; set false on wrong answer
  completedAt DateTime?
  user        User      @relation(fields: [userId], references: [id])
  lesson      Lesson    @relation(fields: [lessonId], references: [id])

  @@unique([userId, lessonId])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name exercise-gamification-schema
```

Expected: Migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Verify client generated**

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add answeredIds to LessonProgress, timezone-safe date strings"
```

---

## Task 5: lib/errors.ts

- [ ] **Step 1: Create `lib/errors.ts`**

```typescript
export class InsufficientGemsError extends Error {
  readonly status = 400;
  constructor() { super("Insufficient gems"); this.name = "InsufficientGemsError"; }
}

export class NoFreezesError extends Error {
  readonly status = 400;
  constructor() { super("No streak freezes available"); this.name = "NoFreezesError"; }
}

export class NoHeartsError extends Error {
  readonly status = 403;
  constructor() { super("No hearts remaining"); this.name = "NoHeartsError"; }
}

export class LessonNotAvailableError extends Error {
  readonly status = 403;
  constructor() { super("Lesson is not available"); this.name = "LessonNotAvailableError"; }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/errors.ts
git commit -m "feat: add typed error classes"
```

---

## Task 6: lib/exercise/validate.ts + tests

- [ ] **Step 1: Create `lib/exercise/validate.ts`**

```typescript
type ExerciseRecord = {
  type: string;
  correctAnswer: unknown;
};

export function validateAnswer(exercise: ExerciseRecord, answer: unknown): boolean {
  const correct = exercise.correctAnswer;

  switch (exercise.type) {
    case "multiple_choice":
    case "true_false":
      return answer === correct;

    case "fill_blank":
      return (
        typeof answer === "string" &&
        answer.trim().toLowerCase() === String(correct).trim().toLowerCase()
      );

    case "ordering": {
      if (!Array.isArray(answer) || !Array.isArray(correct)) return false;
      if (answer.length !== (correct as unknown[]).length) return false;
      return (answer as unknown[]).every((v, i) => v === (correct as unknown[])[i]);
    }

    case "matching": {
      if (!Array.isArray(answer) || !Array.isArray(correct)) return false;
      type Pair = { left: string; right: string };
      const toKey = (p: Pair) => `${p.left}::${p.right}`;
      const correctSet = new Set((correct as Pair[]).map(toKey));
      const answerPairs = answer as Pair[];
      if (answerPairs.length !== correctSet.size) return false;
      return answerPairs.every((p) => correctSet.has(toKey(p)));
    }

    case "code_fill_blank":
      return (
        typeof answer === "string" &&
        answer.replace(/\s+/g, " ").trim() ===
          String(correct).replace(/\s+/g, " ").trim()
      );

    default:
      return false;
  }
}
```

- [ ] **Step 2: Create `lib/exercise/validate.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { validateAnswer } from "./validate";

const ex = (type: string, correctAnswer: unknown) => ({ type, correctAnswer });

describe("validateAnswer", () => {
  it("multiple_choice: exact match", () => {
    expect(validateAnswer(ex("multiple_choice", "B"), "B")).toBe(true);
    expect(validateAnswer(ex("multiple_choice", "B"), "A")).toBe(false);
  });

  it("true_false: boolean match", () => {
    expect(validateAnswer(ex("true_false", true), true)).toBe(true);
    expect(validateAnswer(ex("true_false", true), false)).toBe(false);
  });

  it("fill_blank: case-insensitive trim", () => {
    expect(validateAnswer(ex("fill_blank", "hello"), " Hello ")).toBe(true);
    expect(validateAnswer(ex("fill_blank", "hello"), "world")).toBe(false);
  });

  it("ordering: exact array order", () => {
    expect(validateAnswer(ex("ordering", [1, 2, 3]), [1, 2, 3])).toBe(true);
    expect(validateAnswer(ex("ordering", [1, 2, 3]), [1, 3, 2])).toBe(false);
  });

  it("matching: set of pairs", () => {
    const correct = [{ left: "A", right: "1" }, { left: "B", right: "2" }];
    const answer = [{ left: "B", right: "2" }, { left: "A", right: "1" }];
    expect(validateAnswer(ex("matching", correct), answer)).toBe(true);
    const wrong = [{ left: "A", right: "2" }, { left: "B", right: "1" }];
    expect(validateAnswer(ex("matching", correct), wrong)).toBe(false);
  });

  it("code_fill_blank: normalized whitespace", () => {
    expect(validateAnswer(ex("code_fill_blank", "return x + 1"), "return  x+1")).toBe(false);
    expect(validateAnswer(ex("code_fill_blank", "return x + 1"), "return x + 1")).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run lib/exercise/validate.test.ts --reporter=verbose
```

Expected: All 6 test cases PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/exercise/validate.ts lib/exercise/validate.test.ts
git commit -m "feat(exercise): add answer validation + tests"
```

---

## Task 7: lib/gamification/xp.ts + tests

- [ ] **Step 1: Create `lib/gamification/xp.ts`**

```typescript
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export function calculateXp(
  lessonType: string,
  perfect: boolean
): { xp: number; gems: number } {
  if (lessonType === "checkpoint") return { xp: 25, gems: 15 };
  if (perfect) return { xp: 15, gems: 5 };
  return { xp: 10, gems: 0 };
}

export async function awardXp(
  userId: string,
  amount: number,
  reason: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  await db.userGamification.upsert({
    where: { userId },
    create: { userId, totalXp: amount, weeklyXp: amount },
    update: { totalXp: { increment: amount }, weeklyXp: { increment: amount } },
  });
  await db.transaction.create({
    data: { userId, type: "earn_xp", amount, reason },
  });
}
```

- [ ] **Step 2: Create `lib/gamification/xp.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { calculateXp } from "./xp";

describe("calculateXp", () => {
  it("standard lesson, not perfect → 10 xp, 0 gems", () => {
    expect(calculateXp("standard", false)).toEqual({ xp: 10, gems: 0 });
  });

  it("standard lesson, perfect → 15 xp, 5 gems", () => {
    expect(calculateXp("standard", true)).toEqual({ xp: 15, gems: 5 });
  });

  it("checkpoint lesson → 25 xp, 15 gems regardless of perfect", () => {
    expect(calculateXp("checkpoint", false)).toEqual({ xp: 25, gems: 15 });
    expect(calculateXp("checkpoint", true)).toEqual({ xp: 25, gems: 15 });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run lib/gamification/xp.test.ts --reporter=verbose
```

Expected: All 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/gamification/xp.ts lib/gamification/xp.test.ts
git commit -m "feat(gamification): add XP calculation + awardXp"
```

---

## Task 8: lib/gamification/gems.ts

- [ ] **Step 1: Create `lib/gamification/gems.ts`**

```typescript
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { InsufficientGemsError } from "@/lib/errors";

export async function awardGems(
  userId: string,
  amount: number,
  reason: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  if (amount <= 0) return;
  const db = tx ?? prisma;
  await db.userGamification.upsert({
    where: { userId },
    create: { userId, gems: amount },
    update: { gems: { increment: amount } },
  });
  await db.transaction.create({
    data: { userId, type: "earn_gems", amount, reason },
  });
}

export async function spendGems(
  userId: string,
  amount: number,
  reason: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const gamification = await db.userGamification.findUnique({ where: { userId } });
  if (!gamification || gamification.gems < amount) throw new InsufficientGemsError();
  await db.userGamification.update({
    where: { userId },
    data: { gems: { decrement: amount } },
  });
  await db.transaction.create({
    data: { userId, type: "spend_gems", amount, reason },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gamification/gems.ts
git commit -m "feat(gamification): add gem award/spend logic"
```

---

## Task 9: lib/gamification/hearts.ts + tests

- [ ] **Step 1: Create `lib/gamification/hearts.ts`**

```typescript
import { prisma } from "@/lib/db/prisma";
import { spendGems } from "./gems";

const REFILL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function computeHearts(gamification: {
  hearts: number;
  maxHearts: number;
  lastHeartAt: Date | null;
}): { hearts: number; nextRefillAt: Date | null } {
  const { hearts, maxHearts, lastHeartAt } = gamification;

  if (hearts >= maxHearts || !lastHeartAt) {
    return { hearts: Math.min(hearts, maxHearts), nextRefillAt: null };
  }

  const now = Date.now();
  const elapsed = now - lastHeartAt.getTime();
  const refilled = Math.floor(elapsed / REFILL_INTERVAL_MS);
  const newHearts = Math.min(hearts + refilled, maxHearts);

  const nextRefillAt =
    newHearts < maxHearts
      ? new Date(
          lastHeartAt.getTime() +
            (Math.floor(elapsed / REFILL_INTERVAL_MS) + 1) * REFILL_INTERVAL_MS
        )
      : null;

  return { hearts: newHearts, nextRefillAt };
}

export async function persistHeartRefill(userId: string): Promise<void> {
  const gamification = await prisma.userGamification.findUnique({ where: { userId } });
  if (!gamification) return;
  const { hearts } = computeHearts(gamification);
  if (hearts === gamification.hearts) return;
  await prisma.userGamification.update({
    where: { userId },
    data: {
      hearts,
      lastHeartAt: hearts >= gamification.maxHearts ? null : new Date(),
    },
  });
}

export async function deductHeart(
  userId: string
): Promise<{ heartsRemaining: number; heartsExhausted: boolean }> {
  const gamification = await prisma.userGamification.findUnique({ where: { userId } });

  if (!gamification) {
    await prisma.userGamification.create({
      data: { userId, hearts: 4, lastHeartAt: new Date() },
    });
    return { heartsRemaining: 4, heartsExhausted: false };
  }

  const current = gamification.hearts;
  if (current <= 0) return { heartsRemaining: 0, heartsExhausted: true };

  const newHearts = current - 1;
  await prisma.userGamification.update({
    where: { userId },
    data: { hearts: newHearts, lastHeartAt: new Date() },
  });

  return { heartsRemaining: newHearts, heartsExhausted: newHearts === 0 };
}

export async function refillHeartsWithGems(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await spendGems(userId, 150, "heart_refill", tx);
    const gamification = await tx.userGamification.findUnique({ where: { userId } });
    if (!gamification) throw new Error("Gamification record not found");
    await tx.userGamification.update({
      where: { userId },
      data: { hearts: gamification.maxHearts, lastHeartAt: null },
    });
  });
}
```

- [ ] **Step 2: Create `lib/gamification/hearts.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { computeHearts } from "./hearts";

describe("computeHearts", () => {
  it("full hearts → no refill needed", () => {
    const result = computeHearts({ hearts: 5, maxHearts: 5, lastHeartAt: null });
    expect(result).toEqual({ hearts: 5, nextRefillAt: null });
  });

  it("no lastHeartAt and hearts < max → hearts unchanged, no nextRefillAt", () => {
    const result = computeHearts({ hearts: 3, maxHearts: 5, lastHeartAt: null });
    expect(result).toEqual({ hearts: 3, nextRefillAt: null });
  });

  it("refills 1 heart after 30 min", () => {
    const lastHeartAt = new Date(Date.now() - 31 * 60 * 1000);
    const result = computeHearts({ hearts: 3, maxHearts: 5, lastHeartAt });
    expect(result.hearts).toBe(4);
    expect(result.nextRefillAt).not.toBeNull();
  });

  it("refills 2 hearts after 65 min", () => {
    const lastHeartAt = new Date(Date.now() - 65 * 60 * 1000);
    const result = computeHearts({ hearts: 2, maxHearts: 5, lastHeartAt });
    expect(result.hearts).toBe(4);
  });

  it("caps at maxHearts", () => {
    const lastHeartAt = new Date(Date.now() - 200 * 60 * 1000);
    const result = computeHearts({ hearts: 1, maxHearts: 5, lastHeartAt });
    expect(result.hearts).toBe(5);
    expect(result.nextRefillAt).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run lib/gamification/hearts.test.ts --reporter=verbose
```

Expected: All 5 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/gamification/hearts.ts lib/gamification/hearts.test.ts
git commit -m "feat(gamification): add hearts logic + computeHearts tests"
```

---

## Task 10: lib/gamification/streak.ts

- [ ] **Step 1: Create `lib/gamification/streak.ts`**

```typescript
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { awardGems } from "./gems";
import { NoFreezesError } from "@/lib/errors";

const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getTodayDateString(): string {
  return new Date(Date.now() + UTC7_OFFSET_MS).toISOString().slice(0, 10);
}

function getYesterdayDateString(): string {
  return new Date(Date.now() + UTC7_OFFSET_MS - 86_400_000).toISOString().slice(0, 10);
}

const MILESTONE_GEMS: Record<number, number> = { 7: 30, 30: 100 };

export async function recordActivity(
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<{ currentStreak: number }> {
  const db = tx ?? prisma;
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  const existing = await db.streakRecord.findUnique({ where: { userId } });

  if (!existing) {
    await db.streakRecord.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    });
    return { currentStreak: 1 };
  }

  if (existing.lastActivityDate === today) {
    return { currentStreak: existing.currentStreak };
  }

  const newStreak = existing.lastActivityDate === yesterday
    ? existing.currentStreak + 1
    : 1;

  const longestStreak = Math.max(newStreak, existing.longestStreak);

  await db.streakRecord.update({
    where: { userId },
    data: { currentStreak: newStreak, longestStreak, lastActivityDate: today },
  });

  if (MILESTONE_GEMS[newStreak]) {
    await awardGems(userId, MILESTONE_GEMS[newStreak], `streak_milestone_${newStreak}`, tx);
  }

  return { currentStreak: newStreak };
}

export async function checkAndResetStreaks(): Promise<void> {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  const stale = await prisma.streakRecord.findMany({
    where: {
      currentStreak: { gt: 0 },
      NOT: { lastActivityDate: { in: [today, yesterday] } },
    },
  });

  for (const record of stale) {
    if (record.frozenAt === yesterday) {
      await prisma.streakRecord.update({
        where: { id: record.id },
        data: { frozenAt: null },
      });
    } else {
      await prisma.streakRecord.update({
        where: { id: record.id },
        data: { currentStreak: 0 },
      });
    }
  }
}

export async function consumeFreeze(userId: string): Promise<void> {
  const today = getTodayDateString();

  const [gamification, streak] = await Promise.all([
    prisma.userGamification.findUnique({ where: { userId } }),
    prisma.streakRecord.findUnique({ where: { userId } }),
  ]);

  if (!gamification || gamification.streakFreezes === 0) throw new NoFreezesError();
  if (streak?.frozenAt === today) return;

  await prisma.$transaction([
    prisma.userGamification.update({
      where: { userId },
      data: { streakFreezes: { decrement: 1 } },
    }),
    prisma.streakRecord.upsert({
      where: { userId },
      create: { userId, frozenAt: today },
      update: { frozenAt: today },
    }),
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gamification/streak.ts
git commit -m "feat(gamification): add streak recording, reset, freeze logic"
```

---

## Task 11: lib/gamification/quests.ts

- [ ] **Step 1: Create `lib/gamification/quests.ts`**

```typescript
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { awardGems } from "./gems";
import { getTodayDateString } from "./streak";

interface QuestContext {
  lessonCompleted: boolean;
  xpEarned: number;
  perfectScore: boolean;
}

export async function getUserQuests(userId: string) {
  const today = getTodayDateString();
  const quests = await prisma.dailyQuest.findMany({ take: 3 });

  return Promise.all(
    quests.map(async (quest) => {
      const progress = await prisma.dailyQuestProgress.upsert({
        where: { userId_questId_date: { userId, questId: quest.id, date: today } },
        create: { userId, questId: quest.id, date: today, progress: 0, completed: false },
        update: {},
      });
      return { ...progress, quest };
    })
  );
}

export async function updateQuestProgress(
  userId: string,
  context: QuestContext,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const today = getTodayDateString();
  const quests = await prisma.dailyQuest.findMany({ take: 3 });

  for (const quest of quests) {
    const existing = await db.dailyQuestProgress.findUnique({
      where: { userId_questId_date: { userId, questId: quest.id, date: today } },
    });
    if (!existing || existing.completed) continue;

    let increment = 0;
    if (quest.type === "complete_lesson" && context.lessonCompleted) increment = 1;
    if (quest.type === "earn_xp") increment = context.xpEarned;
    if (quest.type === "perfect_score" && context.perfectScore) increment = 1;
    if (quest.type === "no_mistakes" && context.perfectScore) increment = 1;

    if (increment === 0) continue;

    const newProgress = existing.progress + increment;
    const completed = newProgress >= quest.target;

    await db.dailyQuestProgress.update({
      where: { userId_questId_date: { userId, questId: quest.id, date: today } },
      data: { progress: newProgress, completed },
    });

    if (completed) {
      await awardGems(userId, quest.gemReward, `daily_quest_${quest.type}`, tx);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gamification/quests.ts
git commit -m "feat(gamification): add daily quest progress logic"
```

---

## Task 12: lib/gamification/league.ts

- [ ] **Step 1: Create `lib/gamification/league.ts`**

```typescript
import { prisma } from "@/lib/db/prisma";

export function getCurrentWeekId(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export async function addWeeklyXp(userId: string, xp: number): Promise<void> {
  const weekId = getCurrentWeekId();
  await prisma.leagueEntry.upsert({
    where: { userId_weekId: { userId, weekId } },
    create: { userId, weekId, league: "bronze", weeklyXp: xp },
    update: { weeklyXp: { increment: xp } },
  });
}

export async function finalizeWeek(weekId: string): Promise<void> {
  const entries = await prisma.leagueEntry.findMany({
    where: { weekId },
    orderBy: { weeklyXp: "desc" },
  });

  for (let i = 0; i < entries.length; i++) {
    const rank = i + 1;
    const promoted = rank <= 3;
    const relegated = entries.length >= 10 && rank > entries.length - 5;

    await prisma.leagueEntry.update({
      where: { id: entries[i].id },
      data: { rank, promoted, relegated },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gamification/league.ts
git commit -m "feat(gamification): add league weekly XP + finalize logic"
```

---

## Task 13: lib/exercise/unlock.ts

- [ ] **Step 1: Create `lib/exercise/unlock.ts`**

```typescript
import { prisma } from "@/lib/db/prisma";

export async function unlockNextLesson(
  lessonId: string,
  userId: string
): Promise<void> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { include: { course: { include: { chapters: { include: { lessons: { orderBy: { order: "asc" } } } } } } } } },
  });

  if (!lesson) return;

  const chapter = lesson.chapter;
  const lessonsInChapter = chapter.lessons.sort((a, b) => a.order - b.order);
  const currentIdx = lessonsInChapter.findIndex((l) => l.id === lessonId);

  let nextLesson = lessonsInChapter[currentIdx + 1] ?? null;

  if (!nextLesson) {
    const chapters = lesson.chapter.course.chapters.sort((a, b) => a.order - b.order);
    const chapterIdx = chapters.findIndex((c) => c.id === chapter.id);
    const nextChapter = chapters[chapterIdx + 1];
    if (nextChapter) {
      nextLesson = nextChapter.lessons.sort((a, b) => a.order - b.order)[0] ?? null;
    }
  }

  if (!nextLesson) return;

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId: nextLesson.id } },
    create: { userId, lessonId: nextLesson.id, status: "available" },
    update: { status: "available" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/exercise/unlock.ts
git commit -m "feat(exercise): add lesson unlock logic"
```

---

## Task 14: GET /api/lessons/[id]

- [ ] **Step 1: Create `app/api/lessons/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { persistHeartRefill } from "@/lib/gamification/hearts";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const lessonId = params.id;

  await persistHeartRefill(userId);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          type: true,
          question: true,
          options: true,
          explanation: true,
          difficulty: true,
          // correctAnswer intentionally omitted
        },
      },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  return NextResponse.json({ lesson, progress });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/lessons/
git commit -m "feat(api): GET /api/lessons/[id]"
```

---

## Task 15: POST /api/lessons/[id]/submit

- [ ] **Step 1: Create `app/api/lessons/[id]/submit/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { validateAnswer } from "@/lib/exercise/validate";
import { deductHeart, computeHearts } from "@/lib/gamification/hearts";
import { calculateXp, awardXp } from "@/lib/gamification/xp";
import { awardGems } from "@/lib/gamification/gems";
import { recordActivity } from "@/lib/gamification/streak";
import { updateQuestProgress } from "@/lib/gamification/quests";
import { addWeeklyXp } from "@/lib/gamification/league";
import { unlockNextLesson } from "@/lib/exercise/unlock";

const SubmitSchema = z.object({
  exerciseId: z.string(),
  answer: z.unknown(),
  timeSpentMs: z.number().int().nonnegative(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const lessonId = params.id;

  const body = await req.json().catch(() => null);
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { exerciseId, answer } = parsed.data;

  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise || exercise.lessonId !== lessonId) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  const correct = validateAnswer(exercise, answer);

  if (!correct) {
    const { heartsRemaining, heartsExhausted } = await deductHeart(userId);
    // Mark session as imperfect (wrong answer given)
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, status: "in_progress", answeredIds: [], perfect: false },
      update: { perfect: false },
    });
    return NextResponse.json({
      correct: false,
      explanation: exercise.explanation,
      heartsRemaining,
      heartsExhausted,
    });
  }

  // Mark exercise as answered in LessonProgress
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status: "in_progress", answeredIds: [exerciseId] },
    update: {},
  });

  const currentAnswered = progress.answeredIds as string[];
  if (currentAnswered.includes(exerciseId)) {
    const gamification = await prisma.userGamification.findUnique({ where: { userId } });
    const { hearts } = gamification
      ? computeHearts(gamification)
      : { hearts: 5 };
    return NextResponse.json({ correct: true, explanation: exercise.explanation, heartsRemaining: hearts });
  }

  const updatedAnswered = [...currentAnswered, exerciseId];
  await prisma.lessonProgress.update({
    where: { userId_lessonId: { userId, lessonId } },
    data: { answeredIds: updatedAnswered },
  });

  const totalExercises = await prisma.exercise.count({ where: { lessonId } });
  const lessonComplete = updatedAnswered.length >= totalExercises;

  const gamification = await prisma.userGamification.findUnique({ where: { userId } });
  const { hearts: heartsRemaining } = gamification
    ? computeHearts(gamification)
    : { hearts: 5 };

  if (!lessonComplete) {
    return NextResponse.json({ correct: true, explanation: exercise.explanation, heartsRemaining });
  }

  // Idempotency: don't double-award if already completed
  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  if (existing?.status === "completed") {
    return NextResponse.json({ correct: true, explanation: exercise.explanation, heartsRemaining, lessonComplete: true });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  const perfect = existing?.perfect ?? true; // false if any wrong answer was submitted this session
  const { xp, gems } = calculateXp(lesson?.type ?? "standard", perfect);

  let streakDay = 1;

  await prisma.$transaction(async (tx) => {
    await tx.lessonProgress.update({
      where: { userId_lessonId: { userId, lessonId } },
      data: {
        status: "completed",
        score: Math.round((updatedAnswered.length / totalExercises) * 100),
        xpEarned: xp,
        attempts: { increment: 1 },
        completedAt: new Date(),
      },
    });

    await awardXp(userId, xp, "lesson_complete", tx);
    await awardGems(userId, gems, "lesson_complete", tx);
    const { currentStreak } = await recordActivity(userId, tx);
    streakDay = currentStreak;
    await updateQuestProgress(userId, { lessonCompleted: true, xpEarned: xp, perfectScore: perfect }, tx);
  });

  await addWeeklyXp(userId, xp);
  await unlockNextLesson(lessonId, userId);

  return NextResponse.json({
    correct: true,
    explanation: exercise.explanation,
    heartsRemaining,
    xpEarned: xp,
    gemsEarned: gems,
    streakDay,
    lessonComplete: true,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/lessons/
git commit -m "feat(api): POST /api/lessons/[id]/submit with full gamification flow"
```

---

## Task 16: GET /api/gamification/me

- [ ] **Step 1: Create `app/api/gamification/me/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { computeHearts } from "@/lib/gamification/hearts";
import { getUserQuests } from "@/lib/gamification/quests";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [gamification, streak, quests] = await Promise.all([
    prisma.userGamification.findUnique({ where: { userId } }),
    prisma.streakRecord.findUnique({ where: { userId } }),
    getUserQuests(userId),
  ]);

  const { hearts, nextRefillAt } = gamification
    ? computeHearts(gamification)
    : { hearts: 5, nextRefillAt: null };

  return NextResponse.json({
    streak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    hearts,
    maxHearts: gamification?.maxHearts ?? 5,
    nextRefillAt,
    gems: gamification?.gems ?? 0,
    totalXp: gamification?.totalXp ?? 0,
    weeklyXp: gamification?.weeklyXp ?? 0,
    streakFreezes: gamification?.streakFreezes ?? 0,
    quests,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/gamification/
git commit -m "feat(api): GET /api/gamification/me"
```

---

## Task 17: POST /api/gamification/shop + streak/freeze

- [ ] **Step 1: Create `app/api/gamification/shop/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { spendGems } from "@/lib/gamification/gems";
import { refillHeartsWithGems } from "@/lib/gamification/hearts";
import { InsufficientGemsError } from "@/lib/errors";

const ShopSchema = z.object({
  item: z.enum(["streak_freeze", "heart_refill", "cosmetic_theme", "weekend_shield"]),
});

const ITEM_COSTS: Record<string, number> = {
  streak_freeze: 100,
  heart_refill: 150,
  cosmetic_theme: 500,
  weekend_shield: 200,
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const parsed = ShopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { item } = parsed.data;

  try {
    if (item === "heart_refill") {
      await refillHeartsWithGems(userId);
    } else if (item === "streak_freeze") {
      await prisma.$transaction(async (tx) => {
        await spendGems(userId, ITEM_COSTS[item], item, tx);
        await tx.userGamification.update({
          where: { userId },
          data: { streakFreezes: { increment: 1 } },
        });
      });
    } else {
      await spendGems(userId, ITEM_COSTS[item], item);
    }
  } catch (err) {
    if (err instanceof InsufficientGemsError) {
      return NextResponse.json({ error: "Insufficient gems" }, { status: 400 });
    }
    throw err;
  }

  const gamification = await prisma.userGamification.findUnique({ where: { userId } });
  return NextResponse.json(gamification);
}
```

- [ ] **Step 2: Create `app/api/gamification/streak/freeze/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { consumeFreeze } from "@/lib/gamification/streak";
import { NoFreezesError } from "@/lib/errors";

export async function POST() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await consumeFreeze(session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NoFreezesError) {
      return NextResponse.json({ error: "No streak freezes available" }, { status: 400 });
    }
    throw err;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/gamification/
git commit -m "feat(api): shop purchase + streak freeze endpoints"
```

---

## Task 18: GET /api/leaderboard

- [ ] **Step 1: Create `app/api/leaderboard/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentWeekId } from "@/lib/gamification/league";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");

  const weekId = getCurrentWeekId();

  let userIds: string[] = [];
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { topic: true },
    });
    if (course) {
      const sameTopic = await prisma.course.findMany({
        where: { topic: course.topic },
        select: { userId: true },
      });
      userIds = sameTopic.map((c) => c.userId);
    }
  }

  const entries = await prisma.leagueEntry.findMany({
    where: {
      weekId,
      ...(userIds.length > 0 ? { userId: { in: userIds } } : {}),
    },
    orderBy: { weeklyXp: "desc" },
    include: {
      user: { select: { id: true, name: true, image: true, avatarKey: true } },
    },
    take: 50,
  });

  return NextResponse.json(entries);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/leaderboard/
git commit -m "feat(api): GET /api/leaderboard"
```

---

## Task 19: Cron jobs + seed

- [ ] **Step 1: Register cron schedules in `lib/queue/workers.ts`**

Add to the existing `startWorkers` function (after the existing worker registrations):

```typescript
// Streak daily reset — 00:05 UTC+7 = 17:05 UTC
await boss.schedule("streak-daily-check", "5 17 * * *", {});
boss.work("streak-daily-check", async () => {
  const { checkAndResetStreaks } = await import("@/lib/gamification/streak");
  await checkAndResetStreaks();
});

// League weekly finalize — Monday 00:00 UTC+7 = Sunday 17:00 UTC
await boss.schedule("league-weekly-reset", "0 17 * * 0", {});
boss.work("league-weekly-reset", async () => {
  const { finalizeWeek, getCurrentWeekId } = await import("@/lib/gamification/league");
  // Finalize previous week
  const now = new Date();
  const prevWeek = new Date(now.getTime() - 7 * 86_400_000);
  const jan1 = new Date(prevWeek.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((prevWeek.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
  const prevWeekId = `${prevWeek.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  await finalizeWeek(prevWeekId);
  // Reset weeklyXp for new week
  await import("@/lib/db/prisma").then(({ prisma }) =>
    prisma.userGamification.updateMany({ data: { weeklyXp: 0 } })
  );
});
```

- [ ] **Step 2: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.dailyQuest.deleteMany();

  await prisma.dailyQuest.createMany({
    data: [
      {
        type: "complete_lesson",
        title: "Lesson Learner",
        description: "Complete 1 lesson today",
        target: 1,
        gemReward: 20,
        xpReward: 0,
      },
      {
        type: "earn_xp",
        title: "XP Hunter",
        description: "Earn 50 XP today",
        target: 50,
        gemReward: 25,
        xpReward: 0,
      },
      {
        type: "perfect_score",
        title: "Perfectionist",
        description: "Complete a lesson with no mistakes",
        target: 1,
        gemReward: 30,
        xpReward: 0,
      },
    ],
  });

  console.log("Seeded 3 daily quests");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run seed**

```bash
npx tsx prisma/seed.ts
```

Expected: `Seeded 3 daily quests`

- [ ] **Step 4: Commit**

```bash
git add lib/queue/workers.ts prisma/seed.ts
git commit -m "feat(gamification): add cron jobs + seed daily quests"
```

---

## Task 20: React Query providers

- [ ] **Step 1: Create `components/providers.tsx`**

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Wrap `app/app/layout.tsx` children with `<Providers>`**

In `app/app/layout.tsx`, import Providers and wrap the `{children}` inside `<div className="flex-1 p-6">`:

```typescript
import { Providers } from "@/components/providers";
// ...
<div className="flex-1 p-6">
  <Providers>{children}</Providers>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/providers.tsx app/app/layout.tsx
git commit -m "feat: add React Query providers to app layout"
```

---

## Task 21: hooks/useGamification.ts + hooks/useHearts.ts

- [ ] **Step 1: Create `hooks/useGamification.ts`**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";

export interface GamificationData {
  streak: number;
  longestStreak: number;
  hearts: number;
  maxHearts: number;
  nextRefillAt: string | null;
  gems: number;
  totalXp: number;
  weeklyXp: number;
  streakFreezes: number;
  quests: Array<{
    id: string;
    progress: number;
    completed: boolean;
    quest: { type: string; title: string; description: string; target: number; gemReward: number };
  }>;
}

export function useGamification() {
  return useQuery<GamificationData>({
    queryKey: ["gamification"],
    queryFn: async () => {
      const res = await fetch("/api/gamification/me");
      if (!res.ok) throw new Error("Failed to fetch gamification");
      return res.json();
    },
  });
}
```

- [ ] **Step 2: Create `hooks/useHearts.ts`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useGamification } from "./useGamification";

export function useHearts() {
  const { data } = useGamification();
  const [timeToRefill, setTimeToRefill] = useState<string>("");

  useEffect(() => {
    if (!data?.nextRefillAt) { setTimeToRefill(""); return; }
    const update = () => {
      const ms = new Date(data.nextRefillAt!).getTime() - Date.now();
      if (ms <= 0) { setTimeToRefill(""); return; }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setTimeToRefill(`${m}:${String(s).padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [data?.nextRefillAt]);

  return {
    hearts: data?.hearts ?? 5,
    maxHearts: data?.maxHearts ?? 5,
    timeToRefill,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useGamification.ts hooks/useHearts.ts
git commit -m "feat(hooks): useGamification + useHearts"
```

---

## Task 22: hooks/useExercise.ts

- [ ] **Step 1: Create `hooks/useExercise.ts`**

```typescript
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface ExerciseItem {
  id: string;
  order: number;
  type: string;
  question: string;
  options: unknown;
  explanation: string | null;
  difficulty: number;
}

export interface SubmitResult {
  correct: boolean;
  explanation: string | null;
  heartsRemaining: number;
  heartsExhausted?: boolean;
  xpEarned?: number;
  gemsEarned?: number;
  streakDay?: number;
  lessonComplete?: boolean;
}

export function useExercise(lessonId: string, exercises: ExerciseItem[]) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hearts, setHearts] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const currentExercise = exercises[currentIndex] ?? null;

  async function submitAnswer(answer: unknown) {
    if (!currentExercise || submitting) return;
    setSubmitting(true);

    const res = await fetch(`/api/lessons/${lessonId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: currentExercise.id,
        answer,
        timeSpentMs: 0,
      }),
    });

    const result: SubmitResult = await res.json();
    setLastResult(result);
    setHearts(result.heartsRemaining);
    setShowFeedback(true);
    setSubmitting(false);

    // Sync gamification state
    queryClient.invalidateQueries({ queryKey: ["gamification"] });

    if (result.lessonComplete) setIsComplete(true);
  }

  function advance() {
    setShowFeedback(false);
    setLastResult(null);
    if (!isComplete) setCurrentIndex((i) => Math.min(i + 1, exercises.length - 1));
  }

  return {
    currentExercise,
    currentIndex,
    totalExercises: exercises.length,
    lastResult,
    showFeedback,
    isComplete,
    hearts,
    submitting,
    submitAnswer,
    advance,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useExercise.ts
git commit -m "feat(hooks): useExercise state machine"
```

---

## Task 23: Exercise display components

- [ ] **Step 1: Create `components/exercise/ProgressBar.tsx`**

```typescript
interface Props { current: number; total: number; }

export function ProgressBar({ current, total }: Props) {
  return (
    <div className="flex gap-1 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-colors ${
            i < current ? "bg-green-500" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/exercise/HeartDisplay.tsx`**

```typescript
interface Props { hearts: number; maxHearts: number; }

export function HeartDisplay({ hearts, maxHearts }: Props) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxHearts }).map((_, i) => (
        <span key={i} className={`text-xl transition-opacity ${i < hearts ? "opacity-100" : "opacity-25"}`}>
          ❤️
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/exercise/FeedbackOverlay.tsx`**

```typescript
interface Props {
  correct: boolean;
  explanation: string | null;
  onContinue: () => void;
}

export function FeedbackOverlay({ correct, explanation, onContinue }: Props) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 p-6 border-t-4 ${
      correct ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"
    }`}>
      <div className="max-w-2xl mx-auto space-y-3">
        <p className={`font-bold text-lg ${correct ? "text-green-700" : "text-red-700"}`}>
          {correct ? "✓ Correct!" : "✗ Incorrect"}
        </p>
        {explanation && <p className="text-sm text-muted-foreground">{explanation}</p>}
        <button
          onClick={onContinue}
          className={`w-full py-3 rounded-xl font-semibold text-white ${
            correct ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/exercise/ExerciseLoading.tsx`**

```typescript
export function ExerciseLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-2 bg-muted rounded-full w-full" />
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/exercise/ResultScreen.tsx`**

```typescript
import { useRouter } from "next/navigation";
import type { SubmitResult } from "@/hooks/useExercise";

interface Props {
  result: SubmitResult;
  courseId: string;
}

export function ResultScreen({ result, courseId }: Props) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="text-6xl">🎉</div>
      <h2 className="text-2xl font-bold">Lesson Complete!</h2>
      <div className="flex gap-6">
        <div>
          <p className="text-3xl font-bold text-violet-600">+{result.xpEarned ?? 0} XP</p>
          <p className="text-sm text-muted-foreground">XP earned</p>
        </div>
        {(result.gemsEarned ?? 0) > 0 && (
          <div>
            <p className="text-3xl font-bold text-yellow-500">+{result.gemsEarned} 💎</p>
            <p className="text-sm text-muted-foreground">Gems</p>
          </div>
        )}
        <div>
          <p className="text-3xl font-bold text-orange-500">🔥 {result.streakDay ?? 1}</p>
          <p className="text-sm text-muted-foreground">Day streak</p>
        </div>
      </div>
      <button
        onClick={() => router.push(`/app/dashboard`)}
        className="mt-4 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
      >
        Continue
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/exercise/ProgressBar.tsx components/exercise/HeartDisplay.tsx components/exercise/FeedbackOverlay.tsx components/exercise/ExerciseLoading.tsx components/exercise/ResultScreen.tsx
git commit -m "feat(exercise): ProgressBar, HeartDisplay, FeedbackOverlay, ResultScreen, ExerciseLoading"
```

---

## Task 24: MultipleChoice + TrueFalse exercise types

- [ ] **Step 1: Create `components/exercise/types/MultipleChoice.tsx`**

```typescript
"use client";
import { useState } from "react";

interface Props {
  question: string;
  options: string[];
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

export function MultipleChoice({ question, options, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => setSelected(opt)}
            className={`p-4 rounded-xl border-2 text-left font-medium transition-colors ${
              selected === opt
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        disabled={!selected || disabled}
        onClick={() => selected && onSubmit(selected)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/exercise/types/TrueFalse.tsx`**

```typescript
"use client";

interface Props {
  question: string;
  onSubmit: (answer: boolean) => void;
  disabled: boolean;
}

export function TrueFalse({ question, onSubmit, disabled }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-4">
        <button
          disabled={disabled}
          onClick={() => onSubmit(true)}
          className="py-6 rounded-xl border-2 border-green-300 bg-green-50 hover:bg-green-100 font-bold text-green-700 text-lg"
        >
          ✓ True
        </button>
        <button
          disabled={disabled}
          onClick={() => onSubmit(false)}
          className="py-6 rounded-xl border-2 border-red-300 bg-red-50 hover:bg-red-100 font-bold text-red-700 text-lg"
        >
          ✗ False
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/exercise/types/MultipleChoice.tsx components/exercise/types/TrueFalse.tsx
git commit -m "feat(exercise): MultipleChoice + TrueFalse components"
```

---

## Task 25: FillBlank exercise type

- [ ] **Step 1: Create `components/exercise/types/FillBlank.tsx`**

```typescript
"use client";
import { useState } from "react";

interface Props {
  question: string; // Contains "___" as the blank
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

export function FillBlank({ question, onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const parts = question.split("___");

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold flex flex-wrap items-center gap-1">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={disabled}
                className="inline-block border-b-2 border-primary bg-transparent outline-none px-1 min-w-[80px] text-center"
                onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); }}
              />
            )}
          </span>
        ))}
      </div>
      <button
        disabled={!value.trim() || disabled}
        onClick={() => onSubmit(value.trim())}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/exercise/types/FillBlank.tsx
git commit -m "feat(exercise): FillBlank component"
```

---

## Task 26: Matching exercise type

- [ ] **Step 1: Create `components/exercise/types/Matching.tsx`**

```typescript
"use client";
import { useState } from "react";

interface Pair { left: string; right: string; }

interface Props {
  question: string;
  options: { pairs: Pair[] }; // correctAnswer structure reused for display
  onSubmit: (answer: Pair[]) => void;
  disabled: boolean;
}

export function Matching({ question, options, onSubmit, disabled }: Props) {
  const pairs = options.pairs;
  const leftItems = pairs.map((p) => p.left);
  const rightItems = [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Pair[]>([]);

  function handleLeftClick(left: string) {
    if (disabled) return;
    setSelectedLeft(selected => selected === left ? null : left);
  }

  function handleRightClick(right: string) {
    if (disabled || !selectedLeft) return;
    const newMatched = matched.filter((p) => p.left !== selectedLeft && p.right !== right);
    setMatched([...newMatched, { left: selectedLeft, right }]);
    setSelectedLeft(null);
  }

  const getMatchedRight = (left: string) => matched.find((p) => p.left === left)?.right;
  const getMatchedLeft = (right: string) => matched.find((p) => p.right === right)?.left;

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {leftItems.map((left) => (
            <button
              key={left}
              onClick={() => handleLeftClick(left)}
              disabled={disabled}
              className={`w-full p-3 rounded-xl border-2 text-left text-sm font-medium transition-colors ${
                selectedLeft === left
                  ? "border-primary bg-primary/10"
                  : getMatchedRight(left)
                  ? "border-green-400 bg-green-50"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {left}
              {getMatchedRight(left) && (
                <span className="text-xs text-muted-foreground ml-1">→ {getMatchedRight(left)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map((right) => (
            <button
              key={right}
              onClick={() => handleRightClick(right)}
              disabled={disabled || !selectedLeft}
              className={`w-full p-3 rounded-xl border-2 text-left text-sm font-medium transition-colors ${
                getMatchedLeft(right)
                  ? "border-green-400 bg-green-50"
                  : selectedLeft
                  ? "border-primary/50 hover:border-primary cursor-pointer"
                  : "border-border"
              }`}
            >
              {right}
            </button>
          ))}
        </div>
      </div>
      <button
        disabled={matched.length < pairs.length || disabled}
        onClick={() => onSubmit(matched)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/exercise/types/Matching.tsx
git commit -m "feat(exercise): Matching click-to-pair component"
```

---

## Task 27: Ordering exercise type

- [ ] **Step 1: Create `components/exercise/types/Ordering.tsx`**

```typescript
"use client";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="p-3 bg-card border rounded-xl cursor-grab active:cursor-grabbing flex items-center gap-2"
    >
      <span className="text-muted-foreground">⠿</span>
      <span className="text-sm font-medium">{id}</span>
    </div>
  );
}

interface Props {
  question: string;
  options: string[];
  onSubmit: (answer: string[]) => void;
  disabled: boolean;
}

export function Ordering({ question, options, onSubmit, disabled }: Props) {
  const [items, setItems] = useState(() => [...options].sort(() => Math.random() - 0.5));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => arrayMove(items, items.indexOf(String(active.id)), items.indexOf(String(over.id))));
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => <SortableItem key={item} id={item} />)}
          </div>
        </SortableContext>
      </DndContext>
      <button
        disabled={disabled}
        onClick={() => onSubmit(items)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/exercise/types/Ordering.tsx
git commit -m "feat(exercise): Ordering drag-and-drop component"
```

---

## Task 28: CodeFillBlank exercise type

- [ ] **Step 1: Create `components/exercise/types/CodeFillBlank.tsx`**

The exercise `question` field contains a code template with `___` placeholders. The component renders the code as a `<pre>` block with `<input>` elements at each blank position.

```typescript
"use client";
import { useState } from "react";

interface Props {
  question: string; // Code template with ___ blanks
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

export function CodeFillBlank({ question, onSubmit, disabled }: Props) {
  const parts = question.split("___");
  const blankCount = parts.length - 1;
  const [values, setValues] = useState<string[]>(Array(blankCount).fill(""));

  function updateValue(i: number, v: string) {
    setValues((prev) => { const next = [...prev]; next[i] = v; return next; });
  }

  function buildAnswer(): string {
    return parts.reduce((acc, part, i) => acc + part + (values[i] ?? ""), "");
  }

  const allFilled = values.every((v) => v.trim().length > 0);

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">Complete the code</p>
      <pre className="bg-muted rounded-xl p-4 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input
                type="text"
                value={values[i]}
                onChange={(e) => updateValue(i, e.target.value)}
                disabled={disabled}
                className="inline-block bg-yellow-100 border-b-2 border-yellow-400 outline-none px-1 font-mono text-sm min-w-[60px]"
                style={{ width: `${Math.max(values[i].length + 4, 8)}ch` }}
              />
            )}
          </span>
        ))}
      </pre>
      <button
        disabled={!allFilled || disabled}
        onClick={() => onSubmit(buildAnswer())}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/exercise/types/CodeFillBlank.tsx
git commit -m "feat(exercise): CodeFillBlank pre+input component"
```

---

## Task 29: ExerciseScreen orchestrator + NoHeartsModal

- [ ] **Step 1: Create `components/gamification/NoHeartsModal.tsx`**

```typescript
"use client";
import { useRouter } from "next/navigation";

interface Props {
  onUseGems: () => void;
  gemsBalance: number;
}

export function NoHeartsModal({ onUseGems, gemsBalance }: Props) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
        <div className="text-5xl">💔</div>
        <h2 className="text-xl font-bold">Out of hearts!</h2>
        <p className="text-muted-foreground text-sm">Wait 30 minutes for a heart to refill, or use 150 gems.</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onUseGems}
            disabled={gemsBalance < 150}
            className="w-full py-3 bg-yellow-500 text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Use 150 💎 to refill ({gemsBalance} available)
          </button>
          <button
            onClick={() => router.push("/app/dashboard")}
            className="w-full py-3 border rounded-xl font-semibold"
          >
            Wait for refill
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/exercise/ExerciseScreen.tsx`**

```typescript
"use client";
import { useExercise, type ExerciseItem } from "@/hooks/useExercise";
import { useGamification } from "@/hooks/useGamification";
import { ProgressBar } from "./ProgressBar";
import { HeartDisplay } from "./HeartDisplay";
import { FeedbackOverlay } from "./FeedbackOverlay";
import { ResultScreen } from "./ResultScreen";
import { NoHeartsModal } from "@/components/gamification/NoHeartsModal";
import { MultipleChoice } from "./types/MultipleChoice";
import { TrueFalse } from "./types/TrueFalse";
import { FillBlank } from "./types/FillBlank";
import { Matching } from "./types/Matching";
import { Ordering } from "./types/Ordering";
import { CodeFillBlank } from "./types/CodeFillBlank";

interface Props {
  lessonId: string;
  courseId: string;
  exercises: ExerciseItem[];
}

export function ExerciseScreen({ lessonId, courseId, exercises }: Props) {
  const { data: gamification } = useGamification();
  const {
    currentExercise,
    currentIndex,
    totalExercises,
    lastResult,
    showFeedback,
    isComplete,
    hearts,
    submitting,
    submitAnswer,
    advance,
  } = useExercise(lessonId, exercises);

  const showNoHearts = hearts === 0 && !showFeedback && !isComplete;

  if (isComplete && lastResult) {
    return <ResultScreen result={lastResult} courseId={courseId} />;
  }

  if (!currentExercise) return null;

  function renderExercise() {
    const ex = currentExercise!;
    const opts = ex.options as Record<string, unknown> | null;
    switch (ex.type) {
      case "multiple_choice":
        // options is stored as string[] (flat array) by the exercise generator
        return <MultipleChoice question={ex.question} options={(opts as string[]) ?? []} onSubmit={submitAnswer} disabled={submitting || showFeedback} />;
      case "true_false":
        return <TrueFalse question={ex.question} onSubmit={submitAnswer} disabled={submitting || showFeedback} />;
      case "fill_blank":
        return <FillBlank question={ex.question} onSubmit={submitAnswer} disabled={submitting || showFeedback} />;
      case "matching":
        // options stored as { pairs: {left, right}[] } for matching exercises
        return <Matching question={ex.question} options={opts as { pairs: { left: string; right: string }[] }} onSubmit={submitAnswer} disabled={submitting || showFeedback} />;
      case "ordering":
        // options stored as string[] for ordering exercises
        return <Ordering question={ex.question} options={(opts as string[]) ?? []} onSubmit={submitAnswer} disabled={submitting || showFeedback} />;
      case "code_fill_blank":
        return <CodeFillBlank question={ex.question} onSubmit={submitAnswer} disabled={submitting || showFeedback} />;
      default:
        return <p>Unknown exercise type: {ex.type}</p>;
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between">
        <ProgressBar current={currentIndex} total={totalExercises} />
        <HeartDisplay hearts={hearts} maxHearts={gamification?.maxHearts ?? 5} />
      </div>

      {renderExercise()}

      {showFeedback && lastResult && (
        <FeedbackOverlay
          correct={lastResult.correct}
          explanation={lastResult.explanation}
          onContinue={advance}
        />
      )}

      {showNoHearts && (
        <NoHeartsModal
          gemsBalance={gamification?.gems ?? 0}
          onUseGems={async () => {
            await fetch("/api/gamification/shop", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ item: "heart_refill" }),
            });
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/exercise/ExerciseScreen.tsx components/gamification/NoHeartsModal.tsx
git commit -m "feat(exercise): ExerciseScreen orchestrator + NoHeartsModal"
```

---

## Task 30: Gamification UI components

- [ ] **Step 1: Create `components/gamification/StreakBadge.tsx`**

```typescript
interface Props { streak: number; }
export function StreakBadge({ streak }: Props) {
  return (
    <div className="flex items-center gap-1 font-semibold text-orange-500">
      <span>🔥</span>
      <span>{streak}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/gamification/GemCounter.tsx`**

```typescript
interface Props { gems: number; }
export function GemCounter({ gems }: Props) {
  return (
    <div className="flex items-center gap-1 font-semibold text-yellow-500">
      <span>💎</span>
      <span>{gems}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/gamification/XPBar.tsx`**

```typescript
interface Props { totalXp: number; }
export function XPBar({ totalXp }: Props) {
  const level = Math.floor(totalXp / 100) + 1;
  const progress = totalXp % 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Level {level}</span>
        <span>{progress}/100 XP</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/gamification/LeagueBadge.tsx`**

```typescript
const LEAGUE_COLORS: Record<string, string> = {
  bronze: "text-amber-600",
  silver: "text-gray-400",
  gold: "text-yellow-500",
  platinum: "text-cyan-400",
  diamond: "text-blue-500",
};

interface Props { league: string; }
export function LeagueBadge({ league }: Props) {
  return (
    <span className={`font-semibold capitalize ${LEAGUE_COLORS[league] ?? "text-muted-foreground"}`}>
      {league}
    </span>
  );
}
```

- [ ] **Step 5: Create `components/gamification/DailyQuest.tsx`**

```typescript
interface Quest {
  title: string;
  description: string;
  target: number;
  gemReward: number;
}
interface Props { progress: number; completed: boolean; quest: Quest; }

export function DailyQuest({ progress, completed, quest }: Props) {
  const pct = Math.min((progress / quest.target) * 100, 100);
  return (
    <div className={`p-3 rounded-xl border ${completed ? "border-green-300 bg-green-50" : "border-border"}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-sm">{quest.title}</p>
          <p className="text-xs text-muted-foreground">{quest.description}</p>
        </div>
        <span className="text-sm font-semibold text-yellow-500">+{quest.gemReward} 💎</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{progress}/{quest.target}</p>
    </div>
  );
}
```

- [ ] **Step 6: Create `components/gamification/StreakFreezeModal.tsx`**

```typescript
"use client";
interface Props { onConfirm: () => void; onCancel: () => void; gemsBalance: number; }

export function StreakFreezeModal({ onConfirm, onCancel, gemsBalance }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
        <div className="text-5xl">🧊</div>
        <h2 className="text-xl font-bold">Streak Freeze</h2>
        <p className="text-muted-foreground text-sm">Protect your streak for one missed day. Costs 100 gems.</p>
        <p className="font-semibold">Your balance: {gemsBalance} 💎</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 border rounded-xl font-semibold">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={gemsBalance < 100}
            className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Buy (100 💎)
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add components/gamification/
git commit -m "feat(gamification): StreakBadge, GemCounter, XPBar, LeagueBadge, DailyQuest, StreakFreezeModal"
```

---

## Task 31: Lesson page

- [ ] **Step 1: Create directory and page**

Create `app/app/learn/[courseId]/lesson/[lessonId]/page.tsx`:

```typescript
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { ExerciseScreen } from "@/components/exercise/ExerciseScreen";
import { persistHeartRefill } from "@/lib/gamification/hearts";

interface Props {
  params: { courseId: string; lessonId: string };
}

export default async function LessonPage({ params }: Props) {
  const session = await requireSession();
  const userId = session.user.id;
  const { courseId, lessonId } = params;

  await persistHeartRefill(userId);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          type: true,
          question: true,
          options: true,
          explanation: true,
          difficulty: true,
        },
      },
    },
  });

  if (!lesson) notFound();

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  if (progress?.status === "locked") {
    redirect(`/app/dashboard`);
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h1 className="text-lg font-semibold mb-6 text-muted-foreground">{lesson.title}</h1>
      <ExerciseScreen
        lessonId={lessonId}
        courseId={courseId}
        exercises={lesson.exercises}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/learn/
git commit -m "feat(pages): lesson exercise page"
```

---

## Task 32: Shop page

- [ ] **Step 1: Create `app/app/shop/page.tsx`**

```typescript
"use client";

import { useGamification } from "@/hooks/useGamification";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GemCounter } from "@/components/gamification/GemCounter";
import { StreakFreezeModal } from "@/components/gamification/StreakFreezeModal";

const SHOP_ITEMS = [
  { id: "streak_freeze", name: "Streak Freeze", description: "Protect your streak for one missed day", cost: 100, emoji: "🧊" },
  { id: "heart_refill", name: "Heart Refill", description: "Instantly refill all hearts", cost: 150, emoji: "❤️" },
  { id: "weekend_shield", name: "Weekend Shield", description: "No streak loss on weekends", cost: 200, emoji: "🛡️" },
  { id: "cosmetic_theme", name: "Dark Theme", description: "Unlock dark mode cosmetic", cost: 500, emoji: "🎨" },
] as const;

export default function ShopPage() {
  const { data: gamification, isLoading } = useGamification();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);

  async function purchase(itemId: string) {
    setPurchasing(itemId);
    const res = await fetch("/api/gamification/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: itemId }),
    });
    setPurchasing(null);
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["gamification"] });
    else {
      const err = await res.json();
      alert(err.error ?? "Purchase failed");
    }
  }

  if (isLoading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shop</h1>
        <GemCounter gems={gamification?.gems ?? 0} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SHOP_ITEMS.map((item) => (
          <div key={item.id} className="border rounded-xl p-4 space-y-3">
            <div className="text-3xl">{item.emoji}</div>
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <button
              onClick={() => item.id === "streak_freeze" ? setShowFreezeModal(true) : purchase(item.id)}
              disabled={purchasing === item.id || (gamification?.gems ?? 0) < item.cost}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {item.cost} 💎
            </button>
          </div>
        ))}
      </div>

      {showFreezeModal && (
        <StreakFreezeModal
          gemsBalance={gamification?.gems ?? 0}
          onConfirm={async () => { await purchase("streak_freeze"); setShowFreezeModal(false); }}
          onCancel={() => setShowFreezeModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/shop/
git commit -m "feat(pages): shop page"
```

---

## Task 33: Leaderboard page

- [ ] **Step 1: Create `app/app/leaderboard/page.tsx`**

```typescript
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentWeekId } from "@/lib/gamification/league";
import { LeagueBadge } from "@/components/gamification/LeagueBadge";

export default async function LeaderboardPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const weekId = getCurrentWeekId();

  const entries = await prisma.leagueEntry.findMany({
    where: { weekId },
    orderBy: { weeklyXp: "desc" },
    include: {
      user: { select: { id: true, name: true, avatarKey: true } },
    },
    take: 50,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Weekly League</h1>
      <p className="text-sm text-muted-foreground">Week {weekId}</p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No entries yet this week. Complete a lesson to appear!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                entry.userId === userId ? "bg-primary/5 border-primary" : ""
              }`}
            >
              <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
              <div className="flex-1">
                <p className="font-semibold">{entry.user.name ?? "Learner"}</p>
                <LeagueBadge league={entry.league} />
              </div>
              <p className="font-bold text-violet-600">{entry.weeklyXp} XP</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/leaderboard/
git commit -m "feat(pages): leaderboard page"
```

---

## Task 34: Run all tests + smoke verification

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests in `validate.test.ts`, `xp.test.ts`, `hearts.test.ts` PASS.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only known pre-existing errors unrelated to this feature).

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Then verify in browser:
- Navigate to a course that has lessons with exercises → lesson page should render exercise
- Answer correctly → green feedback → progress bar advances
- Answer incorrectly → red feedback → heart decreases
- Complete all exercises → ResultScreen with XP shown
- Check `/app/shop` renders shop items
- Check `/app/leaderboard` renders without error

- [ ] **Step 4: Verify DB after lesson completion**

After completing a lesson, check in Prisma Studio:

```bash
npx prisma studio
```

Verify:
- `LessonProgress` row has `status = "completed"`, `xpEarned > 0`, `completedAt` is set
- `UserGamification` row has `totalXp > 0`
- `StreakRecord` row has `currentStreak >= 1`, `lastActivityDate = today`
- Next lesson's `LessonProgress` row has `status = "available"`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Exercise Engine + Gamification (Features 04+05)"
```

---

## Acceptance Criteria Checklist

- [ ] All 6 exercise types render and accept input
- [ ] Correct answer → green feedback → progress advances to next exercise
- [ ] Wrong answer → red feedback + 1 heart deducted → advances to next exercise
- [ ] Hearts at 0 → NoHeartsModal blocks further submission
- [ ] Completing all exercises → idempotent XP/gem award → ResultScreen shown
- [ ] Next lesson unlocked in DB after completion
- [ ] Streak increments once per day; does not double-count same-day completions
- [ ] Streak reset cron registered at 17:05 UTC (= 00:05 UTC+7)
- [ ] Streak freeze is idempotent; blocked when balance is 0
- [ ] Gem spend fails with 400 when balance insufficient
- [ ] `GET /api/gamification/me` has no DB write side effects
- [ ] League leaderboard renders weekly ranking
- [ ] Shop purchases are atomic (gems + item granted together or not at all)
