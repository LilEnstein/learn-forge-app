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
