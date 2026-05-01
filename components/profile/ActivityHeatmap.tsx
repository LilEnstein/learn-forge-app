interface Props {
  data: { date: string; count: number }[];
}

function getColorClass(count: number): string {
  if (count === 0) return "bg-muted";
  if (count === 1) return "bg-green-200";
  if (count === 2) return "bg-green-400";
  return "bg-green-600";
}

export function ActivityHeatmap({ data }: Props) {
  // Build a lookup map date → count
  const countByDate = new Map(data.map((d) => [d.date, d.count]));

  // Generate all days for the last 52 weeks (364 days), aligned to week columns
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    cells.push({ date: dateStr, count: countByDate.get(dateStr) ?? 0 });
  }

  // Split into 52 columns of 7 days each
  const weeks: typeof cells[] = [];
  for (let w = 0; w < 52; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Hoạt động — 12 tháng</h3>
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell) => (
              <div
                key={cell.date}
                className={`w-3 h-3 rounded-sm ${getColorClass(cell.count)}`}
                title={`${cell.date}: ${cell.count} bài`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>Ít</span>
        <div className="w-3 h-3 rounded-sm bg-muted" />
        <div className="w-3 h-3 rounded-sm bg-green-200" />
        <div className="w-3 h-3 rounded-sm bg-green-400" />
        <div className="w-3 h-3 rounded-sm bg-green-600" />
        <span>Nhiều</span>
      </div>
    </div>
  );
}
