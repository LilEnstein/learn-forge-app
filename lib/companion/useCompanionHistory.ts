"use client";

import { useState, useEffect } from "react";
import type { CompanionContext } from "./useCompanionContext";

export interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const MAX_MESSAGES = 20;
const WELCOME: Message = { role: "assistant", content: "Xin chào! Tôi có thể giúp gì cho bạn?" };

function storageKey(userId: string, context: CompanionContext): string {
  const suffix = context.type === "general" ? "general" : context.courseId;
  return `companion-history-${userId}-${suffix}`;
}

export function useCompanionHistory(userId: string | undefined, context: CompanionContext) {
  const key = userId ? storageKey(userId, context) : null;

  const [messages, setMessages] = useState<Message[]>([WELCOME]);

  // Load from localStorage when key becomes available or changes (e.g. switching courses)
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // Corrupted data — fall through to welcome message
    }
    setMessages([WELCOME]);
  }, [key]);

  // Persist to localStorage on every change (skips error messages)
  useEffect(() => {
    if (!key) return;
    try {
      const persistable = messages
        .filter((m) => !m.error)
        .slice(-MAX_MESSAGES);
      localStorage.setItem(key, JSON.stringify(persistable));
    } catch {
      // QuotaExceeded — ignore, keep in-memory only
    }
  }, [messages, key]);

  return { messages, setMessages };
}
