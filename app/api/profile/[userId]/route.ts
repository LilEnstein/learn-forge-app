import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentWeekId } from "@/lib/gamification/league";
import { deriveBadges } from "@/lib/profile/badges";

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const weekId = getCurrentWeekId();

  const [userRow, allProgress, xpTransactions, heatmapRows] = await Promise.all([
    // Query 1: User + gamification + streak + league
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        avatarKey: true,
        gamification: { select: { totalXp: true, weeklyXp: true, gems: true } },
        streakRecord: { select: { currentStreak: true, longestStreak: true, frozenAt: true } },
        leagueEntry: {
          where: { weekId },
          select: { league: true, weeklyXp: true, promoted: true, relegated: true },
          take: 1,
        },
      },
    }),

    // Query 2: LessonProgress with full join chain to get courseId
    prisma.lessonProgress.findMany({
      where: { userId },
      select: {
        status: true,
        score: true,
        lesson: {
          select: {
            chapter: {
              select: {
                courseId: true,
                course: { select: { title: true, emoji: true } },
              },
            },
          },
        },
      },
    }),

    // Query 3: XP transactions grouped by ISO week (last 8 weeks)
    prisma.$queryRaw<{ week: string; xp: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('week', "createdAt"), 'IYYY-"W"IW') AS week,
        SUM(amount)::int AS xp
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND type = 'earn_xp'
        AND "createdAt" >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY DATE_TRUNC('week', "createdAt")
    `,

    // Query 4: Heatmap — completedAt grouped by local date (UTC+7)
    prisma.$queryRaw<{ date: string; count: number }[]>`
      SELECT
        TO_CHAR(DATE("completedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "LessonProgress"
      WHERE "userId" = ${userId}
        AND "completedAt" IS NOT NULL
        AND "completedAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE("completedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')
      ORDER BY date
    `,
  ]);

  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Group lessonProgress by courseId
  type CourseStat = { courseId: string; title: string; emoji: string; completed: number; total: number; totalScore: number; scoredCount: number };
  const courseMap = new Map<string, CourseStat>();
  for (const p of allProgress) {
    const courseId = p.lesson.chapter.courseId;
    const existing = courseMap.get(courseId) ?? {
      courseId,
      title: p.lesson.chapter.course.title,
      emoji: p.lesson.chapter.course.emoji,
      completed: 0, total: 0, totalScore: 0, scoredCount: 0,
    };
    existing.total++;
    if (p.status === "completed") existing.completed++;
    if (p.score !== null) { existing.totalScore += p.score; existing.scoredCount++; }
    courseMap.set(courseId, existing);
  }
  const courseStats = Array.from(courseMap.values()).map((c) => ({
    courseId: c.courseId,
    title: c.title,
    emoji: c.emoji,
    completed: c.completed,
    total: c.total,
    accuracy: c.scoredCount > 0 ? Math.round(c.totalScore / c.scoredCount) : null,
  }));

  // Collect all league entries (promoted history) for badge derivation
  const allLeagueEntries = await prisma.leagueEntry.findMany({
    where: { userId },
    select: { promoted: true },
  });

  const badges = deriveBadges({
    streakRecord: userRow.streakRecord ?? { currentStreak: 0, longestStreak: 0 },
    lessonProgress: allProgress.map((p) => ({ score: p.score })),
    courseStats,
    leagueEntries: allLeagueEntries,
  });

  return NextResponse.json({
    user: {
      name: userRow.name,
      avatarKey: userRow.avatarKey,
      totalXp: userRow.gamification?.totalXp ?? 0,
      weeklyXp: userRow.gamification?.weeklyXp ?? 0,
      currentStreak: userRow.streakRecord?.currentStreak ?? 0,
      longestStreak: userRow.streakRecord?.longestStreak ?? 0,
      streakFrozenAt: userRow.streakRecord?.frozenAt ?? null,
      league: userRow.leagueEntry[0]?.league ?? "bronze",
    },
    courseStats,
    xpByWeek: xpTransactions,
    heatmap: heatmapRows,
    badges,
  });
}
