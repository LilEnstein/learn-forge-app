import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentWeekId } from "@/lib/gamification/league";
import { LeagueBadge } from "@/components/gamification/LeagueBadge";

export default async function LeaderboardPage() {
  const session = await requireSession();
  const userId = session.user.id!;
  const weekId = getCurrentWeekId();

  const entries = await prisma.leagueEntry.findMany({
    where: { weekId },
    orderBy: { weeklyXp: "desc" },
    include: {
      user: { select: { id: true, name: true, avatarKey: true } },
    },
    take: 50,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Weekly League</h1>
      <p className="text-sm text-muted-foreground">Week {weekId}</p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No entries yet this week. Complete a lesson to appear!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                entry.userId === userId ? "bg-primary/5 border-primary" : ""
              }`}
            >
              <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
              <div className="flex-1">
                <p className="font-semibold">{entry.user.name ?? "Learner"}</p>
                <LeagueBadge league={entry.league} />
              </div>
              <p className="font-bold text-violet-600">{entry.weeklyXp} XP</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
