export interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
}

interface BadgeInput {
  streakRecord: { currentStreak: number; longestStreak: number };
  lessonProgress: { score: number | null }[];
  courseStats: { completed: number; total: number }[];
  leagueEntries: { promoted: boolean }[];
}

const BADGE_DEFS: Omit<Badge, "earned">[] = [
  { id: "streak7",         label: "7-day streak",    icon: "🔥" },
  { id: "streak30",        label: "30-day streak",   icon: "🔥" },
  { id: "streak100",       label: "100-day streak",  icon: "🔥" },
  { id: "perfect",         label: "Perfect score",   icon: "⭐" },
  { id: "course_complete", label: "Course complete", icon: "🏆" },
  { id: "promoted",        label: "League promoted", icon: "🎖️" },
];

export function deriveBadges(data: BadgeInput): Badge[] {
  const { streakRecord, lessonProgress, courseStats, leagueEntries } = data;
  return BADGE_DEFS.map((def) => {
    let earned = false;
    if (def.id === "streak7")        earned = streakRecord.currentStreak >= 7;
    if (def.id === "streak30")       earned = streakRecord.currentStreak >= 30;
    if (def.id === "streak100")      earned = streakRecord.currentStreak >= 100;
    if (def.id === "perfect")        earned = lessonProgress.some((p) => p.score === 100);
    if (def.id === "course_complete") earned = courseStats.some((c) => c.total > 0 && c.completed === c.total);
    if (def.id === "promoted")       earned = leagueEntries.some((e) => e.promoted);
    return { ...def, earned };
  });
}
