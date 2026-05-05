/**
 * Dev script: print all exercises in a lesson including correctAnswer.
 * Usage: npx tsx scripts/inspect-lesson.ts <lessonId>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const lessonId = process.argv[2];
  if (!lessonId) {
    console.error("Usage: npx tsx scripts/inspect-lesson.ts <lessonId>");
    process.exit(1);
  }

  const exercises = await prisma.exercise.findMany({
    where: { lessonId },
    orderBy: { order: "asc" },
    select: { id: true, order: true, type: true, question: true, options: true, correctAnswer: true },
  });

  for (const ex of exercises) {
    console.log(`\n--- Exercise ${ex.order + 1} (${ex.type}) ---`);
    console.log("Q:", ex.question);
    console.log("options:", JSON.stringify(ex.options, null, 2));
    console.log("correctAnswer:", JSON.stringify(ex.correctAnswer));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
