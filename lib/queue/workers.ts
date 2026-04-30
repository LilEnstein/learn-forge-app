import { getBoss } from "./boss";
import type { Job } from "pg-boss";

let registered = false;

export async function startWorkers(): Promise<void> {
  if (registered) return;
  registered = true;

  const boss = await getBoss();

  for (const q of ["ingest-document", "generate-curriculum", "generate-exercises"]) {
    await boss.createQueue(q);
  }

  boss.work<{ documentId: string }>("ingest-document", async (jobs: Job<{ documentId: string }>[]) => {
    const { ingestDocument } = await import("@/lib/upload/ingest");
    for (const job of jobs) {
      await ingestDocument(job.data.documentId);
    }
  });

  boss.work<{ courseId: string }>("generate-curriculum", async (jobs: Job<{ courseId: string }>[]) => {
    const { generateCurriculum } = await import("@/lib/ai/generators/curriculum");
    for (const job of jobs) {
      await generateCurriculum(job.data.courseId);
    }
  });

  boss.work<{ lessonId: string }>("generate-exercises", async (jobs: Job<{ lessonId: string }>[]) => {
    const { generateExercises } = await import("@/lib/ai/generators/exercises");
    for (const job of jobs) {
      await generateExercises(job.data.lessonId);
    }
  });

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
    const now = new Date();
    const prevWeek = new Date(now.getTime() - 7 * 86_400_000);
    const jan1 = new Date(prevWeek.getFullYear(), 0, 1);
    const weekNum = Math.ceil(
      ((prevWeek.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7
    );
    const prevWeekId = `${prevWeek.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    await finalizeWeek(prevWeekId);
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.userGamification.updateMany({ data: { weeklyXp: 0 } });
  });
}
