import { Mascot } from "@/components/mascots/Mascot";
import { LeagueBadge } from "@/components/gamification/LeagueBadge";
import type { AvatarKey } from "@/lib/mascots/config";

interface Props {
  name: string | null;
  avatarKey: string;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  league: string;
}

export function IdentityBlock({ name, avatarKey, totalXp, currentStreak, longestStreak, league }: Props) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border bg-card">
      <Mascot avatarKey={avatarKey as AvatarKey} size={64} />
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold truncate">{name ?? "Learner"}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-sm font-semibold text-violet-600">{totalXp.toLocaleString()} XP</span>
          <span className="text-sm text-muted-foreground">🔥 {currentStreak} ngày</span>
          <LeagueBadge league={league} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Streak dài nhất: {longestStreak} ngày</p>
      </div>
    </div>
  );
}
