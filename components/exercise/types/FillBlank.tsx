"use client";
import { useState } from "react";

interface Props {
  question: string;
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

export function FillBlank({ question, onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const parts = question.split("___");

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold flex flex-wrap items-center gap-1">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={disabled}
                className="inline-block border-b-2 border-primary bg-transparent outline-none px-1 min-w-[80px] text-center"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
                }}
              />
            )}
          </span>
        ))}
      </div>
      <button
        disabled={!value.trim() || disabled}
        onClick={() => onSubmit(value.trim())}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
