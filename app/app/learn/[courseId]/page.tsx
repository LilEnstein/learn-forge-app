import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Lock, ChevronRight } from "lucide-react";

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
            select: { id: true, title: true, type: true, order: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const lessonIds = course.chapters.flatMap((ch) => ch.lessons.map((l) => l.id));
  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: { lessonId: true, status: true, xpEarned: true },
  });
  const progressMap = new Map(progressRows.map((p) => [p.lessonId, p]));

  const totalLessons = lessonIds.length;
  const completedCount = progressRows.filter((p) => p.status === "completed").length;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-4xl mb-2">{course.emoji}</p>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.description && (
          <p className="text-muted-foreground mt-1 text-sm">{course.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          {completedCount}/{totalLessons} lessons completed
        </p>
        <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all"
            style={{ width: totalLessons > 0 ? `${(completedCount / totalLessons) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-6">
        {course.chapters.map((chapter) => (
          <div key={chapter.id}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {chapter.title}
            </h2>
            <div className="space-y-2">
              {chapter.lessons.map((lesson) => {
                const progress = progressMap.get(lesson.id);
                const status = progress?.status ?? "locked";
                const isLocked = status === "locked";
                const isCompleted = status === "completed";
                const isAvailable = status === "available";

                return (
                  <div key={lesson.id}>
                    {isLocked ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed opacity-50 cursor-not-allowed">
                        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium flex-1">{lesson.title}</span>
                        {lesson.type === "checkpoint" && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            Checkpoint
                          </span>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={`/app/learn/${courseId}/lesson/${lesson.id}`}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-colors hover:bg-accent ${
                          isCompleted ? "bg-green-50 border-green-200" : "border-border"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-violet-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium flex-1">{lesson.title}</span>
                        {lesson.type === "checkpoint" && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            Checkpoint
                          </span>
                        )}
                        {isAvailable && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                            Start
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {course.status === "generating" && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm animate-pulse">Course is still generating — check back soon!</p>
        </div>
      )}
    </div>
  );
}
