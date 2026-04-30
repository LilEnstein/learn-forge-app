"use client";
import { useRouter } from "next/navigation";

interface Props {
  onUseGems: () => void;
  gemsBalance: number;
}

export function NoHeartsModal({ onUseGems, gemsBalance }: Props) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
        <div className="text-5xl">💔</div>
        <h2 className="text-xl font-bold">Out of hearts!</h2>
        <p className="text-muted-foreground text-sm">
          Wait 30 minutes for a heart to refill, or use 150 gems.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onUseGems}
            disabled={gemsBalance < 150}
            className="w-full py-3 bg-yellow-500 text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Use 150 💎 to refill ({gemsBalance} available)
          </button>
          <button
            onClick={() => router.push("/app/dashboard")}
            className="w-full py-3 border rounded-xl font-semibold"
          >
            Wait for refill
          </button>
        </div>
      </div>
    </div>
  );
}
