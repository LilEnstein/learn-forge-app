import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { validateAnswer } from "@/lib/exercise/validate";
import { deductHeart, computeHearts } from "@/lib/gamification/hearts";
import { calculateXp, awardXp } from "@/lib/gamification/xp";
import { awardGems } from "@/lib/gamification/gems";
import { recordActivity } from "@/lib/gamification/streak";
import { updateQuestProgress } from "@/lib/gamification/quests";
import { addWeeklyXp } from "@/lib/gamification/league";
import { unlockNextLesson } from "@/lib/exercise/unlock";

const SubmitSchema = z.object({
  exerciseId: z.string(),
  answer: z.unknown(),
  timeSpentMs: z.number().int().nonnegative(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const lessonId = params.id;

  const body = await req.json().catch(() => null);
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { exerciseId, answer } = parsed.data;

  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise || exercise.lessonId !== lessonId) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  const correct = validateAnswer(exercise, answer);

  if (!correct) {
    // Mark session as imperfect (wrong answer given)
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, status: "in_progress", answeredIds: [], perfect: false },
      update: { perfect: false },
    });
    const { heartsRemaining, heartsExhausted } = await deductHeart(userId);
    return NextResponse.json({
      correct: false,
      explanation: exercise.explanation,
      heartsRemaining,
      heartsExhausted,
    });
  }

  // Upsert progress record if not exists
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status: "in_progress", answeredIds: [], perfect: true },
    update: {},
  });

  const currentAnswered = progress.answeredIds as string[];

  // Get current hearts for response
  const gamification = await prisma.userGamification.findUnique({ where: { userId } });
  const { hearts: heartsRemaining } = gamification
    ? computeHearts(gamification)
    : { hearts: 5 };

  // Already answered this exercise — idempotent return
  if (currentAnswered.includes(exerciseId)) {
    return NextResponse.json({ correct: true, explanation: exercise.explanation, heartsRemaining });
  }

  const updatedAnswered = [...currentAnswered, exerciseId];
  await prisma.lessonProgress.update({
    where: { userId_lessonId: { userId, lessonId } },
    data: { answeredIds: updatedAnswered },
  });

  const totalExercises = await prisma.exercise.count({ where: { lessonId } });
  const lessonComplete = updatedAnswered.length >= totalExercises;

  if (!lessonComplete) {
    return NextResponse.json({ correct: true, explanation: exercise.explanation, heartsRemaining });
  }

  // Idempotency: don't double-award if already completed
  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  if (existing?.status === "completed") {
    return NextResponse.json({ correct: true, explanation: exercise.explanation, heartsRemaining, lessonComplete: true });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  const perfect = existing?.perfect ?? true;
  const { xp, gems } = calculateXp(lesson?.type ?? "standard", perfect);

  let streakDay = 1;

  await prisma.$transaction(async (tx) => {
    await tx.lessonProgress.update({
      where: { userId_lessonId: { userId, lessonId } },
      data: {
        status: "completed",
        score: Math.round((updatedAnswered.length / totalExercises) * 100),
        xpEarned: xp,
        attempts: { increment: 1 },
        completedAt: new Date(),
      },
    });
    await awardXp(userId, xp, "lesson_complete", tx);
    await awardGems(userId, gems, "lesson_complete", tx);
    const { currentStreak } = await recordActivity(userId, tx);
    streakDay = currentStreak;
    await updateQuestProgress(
      userId,
      { lessonCompleted: true, xpEarned: xp, perfectScore: perfect },
      tx
    );
  });

  await addWeeklyXp(userId, xp);
  await unlockNextLesson(lessonId, userId);

  return NextResponse.json({
    correct: true,
    explanation: exercise.explanation,
    heartsRemaining,
    xpEarned: xp,
    gemsEarned: gems,
    streakDay,
    lessonComplete: true,
  });
}
