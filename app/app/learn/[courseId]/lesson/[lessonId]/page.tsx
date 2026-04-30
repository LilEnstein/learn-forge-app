import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { ExerciseScreen } from "@/components/exercise/ExerciseScreen";
import { persistHeartRefill } from "@/lib/gamification/hearts";

interface Props {
  params: { courseId: string; lessonId: string };
}

export default async function LessonPage({ params }: Props) {
  const session = await requireSession();
  const userId = session.user.id!;
  const { courseId, lessonId } = params;

  await persistHeartRefill(userId);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          type: true,
          question: true,
          options: true,
          explanation: true,
          difficulty: true,
        },
      },
    },
  });

  if (!lesson) notFound();

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  if (progress?.status === "locked") {
    redirect(`/app/dashboard`);
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h1 className="text-lg font-semibold mb-6 text-muted-foreground">{lesson.title}</h1>
      <ExerciseScreen
        lessonId={lessonId}
        courseId={courseId}
        exercises={lesson.exercises}
      />
    </div>
  );
}
