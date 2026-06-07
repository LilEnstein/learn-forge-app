"use client";

import { useRef, useEffect } from "react";
import type { CompanionContext } from "@/lib/companion/useCompanionContext";
import { useCompanionHistory } from "@/lib/companion/useCompanionHistory";
import { useMascot } from "@/hooks/useMascot";
import { MascotFloat } from "@/components/mascot/MascotFloat";
import { useState } from "react";

interface Props {
  context: CompanionContext;
  userId?: string;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-muted px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

export function CompanionChat({ context, userId }: Props) {
  const { messages, setMessages } = useCompanionHistory(userId, context);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { react, show } = useMascot();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Mascot: thinking while streaming, front+nod when done
  useEffect(() => {
    if (isStreaming) {
      react("thinking");
    } else if (messages.length > 1) {
      show("front");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const lastMsg = messages[messages.length - 1];
  // Phase 1: waiting for first token
  const showDots = isStreaming && lastMsg?.role === "assistant" && lastMsg.content === "";
  // Phase 2: streaming — cursor blink handled inside the message bubble

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage = { role: "user" as const, content: text };
    const assistantPlaceholder = { role: "assistant" as const, content: "" };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput("");
    setIsStreaming(true);

    const historyForApi = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForApi, context }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let receivedDone = false;
      let receivedError = false;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.startsWith("data: ")) continue;
          const data = frame.slice(6);
          if (data === "[DONE]") { receivedDone = true; break; }
          if (data === "[ERROR]") { receivedError = true; break; }
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: next[next.length - 1].content + data,
            };
            return next;
          });
        }
        if (receivedDone || receivedError) break;
      }

      if (receivedError || !receivedDone) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (!last.content) {
            next[next.length - 1] = { ...last, content: "Companion gặp sự cố, thử lại nhé.", error: true };
          }
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: "Companion gặp sự cố, thử lại nhé.",
          error: true,
        };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => {
          // Hide the empty assistant placeholder — dots are rendered separately below
          if (isStreaming && i === messages.length - 1 && msg.role === "assistant" && msg.content === "") {
            return null;
          }
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : msg.error
                    ? "bg-red-50 text-red-600 border border-red-200 rounded-bl-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {renderInlineMarkdown(msg.content)}
                {/* Phase 2: cursor blink while streaming */}
                {isStreaming && i === messages.length - 1 && msg.role === "assistant" && msg.content !== "" && (
                  <span className="inline-block w-1.5 h-3.5 bg-current opacity-70 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            </div>
          );
        })}

        {/* Phase 1: bouncing dots while waiting for first token */}
        {showDots && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 border-t p-3 flex gap-2">
        <input
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-500"
          placeholder="Hỏi gì đó..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-violet-700 transition-colors"
        >
          Gửi
        </button>
      </form>

      <MascotFloat position="bottom-left" />
    </div>
  );
}
