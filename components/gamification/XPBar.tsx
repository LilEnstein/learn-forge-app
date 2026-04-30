interface Props { totalXp: number; }
export function XPBar({ totalXp }: Props) {
  const level = Math.floor(totalXp / 100) + 1;
  const progress = totalXp % 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Level {level}</span>
        <span>{progress}/100 XP</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
