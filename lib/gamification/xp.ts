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
