import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { LearningMap, type MapLesson } from "@/components/map/LearningMap";

interface Props {
  params: { courseId: string };
}

export default async function CoursePage({ params }: Props) {
  const session = await requireSession();
  const userId = session.user.id!;
  const { courseId } = params;

  const course = await prisma.course.findUnique({
    where: { id: courseId, userId },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              order: true,
              xpReward: true,
              _count: { select: { exercises: true } },
            },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const lessonIds = course.chapters.flatMap((ch) => ch.lessons.map((l) => l.id));
  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: { lessonId: true, status: true },
  });
  const progressMap = new Map(progressRows.map((p) => [p.lessonId, p.status]));

  const mapLessons: MapLesson[] = course.chapters.flatMap((ch) =>
    ch.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      type: l.type as "standard" | "checkpoint",
      order: l.order,
      xpReward: l.xpReward,
      exerciseCount: l._count.exercises,
      status: (progressMap.get(l.id) ?? "locked") as "locked" | "available" | "completed",
      chapterId: ch.id,
      chapterTitle: ch.title,
    }))
  );

  const completedCount = mapLessons.filter((l) => l.status === "completed").length;

  return (
    <LearningMap
      lessons={mapLessons}
      courseId={courseId}
      courseEmoji={course.emoji}
      courseTitle={course.title}
      completedCount={completedCount}
      totalCount={mapLessons.length}
    />
  );
}
