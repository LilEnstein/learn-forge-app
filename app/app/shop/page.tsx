"use client";

import { useGamification } from "@/hooks/useGamification";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GemCounter } from "@/components/gamification/GemCounter";
import { StreakFreezeModal } from "@/components/gamification/StreakFreezeModal";

const SHOP_ITEMS = [
  { id: "streak_freeze", name: "Streak Freeze", description: "Protect your streak for one missed day", cost: 100, emoji: "🧊" },
  { id: "heart_refill", name: "Heart Refill", description: "Instantly refill all hearts", cost: 150, emoji: "❤️" },
  { id: "weekend_shield", name: "Weekend Shield", description: "No streak loss on weekends", cost: 200, emoji: "🛡️" },
  { id: "cosmetic_theme", name: "Dark Theme", description: "Unlock dark mode cosmetic", cost: 500, emoji: "🎨" },
] as const;

export default function ShopPage() {
  const { data: gamification, isLoading } = useGamification();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);

  async function purchase(itemId: string) {
    setPurchasing(itemId);
    const res = await fetch("/api/gamification/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: itemId }),
    });
    setPurchasing(null);
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["gamification"] });
    else {
      const err = await res.json();
      alert(err.error ?? "Purchase failed");
    }
  }

  if (isLoading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shop</h1>
        <GemCounter gems={gamification?.gems ?? 0} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SHOP_ITEMS.map((item) => (
          <div key={item.id} className="border rounded-xl p-4 space-y-3">
            <div className="text-3xl">{item.emoji}</div>
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <button
              onClick={() => item.id === "streak_freeze" ? setShowFreezeModal(true) : purchase(item.id)}
              disabled={purchasing === item.id || (gamification?.gems ?? 0) < item.cost}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {item.cost} 💎
            </button>
          </div>
        ))}
      </div>

      {showFreezeModal && (
        <StreakFreezeModal
          gemsBalance={gamification?.gems ?? 0}
          onConfirm={async () => { await purchase("streak_freeze"); setShowFreezeModal(false); }}
          onCancel={() => setShowFreezeModal(false)}
        />
      )}
    </div>
  );
}
