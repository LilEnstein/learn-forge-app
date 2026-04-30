"use client";
import { useState } from "react";

interface Props {
  question: string;
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

export function CodeFillBlank({ question, onSubmit, disabled }: Props) {
  const parts = question.split("___");
  const blankCount = parts.length - 1;
  const [values, setValues] = useState<string[]>(Array(blankCount).fill(""));

  function updateValue(i: number, v: string) {
    setValues((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function buildAnswer(): string {
    return parts.reduce((acc, part, i) => acc + part + (values[i] ?? ""), "");
  }

  const allFilled = values.every((v) => v.trim().length > 0);

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">Complete the code</p>
      <pre className="bg-muted rounded-xl p-4 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input
                type="text"
                value={values[i]}
                onChange={(e) => updateValue(i, e.target.value)}
                disabled={disabled}
                className="inline-block bg-yellow-100 border-b-2 border-yellow-400 outline-none px-1 font-mono text-sm min-w-[60px]"
                style={{ width: `${Math.max((values[i] ?? "").length + 4, 8)}ch` }}
              />
            )}
          </span>
        ))}
      </pre>
      <button
        disabled={!allFilled || disabled}
        onClick={() => onSubmit(buildAnswer())}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
