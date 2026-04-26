import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireSession();

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  const gamification = await prisma.userGamification.findUnique({
    where: { userId: session.user.id },
  });

  const streak = await prisma.streakRecord.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link key={course.id} href={`/app/learn/${course.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="text-3xl mb-2">{course.emoji}</div>
                    <CardTitle className="text-base line-clamp-2">{course.title}</CardTitle>
                    {course.description && (
                      <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        course.status === "ready"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {course.status === "ready" ? "Ready" : "Generating…"}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
