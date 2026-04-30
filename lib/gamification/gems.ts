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
