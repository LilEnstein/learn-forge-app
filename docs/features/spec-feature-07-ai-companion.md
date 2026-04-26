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
- Uses **Vercel AI SDK** `streamText` / `useChat`
- Response streams token-by-token to the frontend
- Frontend renders markdown as it arrives

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
app/(app)/companion/page.tsx
components/companion/
  CompanionChat.tsx          # Chat UI with streaming message list
  CompanionAvatar.tsx        # Mascot avatar display
lib/ai/
  provider.ts                # OpenAI / Ollama switcher
  rag/retrieve.ts            # Chunk retrieval for companion context
```

---

## Environment Variables
```bash
AI_PROVIDER="openai"          # "openai" | "ollama"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1"
```

---

## Privacy Constraint
The companion retrieves chunks only from documents belonging to the authenticated user. No cross-user data leakage.
