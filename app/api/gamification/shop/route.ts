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
