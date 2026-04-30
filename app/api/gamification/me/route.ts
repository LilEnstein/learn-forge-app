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
