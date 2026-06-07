import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ProgressStep } from "@/types/progress";

export async function GET(_req: NextRequest, { params }: { params: { docId: string } }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.docId, userId: session.user.id },
    select: {
      id: true,
      name: true,
      status: true,
      sizeBytes: true,
      courseId: true,
      _count: { select: { chunks: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Derive whole-pipeline progress so the client can poll this on serverless
  // (where the SSE/LISTEN stream is unavailable). Mirrors the SSE step model:
  // parse/chunk/embed (ingest) -> curriculum -> exercises -> done.
  let step: ProgressStep = "parse";
  let progress = 5;
  let courseId: string | undefined;
  let courseReady = false;

  if (doc.status === "error") {
    step = "error";
  } else if (doc.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: doc.courseId },
      select: { id: true, status: true },
    });
    courseId = course?.id;

    const totalLessons = await prisma.lesson.count({
      where: { chapter: { courseId: doc.courseId } },
    });
    const lessonsWithExercises = totalLessons
      ? await prisma.lesson.count({
          where: { chapter: { courseId: doc.courseId }, exercises: { some: {} } },
        })
      : 0;

    if (doc.status !== "ready") {
      // Still ingesting this document.
      step = doc._count.chunks > 0 ? "embed" : "parse";
      progress = doc._count.chunks > 0 ? 60 : 15;
    } else if (totalLessons === 0) {
      // Ingest done, curriculum not yet produced.
      step = "curriculum";
      progress = 88;
    } else if (lessonsWithExercises < totalLessons) {
      // Curriculum done; exercises generating across lessons.
      step = "exercises";
      progress = 90 + Math.round((lessonsWithExercises / totalLessons) * 9); // 90→99
    } else {
      // Every lesson has exercises → fully ready.
      step = "done";
      progress = 100;
      courseReady = true;
    }
  } else if (doc.status === "ready") {
    step = "embed";
    progress = 85;
  }

  return NextResponse.json({
    id: doc.id,
    name: doc.name,
    status: doc.status,
    sizeBytes: doc.sizeBytes,
    chunkCount: doc._count.chunks,
    // pipeline-wide progress (for serverless polling)
    step,
    progress,
    courseId,
    courseReady,
  });
}
