import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CoursesGrid } from "@/components/dashboard/CoursesGrid";
import { DashboardMascot } from "@/components/dashboard/DashboardMascot";

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayString() {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
}

function computeStreakWarning(lastActivityDate: string | null, currentStreak: number): boolean {
  if (!lastActivityDate || currentStreak === 0) return false
  if (lastActivityDate === todayString()) return false   // already studied today
  if (lastActivityDate !== yesterdayString()) return false // streak already broken
  // Streak is alive but user hasn't studied yet — warn if within 2 hours of midnight
  const hoursLeft = 23 - new Date().getHours()
  return hoursLeft <= 2
}

export default async function DashboardPage() {
  const session = await requireSession();

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      title: true,
      emoji: true,
      status: true,
    },
  });

  const gamification = await prisma.userGamification.findUnique({
    where: { userId: session.user.id },
  });

  const streak = await prisma.streakRecord.findUnique({
    where: { userId: session.user.id },
  });

  const currentStreak = streak?.currentStreak ?? 0
  const streakWarning = computeStreakWarning(streak?.lastActivityDate ?? null, currentStreak)
  const streakMilestone = currentStreak >= 7

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <DashboardMascot
        currentStreak={currentStreak}
        streakWarning={streakWarning}
        streakMilestone={streakMilestone}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {session.user.name?.split(" ")[0] ?? "Learner"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Keep your streak alive today!</p>
        </div>
        <Link href="/app/upload">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New course
          </Button>
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-orange-500">🔥 {streak?.currentStreak ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Day streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-violet-600">{gamification?.totalXp ?? 0} XP</p>
            <p className="text-sm text-muted-foreground mt-1">Total XP</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-yellow-500">💎 {gamification?.gems ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Gems</p>
          </CardContent>
        </Card>
      </div>

      {/* Courses */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your courses</h2>

        {courses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No courses yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a document to generate your first learning course
                </p>
              </div>
              <Link href="/app/upload">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Upload a document
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <CoursesGrid initial={courses} />
        )}
      </div>
    </div>
  );
}
