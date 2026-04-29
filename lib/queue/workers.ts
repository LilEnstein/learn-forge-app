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
}
