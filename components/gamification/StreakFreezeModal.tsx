"use client";
interface Props { onConfirm: () => void; onCancel: () => void; gemsBalance: number; }

export function StreakFreezeModal({ onConfirm, onCancel, gemsBalance }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
        <div className="text-5xl">🧊</div>
        <h2 className="text-xl font-bold">Streak Freeze</h2>
        <p className="text-muted-foreground text-sm">
          Protect your streak for one missed day. Costs 100 gems.
        </p>
        <p className="font-semibold">Your balance: {gemsBalance} 💎</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border rounded-xl font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={gemsBalance < 100}
            className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Buy (100 💎)
          </button>
        </div>
      </div>
    </div>
  );
}
