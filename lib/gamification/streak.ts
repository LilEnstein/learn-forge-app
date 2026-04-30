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

  const newStreak =
    existing.lastActivityDate === yesterday ? existing.currentStreak + 1 : 1;
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
