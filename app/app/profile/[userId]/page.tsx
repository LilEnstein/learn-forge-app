import { notFound } from "next/navigation";
import { IdentityBlock } from "@/components/profile/IdentityBlock";
import { ProfileTabs } from "@/components/profile/ProfileTabs";

interface Props {
  params: { userId: string };
}

export default async function PublicProfilePage({ params }: Props) {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/profile/${params.userId}`,
    { cache: "no-store" }
  );

  if (!res.ok) notFound();

  const profile = await res.json();

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
        questSummary={null}
      />
    </div>
  );
}
