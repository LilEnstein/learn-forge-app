interface Props { streak: number; }
export function StreakBadge({ streak }: Props) {
  return (
    <div className="flex items-center gap-1 font-semibold text-orange-500">
      <span>🔥</span>
      <span>{streak}</span>
    </div>
  );
}
