# Plan — Feature 07: AI Companion

## Prerequisites
- Feature 02 (RAG) complete — `retrieveChunks` available
- `lib/ai/provider.ts` with `getLLM()` available
- Vercel AI SDK installed
- Feature 01 (Auth) — companion scoped to authenticated user

---

## Implementation Steps

### Step 1 — Companion API route
- [ ] Create `app/api/companion/route.ts` (POST)
  - Auth check
  - Parse body: `{ messages, courseId?, lessonId? }`
  - Fetch lesson context if `lessonId` provided
  - Embed last user message → `retrieveChunks(query, userId, { courseId, topK: 5 })`
  - Build system prompt from template with `{ username, courseTitle, lessonTitle, chunks }`
  - Call `streamText({ model: getLLM(), system, messages })` via Vercel AI SDK
  - Return streaming response: `result.toDataStreamResponse()`

### Step 2 — System prompt template
- [ ] Create `lib/ai/prompts/companion.prompt.ts`
  - `buildCompanionPrompt(ctx: { username, courseTitle, lessonTitle?, chunks }): string`
  - Vietnamese language instruction, concise, example-driven style
  - Chunk context formatted as numbered references

### Step 3 — Companion chat UI
- [ ] `components/companion/CompanionChat.tsx`
  - Use Vercel AI SDK `useChat({ api: "/api/companion" })` hook
  - Passes `body: { courseId, lessonId }` as extra metadata
  - Renders message list: user bubbles (right) + assistant bubbles (left)
  - Markdown rendering for assistant messages (`react-markdown`)
  - Auto-scroll to latest message
  - Input field + send button at bottom
- [ ] `components/companion/CompanionAvatar.tsx`
  - Mascot image/icon displayed above chat
  - Animates (bounce/wave) when streaming starts

### Step 4 — Companion entry point
- [ ] Floating action button in `app/(app)/layout.tsx`
  - Fixed position bottom-right
  - Toggles companion panel open/closed
  - Shows unread notification dot for proactive messages
- [ ] `app/(app)/companion/page.tsx`
  - Full-page companion view (for mobile or dedicated use)

### Step 5 — Proactive notifications
- [ ] Create `app/api/companion/notifications/route.ts` (GET, SSE or polling)
  - Check conditions for current user:
    - Streak at risk: `lastActivityAt` is today but < 2h before midnight
    - Repeated mistakes: aggregate wrong answers in last 3 sessions, find topic with >50% error rate
  - Return `{ notifications: Notification[] }`
- [ ] Frontend: poll every 5 minutes from layout, surface as toast or badge

---

## Acceptance Criteria
- [ ] Sending a message returns a streaming response grounded in user's documents
- [ ] Companion is aware of current lesson when `lessonId` is passed
- [ ] Responses are in Vietnamese
- [ ] Floating button toggles companion panel without page navigation
- [ ] Streak warning notification appears when streak is at risk
- [ ] No chunks from other users' documents appear in responses

---

## Dependencies to Install
```bash
npm install ai react-markdown
```
