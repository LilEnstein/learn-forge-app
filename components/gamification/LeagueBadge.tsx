const LEAGUE_COLORS: Record<string, string> = {
  bronze: "text-amber-600",
  silver: "text-gray-400",
  gold: "text-yellow-500",
  platinum: "text-cyan-400",
  diamond: "text-blue-500",
};

interface Props { league: string; }
export function LeagueBadge({ league }: Props) {
  return (
    <span className={`font-semibold capitalize ${LEAGUE_COLORS[league] ?? "text-muted-foreground"}`}>
      {league}
    </span>
  );
}
