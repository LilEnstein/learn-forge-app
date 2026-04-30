"use client";
import { useState } from "react";

interface Props {
  question: string;
  options: string[];
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

export function MultipleChoice({ question, options, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => setSelected(opt)}
            className={`p-4 rounded-xl border-2 text-left font-medium transition-colors ${
              selected === opt
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        disabled={!selected || disabled}
        onClick={() => selected && onSubmit(selected)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
