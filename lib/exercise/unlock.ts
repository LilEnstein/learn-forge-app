import { prisma } from "@/lib/db/prisma";

export async function unlockNextLesson(
  lessonId: string,
  userId: string
): Promise<void> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          lessons: { orderBy: { order: "asc" } },
          course: {
            include: {
              chapters: {
                include: { lessons: { orderBy: { order: "asc" } } },
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!lesson) return;

  const chapter = lesson.chapter;
  const lessonsInChapter = chapter.lessons;
  const currentIdx = lessonsInChapter.findIndex((l) => l.id === lessonId);

  let nextLesson = lessonsInChapter[currentIdx + 1] ?? null;

  if (!nextLesson) {
    const chapters = lesson.chapter.course.chapters;
    const chapterIdx = chapters.findIndex((c) => c.id === chapter.id);
    const nextChapter = chapters[chapterIdx + 1];
    if (nextChapter) {
      nextLesson = nextChapter.lessons[0] ?? null;
    }
  }

  if (!nextLesson) return;

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId: nextLesson.id } },
    create: { userId, lessonId: nextLesson.id, status: "available" },
    update: { status: "available" },
  });
}
