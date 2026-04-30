"use client";

import { useState, useEffect } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";

interface Props {
  question: string;
  language?: string;
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

async function loadLanguage(lang: string): Promise<void> {
  switch (lang) {
    case "python":
      // @ts-ignore — no types for prismjs sub-components
      await import("prismjs/components/prism-python");
      break;
    case "sql":
      // @ts-ignore — no types for prismjs sub-components
      await import("prismjs/components/prism-sql");
      break;
    case "typescript":
      // @ts-ignore — no types for prismjs sub-components
      await import("prismjs/components/prism-typescript");
      break;
    case "bash":
      // @ts-ignore — no types for prismjs sub-components
      await import("prismjs/components/prism-bash");
      break;
    // "javascript" is statically imported above — no case needed
  }
}

function highlightPart(part: string, language: string): string {
  const safeLanguage = Prism.languages[language] ? language : "javascript";
  return part?.trim()
    ? Prism.highlight(part, Prism.languages[safeLanguage], safeLanguage)
    : "";
}

export function CodeFillBlank({ question, language = "javascript", onSubmit, disabled }: Props) {
  const parts = question.split("___");
  const blankCount = parts.length - 1;
  const [values, setValues] = useState<string[]>(Array(blankCount).fill(""));
  const [highlightedParts, setHighlightedParts] = useState<string[]>(parts.map(() => ""));

  useEffect(() => {
    let cancelled = false;
    async function highlight() {
      await loadLanguage(language);
      if (cancelled) return;
      setHighlightedParts(parts.map((p) => highlightPart(p, language)));
    }
    highlight();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, question]);

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
            {highlightedParts[i] ? (
              <span dangerouslySetInnerHTML={{ __html: highlightedParts[i] }} />
            ) : (
              part
            )}
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
