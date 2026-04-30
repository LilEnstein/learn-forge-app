interface Quest {
  title: string;
  description: string;
  target: number;
  gemReward: number;
}
interface Props { progress: number; completed: boolean; quest: Quest; }

export function DailyQuest({ progress, completed, quest }: Props) {
  const pct = Math.min((progress / quest.target) * 100, 100);
  return (
    <div
      className={`p-3 rounded-xl border ${
        completed ? "border-green-300 bg-green-50" : "border-border"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-sm">{quest.title}</p>
          <p className="text-xs text-muted-foreground">{quest.description}</p>
        </div>
        <span className="text-sm font-semibold text-yellow-500">+{quest.gemReward} 💎</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {progress}/{quest.target}
      </p>
    </div>
  );
}
