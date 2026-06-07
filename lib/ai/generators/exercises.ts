import { prisma } from "@/lib/db/prisma";
import { withFailover } from "@/lib/ai/with-failover";
import { retrieveChunks } from "@/lib/ai/rag/retrieve";
import { buildExercisePrompt } from "@/lib/ai/prompts/exercise.prompt";
import { emitCourseProgress } from "@/lib/upload/progress";
import { ExercisesArraySchema } from "./schemas";

/**
 * After a lesson's exercises are written, report progress. Exercises run as N
 * parallel jobs; when the last lesson gets its exercises, fire the terminal
 * "done" so the upload UI completes. Duplicate "done" events are harmless (the
 * client closes the stream on the first one).
 */
async function reportExerciseProgress(courseId: string): Promise<void> {
  const lessons = await prisma.lesson.findMany({
    where: { chapter: { courseId } },
    select: { _count: { select: { exercises: true } } },
  });
  const total = lessons.length;
  const completed = lessons.filter((l) => l._count.exercises > 0).length;

  if (completed >= total && total > 0) {
    await emitCourseProgress(courseId, {
      step: "done",
      message: "Khóa học đã sẵn sàng!",
      detail: `${total}/${total} bài học`,
      progress: 100,
      courseId,
    });
  } else {
    await emitCourseProgress(courseId, {
      step: "exercises",
      message: "Đang tạo bài tập...",
      detail: `${completed}/${total} bài học`,
      progress: Math.round(90 + (completed / Math.max(total, 1)) * 10),
    });
  }
}

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  return raw.trim();
}

export async function generateExercises(lessonId: string): Promise<void> {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          course: { include: { user: { select: { id: true } } } },
        },
      },
    },
  });

  const course = lesson.chapter.course;
  const userId = course.user.id;
  const topicKeywords = lesson.topicKeywords.length > 0 ? lesson.topicKeywords : [lesson.title];

  const queryText = topicKeywords.join(" ");
  const chunks = await withFailover(userId, "embedding", async (provider) => {
    const embedFn = provider.getEmbeddingModel();
    return retrieveChunks(queryText, userId, { courseId: course.id, topK: 10 }, embedFn);
  });

  const { system, user } = buildExercisePrompt({
    lessonTitle: lesson.title,
    topicKeywords,
    chunks: chunks.map((c) => c.content),
  });

  let raw: string;
  try {
    raw = await withFailover(userId, "courseGen", async (provider) => {
      const llm = provider.getLLM("ingest");
      return llm([
        { role: "system", content: system },
        { role: "user", content: user },
      ]);
    });
  } catch (err) {
    console.error(`Exercise generation failed for lesson ${lessonId}:`, err);
    await reportExerciseProgress(course.id);
    return;
  }

  let exercises: ReturnType<typeof ExercisesArraySchema.parse>;
  try {
    exercises = ExercisesArraySchema.parse(JSON.parse(extractJson(raw)));
  } catch {
    console.error(`Invalid exercise JSON for lesson ${lessonId}`);
    await reportExerciseProgress(course.id);
    return;
  }

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    await prisma.exercise.create({
      data: {
        lessonId,
        order: i,
        type: ex.type,
        question: ex.question,
        options: ex.options ?? undefined,
        correctAnswer: ex.correctAnswer as never,
        explanation: ex.explanation ?? null,
        difficulty: ex.difficulty,
        sourceChunkId: chunks[Math.min(i, chunks.length - 1)]?.id ?? null,
      },
    });
  }

  await reportExerciseProgress(course.id);
}
