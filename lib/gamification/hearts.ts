import { prisma } from "@/lib/db/prisma";
import { spendGems } from "./gems";

const REFILL_INTERVAL_MS = 30 * 60 * 1000;

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
