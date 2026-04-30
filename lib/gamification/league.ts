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
