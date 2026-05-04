# BYOK API Key Management — Design Spec
**Date:** 2026-05-04  
**Feature:** F09 — Bring Your Own Key (Multi-provider BYOK)  
**Status:** Design approved, pending implementation plan

---

## Goal

Any person who clones LearnForge and installs dependencies can add their own AI provider key through the Settings UI and use all AI features immediately — without modifying server config. The existing env-var flow stays as a fallback for self-hosters who prefer it.

---

## Scope

**In scope:**
- `UserApiKey` table (encrypted, per-user, single active provider)
- Settings UI: provider selector + key input + verify + model overrides
- `createProvider` factory refactor (backward-compatible)
- `getProviderForUser(userId)` helper with env fallback
- AES-256-GCM encryption for stored keys
- Key verification per provider (lightweight test call)
- Soft-gate banners on `/app/upload` and `/app/companion`

**Out of scope:**
- Role system (admin/super_admin)
- Admin-managed key pool / quota tracking
- Usage stats / key sharing
- Onboarding flow changes

---

## Data Model

```prisma
model UserApiKey {
  id            String    @id @default(cuid())
  userId        String    @unique
  provider      String    // "gemini"|"openai"|"groq"|"cerebras"|"ollama"|"openai-compat"
  encryptedKey  String    // AES-256-GCM ciphertext (base64)
  iv            String    // 12-byte GCM initialization vector (base64)
  authTag       String    // 16-byte GCM auth tag (base64)
  ollamaBaseUrl String?   // only when provider = "ollama"
  fastModel     String?   // optional override (e.g. "gemini-2.0-flash")
  capableModel  String?   // optional override (e.g. "gemini-2.5-flash")
  verifiedAt    DateTime? // null = saved but not yet verified (error recovery only)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Invariant:** Records are only written after successful key verification. `verifiedAt` is always set on write. `verifiedAt = null` is only possible if a write fails mid-flight — treated as "unverified" in key resolution.

**New env var:**
```
ENCRYPTION_SECRET=""   # openssl rand -hex 32 — server-side only, never exposed to client
```

---

## Architecture

### Key Resolution Flow

```
getProviderForUser(userId)
  1. db.userApiKey.findUnique({ where: { userId } })
  2. Record found + verifiedAt set  → decrypt → createProvider(record)
  3. Record found + verifiedAt null → throw InvalidUserKeyError (400)
  4. No record                      → check env key presence explicitly
       env key is set for AI_PROVIDER → return defaultProvider
       env key is empty/absent       → throw NoAiKeyError (503)
```

Note: `validateProviderConfig()` at startup only validates structural config (base URLs, embedding compat) — it does NOT check that API keys are non-empty. The runtime presence check in step 4 is required separately.

Helper: `hasEnvKey(provider: string): boolean` checks the relevant env var per provider (`GEMINI_API_KEY` for gemini, `OPENAI_API_KEY` for openai, etc.). Ollama and openai-compat always return `true` (no key required).

### Error Types

| Error | HTTP | User-facing message |
|---|---|---|
| `NoAiKeyError` | 503 | "AI provider not configured" |
| `InvalidUserKeyError` | 400 | "API key invalid — update in Settings" |
| `InvalidEnvKeyError` | 503 | "Server AI configuration error" |

### Provider Factory Refactor

`lib/ai/provider.ts` gains a `createProvider(config)` factory. Existing module-level exports remain as backward-compatible re-exports from `defaultProvider` (env-based):

```ts
export function createProvider(config: {
  provider: string
  apiKey?: string
  ollamaBaseUrl?: string
  fastModel?: string
  capableModel?: string
}): { getLLM, getLLMStream, getEmbeddingModel }

// Backward-compat — existing call sites unchanged
export const getLLM          = defaultProvider.getLLM
export const getLLMStream    = defaultProvider.getLLMStream
export const getEmbeddingModel = defaultProvider.getEmbeddingModel
```

Per-request instances are created fresh — no module-level singletons needed. Call sites that need user-scoped AI call `getProviderForUser(userId)` once per request, cache the result in a local variable, and use it for the duration of that request.

---

## Encryption

**`lib/ai/crypto.ts`** — Node.js `crypto` module only, no extra dependency.

- Algorithm: AES-256-GCM
- Key: 32-byte `ENCRYPTION_SECRET` from env (never stored in DB)
- IV: 12-byte random per encryption
- Auth tag: 16-byte GCM tag (tamper detection)
- Storage: all values base64-encoded in DB

---

## Key Verification

All verification calls use the **cheapest available model** — verification only confirms the key is valid, not performance.

| Provider | Verification call | Cheap model |
|---|---|---|
| `gemini` | `generateContent("Hi")` with `maxOutputTokens: 1` | `gemini-2.0-flash-lite` |
| `openai` | `chat.completions.create({ max_tokens: 1 })` | `gpt-4o-mini` |
| `groq` | same as openai | `llama-3.1-8b-instant` |
| `cerebras` | same as openai | `llama3.1-8b` |
| `openai-compat` | same as openai against provided base URL | uses `OPENAI_COMPAT_MODEL` env var or user's `fastModel` override; if neither set, sends no `model` field (server picks default) |
| `ollama` | `GET {baseUrl}/api/tags` | — |

**Timeout:** 10 seconds on all verification calls.

**Error mapping from provider response:**

| HTTP status from provider | Error returned to client |
|---|---|
| 401 / 403 | "API key không hợp lệ. Kiểm tra lại trong provider dashboard." |
| 429 | "Key hợp lệ nhưng đang bị rate limit. Thử lại sau ít phút." |
| Timeout | "Không thể kết nối đến provider. Kiểm tra mạng và thử lại." |
| Other | "Lỗi không xác định khi xác minh key." |

---

## Server Actions

**`app/actions/api-key.ts`** (Server Actions — not API routes)

```ts
saveUserApiKey(input: SaveKeyInput): Promise<{ maskedKey: string, verifiedAt: Date } | { error: string }>
deleteUserApiKey(): Promise<void>
getUserApiKeyStatus(): Promise<{ provider, maskedKey, verifiedAt } | null>
```

Input schema (Zod):
```ts
z.object({
  provider: z.enum(["gemini","openai","groq","cerebras","ollama","openai-compat"]),
  apiKey: z.string().min(1).optional(),         // not required for ollama
  ollamaBaseUrl: z.string().url().optional(),   // required when provider = "ollama"
  fastModel: z.string().optional(),
  capableModel: z.string().optional(),
})
```

**Write-after-verify:** `saveUserApiKey` only writes to DB after the test call succeeds. The old key remains active until the new key is verified and the upsert completes — no keyless window.

**Masked key display:** first 6 chars + "..." + last 4 chars of the plaintext key.

---

## Settings UI

**Route:** `/app/settings`  
**Nav entry:** added to sidebar `navItems` in `app/app/layout.tsx`

### Component: `ApiKeySettings`

**States:**
1. **No key:** form with provider selector + key input + save button
2. **Key configured:** status row (`✅ gemini — AIzaS...x7kQ, verified 2 days ago`) + "Change" and "Remove" buttons
3. **Change mode:** form renders inline; old key stays active until new key is verified and saved
4. **Saving:** spinner on button, inputs disabled
5. **Error:** inline message below input, specific per error type (see error mapping above)

**Provider selector:** 6 radio-style options. Selecting a provider shows relevant fields:
- Gemini / OpenAI / Groq / Cerebras → API key field (masked, show/hide toggle)
- Ollama → Base URL field only (no key required)
- openai-compat → Base URL + optional API key

**Advanced section** (collapsed by default): fast model + capable model text inputs with per-provider placeholder defaults.

---

## First-Run Gating

**Soft gate — banner, no redirect.**

`NoAiKeyBanner` server component checks `getUserApiKeyStatus()` + env config server-side. Renders a yellow banner if neither is configured:

> "AI provider not configured. Add your API key in Settings to use this feature. [→ Settings]"

**Pages with banner:**
- `/app/upload` — course creation requires AI (ingest + curriculum + exercises)
- `/app/companion` — entire page is AI-driven

**Pages without banner:**
- `/app/learn/[courseId]/lesson/[lessonId]` — lesson submit is pure DB; tips (`/api/tips/generate`) degrade inline if no key is configured

---

## New Files

| File | Purpose |
|---|---|
| `lib/ai/crypto.ts` | AES-256-GCM encrypt/decrypt |
| `lib/ai/errors.ts` | Typed AI errors (NoAiKey, InvalidUserKey, InvalidEnvKey) |
| `lib/ai/user-provider.ts` | `getProviderForUser(userId)` — key resolution + fallback |
| `app/actions/api-key.ts` | Server actions: save, delete, get status |
| `app/app/settings/page.tsx` | Settings page |
| `components/settings/ApiKeySettings.tsx` | Key management form component |
| `components/settings/NoAiKeyBanner.tsx` | Soft-gate banner for AI-dependent pages |

## Modified Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `UserApiKey` model |
| `.env.example` | Add `ENCRYPTION_SECRET` |
| `lib/ai/provider.ts` | Add `createProvider` factory; re-export backward-compat functions |
| `app/app/layout.tsx` | Add "Settings" to sidebar nav |
| `app/app/upload/page.tsx` | Add `NoAiKeyBanner` |
| `app/app/companion/page.tsx` | Add `NoAiKeyBanner` |
| `app/api/companion/route.ts` | Call `getProviderForUser(userId)` once; pass `provider.getLLMStream` to chat logic |
| `app/api/tips/generate/route.ts` | Call `getProviderForUser(userId)` once; pass `provider.getLLM` and `provider.getEmbeddingModel` |
| `app/api/generate/curriculum/route.ts` | Call `getProviderForUser(userId)` once; pass provider down to generator |
| `lib/upload/ingest.ts` | Accept `provider` parameter; use `provider.getLLM` / `provider.getEmbeddingModel` instead of global imports |
| `lib/ai/generators/curriculum.ts` | Accept `provider` parameter instead of calling global `getLLM` |
| `lib/ai/generators/exercises.ts` | Accept `provider` parameter instead of calling global `getLLM` |
| `lib/ai/rag/retrieve.ts` | Accept `provider` parameter instead of calling global `getEmbeddingModel` |

**Threading pattern:** Routes call `getProviderForUser(userId)` once at the top, then pass the provider instance (or individual functions from it) into lib functions as parameters. Lib functions keep backward-compatible optional parameters — if `provider` is omitted they fall back to the global default exports (no change needed for callers that don't need user-scoped AI).
