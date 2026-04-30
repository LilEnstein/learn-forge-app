interface Props { current: number; total: number; }

export function ProgressBar({ current, total }: Props) {
  return (
    <div className="flex gap-1 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-colors ${
            i < current ? "bg-green-500" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}
