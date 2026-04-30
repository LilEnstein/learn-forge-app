import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { persistHeartRefill } from "@/lib/gamification/hearts";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const lessonId = params.id;

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
          // correctAnswer intentionally omitted
        },
      },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  return NextResponse.json({ lesson, progress });
}
