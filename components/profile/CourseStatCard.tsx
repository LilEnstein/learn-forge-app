interface Props {
  emoji: string;
  title: string;
  completed: number;
  total: number;
  accuracy: number | null;
}

export function CourseStatCard({ emoji, title, completed, total, accuracy }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <p className="font-semibold truncate flex-1">{title}</p>
        <span className="text-sm font-bold text-violet-600">{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{completed}/{total} bài</span>
        {accuracy !== null && <span>Chính xác: {accuracy}%</span>}
      </div>
    </div>
  );
}
