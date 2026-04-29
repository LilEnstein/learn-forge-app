import { prisma } from "@/lib/db/prisma";
import { getLLM } from "@/lib/ai/provider";
import { retrieveChunks } from "@/lib/ai/rag/retrieve";
import { buildCurriculumPrompt } from "@/lib/ai/prompts/curriculum.prompt";
import { CurriculumSchema } from "./schemas";

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return raw.trim();
}

export async function generateCurriculum(courseId: string): Promise<void> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: { user: { select: { id: true } } },
  });

  // Skip if already generated
  const existingChapters = await prisma.chapter.count({ where: { courseId } });
  if (existingChapters > 0) return;

  const chunks = await retrieveChunks(course.title, course.user.id, { courseId, topK: 30 });
  const { system, user } = buildCurriculumPrompt({
    chunks: chunks.map((c) => c.content),
    courseTitle: course.title,
    topic: course.topic,
  });

  const llm = getLLM();
  let raw: string;
  try {
    raw = await llm([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
  } catch (err) {
    await prisma.course.update({ where: { id: courseId }, data: { status: "error" } });
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    // Retry once
    try {
      const raw2 = await llm([
        { role: "system", content: system },
        { role: "user", content: user },
        { role: "assistant", content: raw },
        { role: "user", content: "The JSON was invalid. Please respond with only valid JSON, no other text." },
      ]);
      parsed = JSON.parse(extractJson(raw2));
    } catch {
      await prisma.course.update({ where: { id: courseId }, data: { status: "error" } });
      throw new Error(`Failed to parse curriculum JSON for course ${courseId}`);
    }
  }

  const curriculum = CurriculumSchema.parse(parsed);

  await prisma.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: courseId },
      data: {
        title: curriculum.title,
        description: curriculum.description,
        emoji: curriculum.emoji,
      },
    });

    const lessonIds: string[] = [];

    for (let ci = 0; ci < curriculum.chapters.length; ci++) {
      const chapterData = curriculum.chapters[ci];
      const chapter = await tx.chapter.create({
        data: { courseId, title: chapterData.title, order: ci },
      });

      for (let li = 0; li < chapterData.lessons.length; li++) {
        const lessonData = chapterData.lessons[li];
        const lesson = await tx.lesson.create({
          data: {
            chapterId: chapter.id,
            title: lessonData.title,
            order: li,
            type: lessonData.type ?? "standard",
            xpReward: 10,
            gemReward: lessonData.type === "checkpoint" ? 5 : 0,
            topicKeywords: lessonData.topic_keywords,
          },
        });
        lessonIds.push(lesson.id);
      }
    }

    await tx.course.update({ where: { id: courseId }, data: { status: "ready" } });

    return lessonIds;
  }).then(async () => {
    // Enqueue exercise generation for all lessons
    const lessons = await prisma.lesson.findMany({
      where: { chapter: { courseId } },
      select: { id: true },
    });

    const { sendJob } = await import("@/lib/queue/boss");
    const { generateExercises } = await import("@/lib/ai/generators/exercises");
    for (const lesson of lessons) {
      await sendJob("generate-exercises", { lessonId: lesson.id });
      // Fire directly in background — pg-boss workers may not be running in dev
      generateExercises(lesson.id).catch((e) =>
        console.error("[curriculum] generateExercises failed:", lesson.id, e)
      );
    }
  });
}
