# Feature 07 — AI Companion

## Overview
A streaming AI chat assistant that knows the user's uploaded documents (via RAG) and the current lesson context. Accessible as a floating button or sidebar throughout the app.

---

## User Stories
- As a user, I can open a chat assistant at any time while studying
- As a user, the companion answers questions grounded in my uploaded documents
- As a user, the companion is aware of which lesson I am currently studying
- As a user, I receive proactive notifications (streak warnings, weak-area nudges, milestones)
- As a user, responses stream in real time (no waiting for full response)
- As a user, my conversation history persists when I navigate away and return
- As a user, I see a live typing indicator so I know when the AI is responding

---

## System Prompt Template
```
System: "You are an AI learning assistant for {username}. They are studying {courseTitle}.
Source documents: [retrieved chunks relevant to the question].
Current lesson: {lessonTitle}.
Answer in Vietnamese, concisely, use real-world examples."
```

---

## RAG Integration
- On each user message: embed query → cosine search across user's document chunks
- Top-K relevant chunks injected into system prompt context
- Companion only has access to the current user's uploaded documents

---

## Streaming
- Uses SSE (`text/event-stream`) via a custom `ReadableStream` in the API route
- Response streams token-by-token to the frontend
- Frontend renders markdown as it arrives

---

## Typing Indicator

Two distinct phases from user send → response complete:

```
User sends → [Phase 1: waiting ~0–1.5s] → [Phase 2: streaming] → done
                    ↓                              ↓
           Bouncing dots ● ● ●           Blinking cursor |
           (no tokens yet)               (tokens arriving)
```

**Phase 1 — Bouncing dots** (`isStreaming && lastMessage.content === ""`):
- Rendered as a standalone assistant bubble (same left-aligned style as regular AI bubbles)
- Three dots, each a `w-2 h-2` rounded circle with `animate-bounce`
- Sequential delay: dot 1 = 0 ms, dot 2 = 150 ms, dot 3 = 300 ms
- Pure CSS — zero additional dependencies

**Phase 2 — Blinking cursor** (`isStreaming && lastMessage.content !== ""`):
- A `w-1.5 h-3.5` inline `span` appended after the last token
- `animate-pulse` (Tailwind built-in), aligned to text baseline via `align-middle`
- Removed when streaming ends

---

## Chat History Persistence

History is stored in `localStorage` — no additional DB table required.

**Key schema:**
```
companion-history-{userId}-{courseId}   // lesson or map context
companion-history-{userId}-general      // dashboard and all other pages
```

**Rules:**
- Load on mount (or when the key changes, e.g. user switches course)
- Save on every message append
- Hard cap: **20 most recent messages** per key — trim oldest when exceeded
- On localStorage error (QuotaExceeded, parse failure): silently fall back to in-memory only

**Scope:** One history per `courseId`, not per lesson. Switching from lesson A to lesson B in the same course continues the same conversation thread.

---

## Error Surfacing

When the LLM call throws server-side:
1. Server logs the error to console
2. Server sends `data: [ERROR]\n\n` SSE frame before `data: [DONE]\n\n`
3. Client detects `[ERROR]`, renders the last assistant bubble as an error state (red border, error text "Companion gặp sự cố, thử lại nhé.")
4. Error messages are **not persisted** to localStorage

---

## Proactive Notifications
Delivered via server-sent events (SSE) or polling:

| Trigger | Message |
|---|---|
| Streak about to break (2h left) | "Bạn sắp mất streak! Còn 2 tiếng nữa." |
| Repeated mistakes in a topic | "Bạn hay sai ở phần X, muốn ôn lại không?" |
| Streak milestone reached | "Chúc mừng! 7 ngày liên tiếp 🔥" |

---

## API Routes
```
POST /api/companion     # AI companion chat (streaming response)
```

Request body:
```typescript
{
  messages: { role: "user" | "assistant", content: string }[],
  courseId?: string,
  lessonId?: string,
}
```

---

## Key Files
```
app/app/companion/page.tsx
components/companion/
  CompanionChat.tsx          # Chat UI with streaming, dots, cursor blink
  CompanionBubble.tsx        # Floating bubble button + chat panel
lib/companion/
  useCompanionContext.ts     # Derives lesson/map/general context from pathname
  useCompanionHistory.ts     # localStorage persistence hook (20-msg cap per courseId)
lib/ai/
  provider.ts                # Multi-provider LLM switcher (openai | gemini | ollama | groq | cerebras)
  rag/retrieve.ts            # Chunk retrieval for companion context
app/api/companion/route.ts   # SSE streaming endpoint
```

---

## Environment Variables
```bash
AI_PROVIDER="gemini"          # "openai" | "gemini" | "ollama" | "groq" | "cerebras" | "openai-compat"

# OpenAI
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o"

# Gemini (default)
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.0-flash"

# Ollama (local)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1"
```

---

## Privacy Constraint
The companion retrieves chunks only from documents belonging to the authenticated user. No cross-user data leakage.
