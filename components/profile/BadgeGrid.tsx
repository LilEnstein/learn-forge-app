import type { Badge } from "@/lib/profile/badges";

interface Props {
  badges: Badge[];
}

export function BadgeGrid({ badges }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Huy hiệu</h3>
      <div className="grid grid-cols-3 gap-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center ${
              badge.earned ? "border-violet-200 bg-violet-50" : "border-muted bg-muted/30 grayscale opacity-50"
            }`}
          >
            <span className="text-2xl">{badge.icon}</span>
            <span className="text-xs font-medium leading-tight">{badge.label}</span>
            {!badge.earned && <span className="text-xs text-muted-foreground">🔒</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
