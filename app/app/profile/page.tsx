import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTodayDateString } from "@/lib/gamification/streak";
import { IdentityBlock } from "@/components/profile/IdentityBlock";
import { ProfileTabs } from "@/components/profile/ProfileTabs";

export default async function OwnProfilePage() {
  const session = await requireSession();
  const userId = session.user.id!;

  const [profileRes, questRes] = await Promise.all([
    fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/profile/${userId}`, {
      cache: "no-store",
    }),
    prisma.dailyQuestProgress.findMany({
      where: {
        userId,
        date: getTodayDateString(),
      },
      select: { completed: true },
    }),
  ]);

  if (!profileRes.ok) notFound();
  const profile = await profileRes.json();
  const questCompleted = questRes.filter((q) => q.completed).length;
  const questTotal = questRes.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <IdentityBlock
        name={profile.user.name}
        avatarKey={profile.user.avatarKey}
        totalXp={profile.user.totalXp}
        currentStreak={profile.user.currentStreak}
        longestStreak={profile.user.longestStreak}
        league={profile.user.league}
      />
      <ProfileTabs
        heatmap={profile.heatmap}
        xpByWeek={profile.xpByWeek}
        badges={profile.badges}
        courseStats={profile.courseStats}
        currentStreak={profile.user.currentStreak}
        longestStreak={profile.user.longestStreak}
        questSummary={questTotal > 0 ? { completed: questCompleted, total: questTotal } : null}
      />
    </div>
  );
}
