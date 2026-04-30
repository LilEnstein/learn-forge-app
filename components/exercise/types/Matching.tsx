"use client";
import { useState } from "react";

interface Pair { left: string; right: string; }

interface Props {
  question: string;
  options: { pairs: Pair[] };
  onSubmit: (answer: Pair[]) => void;
  disabled: boolean;
}

export function Matching({ question, options, onSubmit, disabled }: Props) {
  const pairs = options.pairs;
  const leftItems = pairs.map((p) => p.left);
  const [rightItems] = useState(() => [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Pair[]>([]);

  function handleLeftClick(left: string) {
    if (disabled) return;
    setSelectedLeft((s) => (s === left ? null : left));
  }

  function handleRightClick(right: string) {
    if (disabled || !selectedLeft) return;
    const newMatched = matched.filter((p) => p.left !== selectedLeft && p.right !== right);
    setMatched([...newMatched, { left: selectedLeft, right }]);
    setSelectedLeft(null);
  }

  const getMatchedRight = (left: string) => matched.find((p) => p.left === left)?.right;
  const getMatchedLeft = (right: string) => matched.find((p) => p.right === right)?.left;

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {leftItems.map((left) => (
            <button
              key={left}
              onClick={() => handleLeftClick(left)}
              disabled={disabled}
              className={`w-full p-3 rounded-xl border-2 text-left text-sm font-medium transition-colors ${
                selectedLeft === left
                  ? "border-primary bg-primary/10"
                  : getMatchedRight(left)
                  ? "border-green-400 bg-green-50"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {left}
              {getMatchedRight(left) && (
                <span className="text-xs text-muted-foreground ml-1">→ {getMatchedRight(left)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map((right) => (
            <button
              key={right}
              onClick={() => handleRightClick(right)}
              disabled={disabled || !selectedLeft}
              className={`w-full p-3 rounded-xl border-2 text-left text-sm font-medium transition-colors ${
                getMatchedLeft(right)
                  ? "border-green-400 bg-green-50"
                  : selectedLeft
                  ? "border-primary/50 hover:border-primary cursor-pointer"
                  : "border-border"
              }`}
            >
              {right}
            </button>
          ))}
        </div>
      </div>
      <button
        disabled={matched.length < pairs.length || disabled}
        onClick={() => onSubmit(matched)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
