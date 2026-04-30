import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentWeekId } from "@/lib/gamification/league";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  const weekId = getCurrentWeekId();

  let userIds: string[] = [];
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { topic: true },
    });
    if (course) {
      const sameTopic = await prisma.course.findMany({
        where: { topic: course.topic },
        select: { userId: true },
      });
      userIds = sameTopic.map((c) => c.userId);
    }
  }

  const entries = await prisma.leagueEntry.findMany({
    where: {
      weekId,
      ...(userIds.length > 0 ? { userId: { in: userIds } } : {}),
    },
    orderBy: { weeklyXp: "desc" },
    include: {
      user: { select: { id: true, name: true, image: true, avatarKey: true } },
    },
    take: 50,
  });

  return NextResponse.json(entries);
}
