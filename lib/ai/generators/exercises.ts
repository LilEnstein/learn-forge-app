import { prisma } from "@/lib/db/prisma";
import { getLLM } from "@/lib/ai/provider";
import { retrieveChunks } from "@/lib/ai/rag/retrieve";
import { buildExercisePrompt } from "@/lib/ai/prompts/exercise.prompt";
import { ExercisesArraySchema } from "./schemas";

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
  const chunks = await retrieveChunks(queryText, userId, { courseId: course.id, topK: 10 });

  const { system, user } = buildExercisePrompt({
    lessonTitle: lesson.title,
    topicKeywords,
    chunks: chunks.map((c) => c.content),
  });

  const llm = getLLM();
  let raw: string;
  try {
    raw = await llm([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
  } catch (err) {
    console.error(`Exercise generation failed for lesson ${lessonId}:`, err);
    return;
  }

  let exercises: ReturnType<typeof ExercisesArraySchema.parse>;
  try {
    exercises = ExercisesArraySchema.parse(JSON.parse(extractJson(raw)));
  } catch {
    console.error(`Invalid exercise JSON for lesson ${lessonId}`);
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
}
