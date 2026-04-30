interface Props { gems: number; }
export function GemCounter({ gems }: Props) {
  return (
    <div className="flex items-center gap-1 font-semibold text-yellow-500">
      <span>💎</span>
      <span>{gems}</span>
    </div>
  );
}
