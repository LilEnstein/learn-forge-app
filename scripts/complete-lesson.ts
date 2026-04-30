/**
 * Dev script: force-complete a lesson and unlock the next one.
 * Usage:
 *   npx tsx scripts/complete-lesson.ts <lessonId> [email]
 *
 * Example:
 *   npx tsx scripts/complete-lesson.ts cmoiyja2l001ox8k6m391o8zq
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const lessonId = process.argv[2];
  const email = process.argv[3] ?? "brolai1204@gmail.com";

  if (!lessonId) {
    console.error("Usage: npx tsx scripts/complete-lesson.ts <lessonId> [email]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }
  const userId = user.id;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      exercises: { select: { id: true } },
      chapter: {
        include: {
          lessons: { orderBy: { order: "asc" }, select: { id: true } },
          course: {
            include: {
              chapters: {
                orderBy: { order: "asc" },
                include: { lessons: { orderBy: { order: "asc" }, select: { id: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!lesson) {
    console.error(`Lesson not found: ${lessonId}`);
    process.exit(1);
  }

  // Mark lesson as completed
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      status: "completed",
      answeredIds: lesson.exercises.map((e) => e.id),
      score: 100,
      xpEarned: lesson.xpReward,
      perfect: true,
      attempts: 1,
      completedAt: new Date(),
    },
    update: {
      status: "completed",
      answeredIds: lesson.exercises.map((e) => e.id),
      score: 100,
      xpEarned: lesson.xpReward,
      completedAt: new Date(),
    },
  });
  console.log(`✓ Marked lesson "${lesson.title}" as completed`);

  // Find and unlock next lesson
  const lessonsInChapter = lesson.chapter.lessons;
  const currentIdx = lessonsInChapter.findIndex((l) => l.id === lessonId);
  let nextLessonId: string | null = lessonsInChapter[currentIdx + 1]?.id ?? null;

  if (!nextLessonId) {
    const chapters = lesson.chapter.course.chapters;
    const chapterIdx = chapters.findIndex((c) => c.id === lesson.chapter.id);
    nextLessonId = chapters[chapterIdx + 1]?.lessons[0]?.id ?? null;
  }

  if (nextLessonId) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: nextLessonId } },
      create: { userId, lessonId: nextLessonId, status: "available" },
      update: { status: "available" },
    });
    console.log(`✓ Unlocked next lesson: ${nextLessonId}`);
  } else {
    console.log("  (No next lesson — this is the last lesson in the course)");
  }

  // Also restore hearts to max
  await prisma.userGamification.updateMany({
    where: { userId },
    data: { hearts: 5, lastHeartAt: null },
  });
  console.log(`✓ Hearts restored to 5`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
