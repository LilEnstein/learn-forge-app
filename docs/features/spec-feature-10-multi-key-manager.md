# spec-feature-10-multi-key-manager.md
# Feature 10 — Multi-Key Manager & Per-Task Model Configuration

**Status:** Draft  
**Priority:** High  
**Depends on:** Feature 09 (BYOK — `UserApiKey` table, `lib/ai/crypto.ts`, `createProvider` factory)  
**Blocks:** nothing (additive feature)

---

## 1. Problem Statement

Feature 09 gives each user one API key. When that key hits its daily quota (Gemini free tier: ~1,500 req/day), the user is completely blocked. The only path forward is to wait ~24h or contact admin.

This feature removes that blocker by allowing:
- Multiple keys per user (from different accounts or providers)
- Automatic failover when a key hits quota
- Per-task model selection (fast model for chat, powerful model for processing)
- Real-time model discovery from the API key itself
- Inline key selector on the upload page so users never lose context

---

## 2. Goals

| Goal | Success Criteria |
|---|---|
| Multi-key storage | User can add N keys, name them, set one as default |
| Live model discovery | Available models fetched from provider API at key verification time |
| Per-task model config | User can assign a different model per task type |
| Upload page UX | Active key name + model shown inline; one-click switch |
| Auto-failover | 429 response → mark key as quota_exceeded → retry with next active key |
| Quota awareness | UI shows estimated reset time for exhausted keys |

---

## 3. Non-Goals (out of scope)

- Admin key pool (Feature 11 / Phase 3 of roadmap)
- Payment / subscription management
- Cross-provider failover (e.g. Gemini → OpenAI auto-switch) — same-provider only for MVP
- Model benchmarking or recommendation engine

---

## 4. Database Schema Changes

### 4.1 Modify `UserApiKey`

**Breaking change from Feature 09:** remove `@unique` on `userId`. One migration needed.

```prisma
model UserApiKey {
  id               String    @id @default(cuid())
  userId           String                          // ← no longer @unique
  name             String                          // "Key cá nhân", "Key công ty"
  provider         String                          // "gemini"|"openai"|"groq"|...
  encryptedKey     String
  iv               String
  authTag          String
  ollamaBaseUrl    String?
  isDefault        Boolean   @default(false)
  status           String    @default("active")    // "active"|"quota_exceeded"|"invalid"
  quotaExceededAt  DateTime?
  quotaResetHint   DateTime?                       // quotaExceededAt + 24h estimate
  lastUsedAt       DateTime?
  availableModels  Json?                           // ModelInfo[] — cached from provider API
  modelsFetchedAt  DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isDefault])
}
```

**Invariant:** exactly one `isDefault = true` per `userId` per `provider`. Enforced in service layer, not DB (Postgres partial unique index optional).

### 4.2 New table: `UserModelConfig`

One row per user. Stores which model to use per task. Falls back to provider defaults if null.

```prisma
model UserModelConfig {
  id             String  @id @default(cuid())
  userId         String  @unique
  fileProcessing String?   // model name for PDF parse + chunking
  courseGen      String?   // model name for curriculum + exercise generation
  companion      String?   // model name for AI companion chat
  embedding      String?   // model name for RAG embeddings
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user           User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 4.3 Model info type (TypeScript, not DB)

```ts
// lib/ai/types.ts
export type ModelCapability = "generateContent" | "embedContent" | "countTokens"
export type ModelTag = "fast" | "powerful" | "embedding" | "preview"

export type ModelInfo = {
  name: string          // "models/gemini-2.5-flash"
  displayName: string   // "Gemini 2.5 Flash"
  capabilities: ModelCapability[]
  tags: ModelTag[]
  outputTokenLimit: number
}
```

---

## 5. Task Types & Model Compatibility Rules

| Task | Env var default | Requires | Recommended tag |
|---|---|---|---|
| `fileProcessing` | `GEMINI_MODEL` | `generateContent` | `powerful` |
| `courseGen` | `GEMINI_MODEL` | `generateContent` | `powerful` |
| `companion` | `GEMINI_MODEL_LITE` | `generateContent` | `fast` |
| `embedding` | `GEMINI_EMBEDDING_MODEL` | `embedContent` | `embedding` |

Dropdown for each task only shows models whose `capabilities` include the required method. Embedding task additionally filters `name.includes("embedding")`.

---

## 6. Service Layer

### 6.1 `lib/ai/keys.ts` — multi-key CRUD

```ts
// All functions take userId, operate on UserApiKey table

getActiveKeys(userId): Promise<UserApiKey[]>
  // returns all keys for user, ordered by: isDefault DESC, lastUsedAt DESC

getDefaultKey(userId): Promise<UserApiKey | null>
  // returns the key where isDefault = true; null if none

setDefaultKey(userId, keyId): Promise<void>
  // sets keyId.isDefault = true, all others for same userId = false (transaction)

addKey(userId, input: AddKeyInput): Promise<UserApiKey>
  // verify → fetch models → encrypt → insert
  // if first key for user: set isDefault = true automatically

removeKey(userId, keyId): Promise<void>
  // delete; if was default → promote next key to default (oldest lastUsedAt)

markQuotaExceeded(keyId): Promise<void>
  // status = "quota_exceeded", quotaExceededAt = now(), quotaResetHint = now() + 24h

markActive(keyId): Promise<void>
  // status = "active", clear quotaExceededAt, quotaResetHint

getNextActiveKey(userId, excludeKeyId: string): Promise<UserApiKey | null>
  // returns first key where status = "active" AND id != excludeKeyId
  // ordered by isDefault DESC, lastUsedAt DESC
```

### 6.2 `lib/ai/model-discovery.ts` — fetch models from provider

```ts
fetchAvailableModels(provider: string, apiKey: string): Promise<ModelInfo[]>
```

**Implementation per provider:**

**Gemini:**
```
GET https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}
→ parse response.models[]
→ filter: supportedGenerationMethods includes "generateContent" OR "embedContent"
→ exclude: preview/experimental models tagged as deprecated
→ classify tags:
    name.includes("flash-lite") || name.includes("2.0-flash") → "fast"
    name.includes("2.5") && !name.includes("lite")           → "powerful"  
    supportedGenerationMethods.includes("embedContent")       → "embedding"
    name.includes("preview")                                  → "preview"
```

**OpenAI / Groq / Cerebras / openai-compat:**
```
GET {baseUrl}/v1/models  (Authorization: Bearer {apiKey})
→ filter known LLM models (exclude fine-tune, embedding, moderation)
→ static tag classification based on model name patterns
```

**Ollama:**
```
GET {ollamaBaseUrl}/api/tags
→ parse models array
→ all classified as "generateContent" capable, tag = "fast" by default
```

Cache result in `UserApiKey.availableModels` + `modelsFetchedAt`.  
Refresh if `modelsFetchedAt` is older than 7 days (lazy refresh on Settings open).

### 6.3 `lib/ai/user-provider.ts` — updated resolution

```ts
getProviderForUser(userId, task: TaskType): Promise<ProviderInstance>
```

Resolution order:
```
1. Load UserModelConfig for userId → get model name for task
2. Load default UserApiKey for userId (status = "active")
3. Found → decrypt → createProvider({ provider, apiKey, model: configuredModel })
4. Not found (all quota exceeded) → throw NoActiveKeyError (new error type)
5. No keys at all → fall back to env defaultProvider
6. Env also unconfigured → throw NoAiKeyError
```

### 6.4 Auto-failover wrapper

```ts
// lib/ai/with-failover.ts
withFailover(userId, task, fn: (provider) => Promise<T>): Promise<T>
```

```
1. Get provider for user (step above)
2. Call fn(provider)
3. If 429 thrown:
   a. markQuotaExceeded(currentKeyId)
   b. nextKey = getNextActiveKey(userId, excludeKeyId: currentKeyId)
   c. nextKey exists → retry fn with new provider (once, no infinite loop)
   d. no next key → throw QuotaExhaustedError with { resetHint }
4. If 401 thrown → markInvalid(keyId) → throw InvalidUserKeyError
```

`withFailover` is the wrapper used in all AI-dependent route handlers. Companion, upload ingest, curriculum gen — all go through this.

---

## 7. Server Actions

File: `app/actions/api-key.ts` — extends existing file from Feature 09.

```ts
// New actions (additions, no breaking changes to existing)

addUserApiKey(input: AddKeyInput): Promise<ActionResult<UserApiKey>>
  // input: { name, provider, apiKey?, ollamaBaseUrl?, isDefault? }
  // verify → fetchAvailableModels → encrypt → insert
  // returns: { id, name, provider, maskedKey, status, availableModels }

removeUserApiKey(keyId: string): Promise<ActionResult<void>>
  // auth guard: verify key belongs to current user
  // promote next key to default if needed

setDefaultKey(keyId: string): Promise<ActionResult<void>>

getUserApiKeys(): Promise<UserApiKey[]>
  // returns all keys for current user (no decrypted values)
  // includes: id, name, provider, maskedKey, status, isDefault, quotaResetHint, lastUsedAt

refreshKeyModels(keyId: string): Promise<ModelInfo[]>
  // re-fetch available models from provider API, update DB cache

saveModelConfig(config: Partial<UserModelConfig>): Promise<void>
  // upsert UserModelConfig for current user

getModelConfig(): Promise<UserModelConfig | null>
```

### Zod input schema

```ts
const AddKeySchema = z.object({
  name: z.string().min(1).max(50),
  provider: z.enum(["gemini","openai","groq","cerebras","ollama","openai-compat"]),
  apiKey: z.string().min(1).optional(),
  ollamaBaseUrl: z.string().url().optional(),
  isDefault: z.boolean().optional(),
}).refine(
  (d) => d.provider === "ollama" ? !!d.ollamaBaseUrl : !!d.apiKey,
  { message: "API key required for non-Ollama providers" }
)
```

---

## 8. API Routes

### `GET /api/user/key-status` (lightweight, for upload page header)

Returns minimal info needed to render the key status bar:

```ts
{
  activeKey: {
    id: string
    name: string
    provider: string
    status: "active" | "quota_exceeded"
    quotaResetHint?: string  // ISO datetime
  } | null
  models: {
    fileProcessing: string
    companion: string
  }
  hasEnvFallback: boolean
}
```

Called on upload page mount. Cached for 60s (stale-while-revalidate).

---

## 9. Error Types (additions to `lib/ai/errors.ts`)

| Error | HTTP | Message | When |
|---|---|---|---|
| `NoActiveKeyError` | 402 | "All API keys have hit their quota" | All keys quota_exceeded |
| `QuotaExhaustedError` | 429 | "API quota exceeded — try again in Xh" | Single key 429, no fallback |
| `KeyNotFoundError` | 404 | "API key not found" | keyId doesn't belong to user |

---

## 10. UI Components

### 10.1 Settings Page — updated layout

```
/app/settings

My API Keys                                    [+ Add Key]
┌──────────────────────────────────────────────────────────┐
│ ★ Key cá nhân    Gemini   ✅ Active   used 2m ago        │
│                  AIzaSy...pMs                             │
│                  [Set default] [Config] [Refresh] [Remove]│
├──────────────────────────────────────────────────────────┤
│   Key backup     Gemini   ⚠️ Quota exceeded              │
│                  Reset ~6h remaining                      │
│                  [Set default] [Config] [Refresh] [Remove]│
├──────────────────────────────────────────────────────────┤
│   Work Key       OpenAI   ✅ Active   never used         │
│                  sk-proj...kQ                             │
│                  [Set default] [Config] [Refresh] [Remove]│
└──────────────────────────────────────────────────────────┘

Model Configuration (using: Key cá nhân — Gemini)
┌──────────────────────────────────────────────────────────┐
│ 📄 File Processing    [gemini-2.5-flash          ▼]      │
│ 🧠 Course Generation  [gemini-2.5-flash          ▼]      │
│ 💬 AI Companion       [gemini-2.0-flash-lite     ▼]      │
│ 🔍 Embeddings         [gemini-embedding-2        ▼]      │
│                                      [Save Configuration] │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Add Key Modal / Inline Form

Triggered by "+ Add Key" button. Steps:
1. Enter name + select provider → relevant inputs appear (API key or base URL)
2. Click "Verify & Discover Models" → spinner → success shows model count
3. Optional: set as default key
4. Save

On error: inline message per error type (invalid key / timeout / rate limited).

### 10.3 Config Modal (per key)

Opens when user clicks "Config" on a key. Shows model selector for each task, pre-filtered to that key's `availableModels`. Saves to `UserModelConfig`.

### 10.4 Upload Page — Key Status Bar

New component: `components/upload/KeyStatusBar.tsx`

```
┌──────────────────────────────────────────────────────────┐
│ 🔑 Key cá nhân (Gemini)  •  gemini-2.5-flash   [Switch ▼]│
└──────────────────────────────────────────────────────────┘
```

"Switch" dropdown:
```
● Key cá nhân   Gemini  ✅
○ Work Key       OpenAI  ✅
○ Key backup     Gemini  ⚠️ ~6h
─────────────────────────────
+ Add new key
```

Selecting a key from dropdown: calls `setDefaultKey` server action + revalidates the status bar. Instant, no page reload.

**Quota exceeded state:**
```
┌──────────────────────────────────────────────────────────┐
│ ⚠️ Key cá nhân hit quota  •  Reset in ~5h 42m  [Switch ▼]│
└──────────────────────────────────────────────────────────┘
```

### 10.5 Components file list

```
components/settings/
  ApiKeyList.tsx           ← list of key cards
  ApiKeyCard.tsx           ← single key card (status, actions)
  AddKeyForm.tsx           ← add key form + model discovery step
  ModelConfigForm.tsx      ← per-task model dropdowns
  KeyConfigModal.tsx       ← wraps ModelConfigForm in dialog

components/upload/
  KeyStatusBar.tsx         ← upload page header bar
  KeySwitchDropdown.tsx    ← dropdown inside status bar
```

---

## 11. Key Routing & Failover — Sequence Diagram

```
User uploads PDF
    ↓
ingestDocument(docId)
    ↓
withFailover(userId, "fileProcessing", async (provider) => {
    parsePdf(filePath, provider)
    embedChunks(chunks, provider)
})
    ↓
provider.parsePdf → 429 from Gemini
    ↓
withFailover catches → markQuotaExceeded(keyId)
    ↓
getNextActiveKey(userId, excludeKeyId)
    ↓
Key found: "Work Key" (OpenAI) → retry parsePdf
    ↓
Toast notification: "Switched to Work Key (OpenAI) — Key cá nhân hit quota"
    ↓
Success ✅
```

---

## 12. Migration Plan

```sql
-- Migration: feature-10-multi-key
-- 1. Drop unique constraint on UserApiKey.userId (if exists)
ALTER TABLE "UserApiKey" DROP CONSTRAINT IF EXISTS "UserApiKey_userId_key";

-- 2. Add new columns
ALTER TABLE "UserApiKey"
  ADD COLUMN "name"             TEXT NOT NULL DEFAULT 'My API Key',
  ADD COLUMN "isDefault"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status"           TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "quotaExceededAt"  TIMESTAMP,
  ADD COLUMN "quotaResetHint"   TIMESTAMP,
  ADD COLUMN "lastUsedAt"       TIMESTAMP,
  ADD COLUMN "availableModels"  JSONB,
  ADD COLUMN "modelsFetchedAt"  TIMESTAMP;

-- 3. Set existing rows as default (one-time backfill)
UPDATE "UserApiKey" SET "isDefault" = true, "name" = 'My API Key';

-- 4. Create UserModelConfig table
CREATE TABLE "UserModelConfig" (
  "id"             TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL UNIQUE,
  "fileProcessing" TEXT,
  "courseGen"      TEXT,
  "companion"      TEXT,
  "embedding"      TEXT,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 5. Add index
CREATE INDEX "UserApiKey_userId_idx" ON "UserApiKey"("userId");
CREATE INDEX "UserApiKey_userId_isDefault_idx" ON "UserApiKey"("userId", "isDefault");
```

---

## 13. New Files Summary

| File | Role |
|---|---|
| `lib/ai/keys.ts` | Multi-key CRUD service |
| `lib/ai/model-discovery.ts` | Fetch + classify models from provider API |
| `lib/ai/with-failover.ts` | Auto-failover wrapper for all AI calls |
| `lib/ai/types.ts` | `ModelInfo`, `ModelCapability`, `TaskType` types |
| `app/actions/api-key.ts` | Extended server actions (addKey, removeKey, setDefault, model config) |
| `app/api/user/key-status/route.ts` | Lightweight status for upload page |
| `components/settings/ApiKeyList.tsx` | Key list in settings |
| `components/settings/ApiKeyCard.tsx` | Single key card |
| `components/settings/AddKeyForm.tsx` | Add key form + model discovery |
| `components/settings/ModelConfigForm.tsx` | Per-task model dropdowns |
| `components/settings/KeyConfigModal.tsx` | Modal wrapper for config form |
| `components/upload/KeyStatusBar.tsx` | Upload page key display |
| `components/upload/KeySwitchDropdown.tsx` | Dropdown to switch key |

### Modified Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | `UserApiKey` schema update + `UserModelConfig` new table |
| `lib/ai/user-provider.ts` | Support `task` param, route to configured model |
| `lib/ai/errors.ts` | Add `NoActiveKeyError`, `QuotaExhaustedError`, `KeyNotFoundError` |
| `app/actions/api-key.ts` | Add new actions (backward-compatible) |
| `app/app/settings/page.tsx` | Render `ApiKeyList` + `ModelConfigForm` |
| `app/app/upload/page.tsx` | Add `KeyStatusBar` above upload form |
| All AI route handlers | Wrap calls with `withFailover` |

---

## 14. Acceptance Criteria

```
✅ User can add multiple keys (same or different providers)
✅ User can name each key and set one as default
✅ On key verification, available models are fetched and cached
✅ Model dropdowns in Settings only show compatible models per task type
✅ Upload page shows active key name and configured model
✅ Clicking "Switch" on upload page changes active key without page reload
✅ When a key returns 429: status → quota_exceeded, failover to next active key
✅ When all keys are quota_exceeded: error shown with reset countdown
✅ Auto-failover emits a toast notification (not a blocking error)
✅ Env-key fallback still works for users with no keys configured
✅ Removing the default key promotes the next key automatically
✅ Migration runs cleanly on existing DB with Feature 09 data
```

---

## 15. Implementation Order

```
Step 1  Migration — schema changes + backfill
Step 2  lib/ai/types.ts — shared types
Step 3  lib/ai/keys.ts — CRUD service
Step 4  lib/ai/model-discovery.ts — provider API fetch
Step 5  lib/ai/with-failover.ts — failover wrapper
Step 6  lib/ai/user-provider.ts — update resolution logic
Step 7  lib/ai/errors.ts — new error types
Step 8  app/actions/api-key.ts — new server actions
Step 9  app/api/user/key-status/route.ts
Step 10 Settings UI components (ApiKeyList, ApiKeyCard, AddKeyForm)
Step 11 ModelConfigForm + KeyConfigModal
Step 12 Upload page KeyStatusBar + KeySwitchDropdown
Step 13 Wrap all AI route handlers with withFailover
Step 14 End-to-end test: quota exceeded → failover → toast
```
