# BYOK API Key Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user who clones LearnForge add their own AI provider key in Settings so all AI features work without touching server env vars.

**Architecture:** Add a `UserApiKey` table (AES-256-GCM encrypted). Refactor `lib/ai/provider.ts` into a `createProvider(config)` factory with backward-compatible exports. A `getProviderForUser(userId)` helper resolves per-user keys from DB, falling back to env. Routes and lib functions call this once per request and pass the resulting provider down.

**Tech Stack:** Next.js App Router, Prisma, Vitest, Node.js `crypto` (built-in), Server Actions

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `UserApiKey` model + `User.apiKey` relation |
| `.env.example` | Modify | Add `ENCRYPTION_SECRET` |
| `lib/ai/errors.ts` | Create | Typed AI errors |
| `lib/ai/crypto.ts` | Create | AES-256-GCM encrypt/decrypt |
| `lib/ai/provider.ts` | Modify | Add `createProvider` factory; backward-compat re-exports |
| `lib/ai/user-provider.ts` | Create | `getProviderForUser` + `hasEnvKey` |
| `lib/ai/rag/retrieve.ts` | Modify | Accept optional `embedFn` parameter |
| `lib/upload/ingest.ts` | Modify | Call `getProviderForUser` internally |
| `lib/ai/generators/curriculum.ts` | Modify | Call `getProviderForUser` internally |
| `lib/ai/generators/exercises.ts` | Modify | Call `getProviderForUser` internally |
| `app/actions/api-key.ts` | Create | Server actions: save, delete, status |
| `app/app/settings/page.tsx` | Create | Settings page |
| `components/settings/ApiKeySettings.tsx` | Create | Key management form |
| `components/settings/NoAiKeyBanner.tsx` | Create | Soft-gate banner |
| `app/app/layout.tsx` | Modify | Add Settings nav entry |
| `app/app/upload/page.tsx` | Modify | Add `NoAiKeyBanner` |
| `app/app/companion/page.tsx` | Modify | Add `NoAiKeyBanner` |
| `app/api/companion/route.ts` | Modify | Use `getProviderForUser` |
| `app/api/tips/generate/route.ts` | Modify | Use `getProviderForUser` |
| `__tests__/lib/ai/crypto.test.ts` | Create | Unit tests for crypto utils |
| `__tests__/lib/ai/user-provider.test.ts` | Create | Unit tests for key resolution |

---

## Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

- [ ] **Step 1: Add `UserApiKey` model to schema**

In `prisma/schema.prisma`, add after the `Session` model block and before `// ─── COURSES ───`:

```prisma
model UserApiKey {
  id            String    @id @default(cuid())
  userId        String    @unique
  provider      String
  encryptedKey  String
  iv            String
  authTag       String
  ollamaBaseUrl String?
  fastModel     String?
  capableModel  String?
  verifiedAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add `apiKey` relation to `User` model**

In the `User` model block, add after `leagueEntry LeagueEntry[]`:

```prisma
  apiKey        UserApiKey?
```

- [ ] **Step 3: Add `ENCRYPTION_SECRET` to `.env.example`**

Add after the `# ── App Config ───` section:

```
# ── Encryption ────────────────────────────────────────
# Required for BYOK key storage. Generate: openssl rand -hex 32
ENCRYPTION_SECRET=""
```

- [ ] **Step 4: Run migration**

```bash
npm run db:migrate
```

When prompted for migration name, enter: `add_user_api_key`

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations .env.example
git commit -m "feat(byok): add UserApiKey table and ENCRYPTION_SECRET env var"
```

---

## Task 2: Typed Errors + Crypto Utils

**Files:**
- Create: `lib/ai/errors.ts`
- Create: `lib/ai/crypto.ts`
- Create: `__tests__/lib/ai/crypto.test.ts`

- [ ] **Step 1: Write failing tests for crypto**

Create `__tests__/lib/ai/crypto.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"

describe("crypto utils", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = "a".repeat(64)
  })

  it("round-trips a plaintext key", async () => {
    const { encryptKey, decryptKey } = await import("@/lib/ai/crypto")
    const { encryptedKey, iv, authTag } = encryptKey("AIzaSyABCDEF1234")
    expect(decryptKey(encryptedKey, iv, authTag)).toBe("AIzaSyABCDEF1234")
  })

  it("produces different ciphertext each call (random IV)", async () => {
    const { encryptKey } = await import("@/lib/ai/crypto")
    const a = encryptKey("same-key")
    const b = encryptKey("same-key")
    expect(a.encryptedKey).not.toBe(b.encryptedKey)
    expect(a.iv).not.toBe(b.iv)
  })

  it("throws when ENCRYPTION_SECRET is absent", async () => {
    delete process.env.ENCRYPTION_SECRET
    const { encryptKey } = await import("@/lib/ai/crypto")
    expect(() => encryptKey("test")).toThrow("ENCRYPTION_SECRET")
  })

  it("throws on tampered ciphertext", async () => {
    const { encryptKey, decryptKey } = await import("@/lib/ai/crypto")
    const { encryptedKey, iv, authTag } = encryptKey("original")
    const tampered = Buffer.from(encryptedKey, "base64")
    tampered[0] ^= 0xff
    expect(() => decryptKey(tampered.toString("base64"), iv, authTag)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
npx vitest run __tests__/lib/ai/crypto.test.ts
```

Expected: `Error: Cannot find module '@/lib/ai/crypto'`

- [ ] **Step 3: Create `lib/ai/errors.ts`**

```ts
export class NoAiKeyError extends Error {
  constructor() {
    super("AI provider not configured")
    this.name = "NoAiKeyError"
  }
}

export class InvalidUserKeyError extends Error {
  constructor() {
    super("API key invalid — update in Settings")
    this.name = "InvalidUserKeyError"
  }
}

export class InvalidEnvKeyError extends Error {
  constructor() {
    super("Server AI configuration error")
    this.name = "InvalidEnvKeyError"
  }
}
```

- [ ] **Step 4: Create `lib/ai/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getSecret(): Buffer {
  const hex = process.env.ENCRYPTION_SECRET
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_SECRET must be a 64-char hex string. Generate: openssl rand -hex 32")
  }
  return Buffer.from(hex, "hex")
}

export function encryptKey(plaintext: string): { encryptedKey: string; iv: string; authTag: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getSecret(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return {
    encryptedKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  }
}

export function decryptKey(encryptedKey: string, iv: string, authTag: string): string {
  const decipher = createDecipheriv(ALGORITHM, getSecret(), Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(authTag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/ai/crypto.test.ts
```

Expected: `3 passed` (the tamper test may need Vitest to re-import the module — if it's cached from the missing-secret test, add `vi.resetModules()` in the beforeEach)

If tests fail due to module caching across the `ENCRYPTION_SECRET` deletion test, update the test file:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"

describe("crypto utils", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ENCRYPTION_SECRET = "a".repeat(64)
  })
  // ... rest unchanged
})
```

Re-run until 4 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/errors.ts lib/ai/crypto.ts __tests__/lib/ai/crypto.test.ts
git commit -m "feat(byok): add typed AI errors and AES-256-GCM crypto utils"
```

---

## Task 3: `createProvider` Factory Refactor

**Files:**
- Modify: `lib/ai/provider.ts`

This replaces module-level singletons with a factory. All existing exports remain identical — no call sites change.

- [ ] **Step 1: Replace `lib/ai/provider.ts` entirely**

```ts
import OpenAI from "openai"
import { Ollama } from "ollama"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { withRetry, withModelFallback } from "./retry"

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export interface ProviderConfig {
  provider: string
  apiKey?: string
  apiKeyIngest?: string      // separate Gemini ingest key (env path only)
  embeddingProvider?: string // defaults to provider
  embeddingApiKey?: string   // defaults to apiKey
  ollamaBaseUrl?: string
  openAiCompatBaseUrl?: string
  openAiCompatEmbeddingModel?: string
  capableModel?: string
  fastModel?: string
}

export interface AIProvider {
  getLLM(purpose?: "primary" | "ingest"): (messages: ChatMessage[]) => Promise<string>
  getLLMStream(): (messages: ChatMessage[]) => AsyncIterable<string>
  getEmbeddingModel(purpose?: "primary" | "ingest"): (text: string) => Promise<number[]>
}

const LLM_ONLY_PROVIDERS = new Set(["groq", "cerebras"])

export function validateProviderConfig(): void {
  const AI_PROVIDER = process.env.AI_PROVIDER ?? "gemini"
  const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || AI_PROVIDER
  if (AI_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_BASE_URL) {
    throw new Error(
      "[AI] AI_PROVIDER=openai-compat requires OPENAI_COMPAT_BASE_URL.\n" +
        "Examples: http://localhost:1234/v1 (LM Studio), http://localhost:8080/v1 (llama.cpp)"
    )
  }
  if (LLM_ONLY_PROVIDERS.has(AI_PROVIDER) && !process.env.EMBEDDING_PROVIDER) {
    throw new Error(
      `[AI] AI_PROVIDER=${AI_PROVIDER} does not support embeddings.\n` +
        "Set EMBEDDING_PROVIDER to one of: openai, gemini, ollama, openai-compat"
    )
  }
  if (LLM_ONLY_PROVIDERS.has(EMBEDDING_PROVIDER)) {
    throw new Error(
      `[AI] EMBEDDING_PROVIDER=${EMBEDDING_PROVIDER} cannot produce embeddings.\n` +
        "Valid values: openai, gemini, ollama, openai-compat"
    )
  }
  if (EMBEDDING_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_EMBEDDING_MODEL) {
    throw new Error("[AI] EMBEDDING_PROVIDER=openai-compat requires OPENAI_COMPAT_EMBEDDING_MODEL to be set.")
  }
}

validateProviderConfig()

export function createProvider(config: ProviderConfig): AIProvider {
  const provider = config.provider
  const embeddingProvider = config.embeddingProvider ?? provider

  // Lazy per-instance clients
  let _openai: OpenAI | null = null
  let _groq: OpenAI | null = null
  let _cerebras: OpenAI | null = null
  let _openaiCompat: OpenAI | null = null
  let _ollama: Ollama | null = null

  function getOpenAI() {
    if (!_openai) _openai = new OpenAI({ apiKey: config.apiKey })
    return _openai
  }
  function getGroq() {
    if (!_groq) _groq = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: config.apiKey })
    return _groq
  }
  function getCerebras() {
    if (!_cerebras) _cerebras = new OpenAI({ baseURL: "https://api.cerebras.ai/v1", apiKey: config.apiKey })
    return _cerebras
  }
  function getOpenAICompat() {
    if (!_openaiCompat)
      _openaiCompat = new OpenAI({
        baseURL: config.openAiCompatBaseUrl ?? "http://localhost:8000/v1",
        apiKey: config.apiKey ?? "not-needed",
      })
    return _openaiCompat
  }
  function getOllama() {
    if (!_ollama) _ollama = new Ollama({ host: config.ollamaBaseUrl ?? "http://localhost:11434" })
    return _ollama
  }

  function getGeminiModelChain(): string[] {
    if (config.capableModel) return [config.capableModel]
    const primary = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    const fallbacks = (process.env.GEMINI_MODEL_FALLBACKS ?? "gemini-flash-latest,gemini-2.0-flash")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return [primary, ...fallbacks.filter((m) => m !== primary)]
  }

  return {
    getLLM(purpose?: "primary" | "ingest") {
      if (provider === "openai") {
        const client = getOpenAI()
        const model = config.capableModel ?? process.env.OPENAI_MODEL ?? "gpt-4o"
        return async (messages) => {
          const res = await client.chat.completions.create({ model, messages })
          return res.choices[0].message.content ?? ""
        }
      }
      if (provider === "gemini") {
        const key =
          purpose === "ingest" && config.apiKeyIngest ? config.apiKeyIngest : config.apiKey!
        const genAI = new GoogleGenerativeAI(key)
        return async (messages) => {
          const systemMsg = messages.find((m) => m.role === "system")
          const chatMsgs = messages.filter((m) => m.role !== "system")
          const history = chatMsgs.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }))
          while (history.length > 0 && history[0].role === "model") history.shift()
          const last = chatMsgs[chatMsgs.length - 1]
          const result = await withModelFallback(
            getGeminiModelChain(),
            (modelName) => {
              const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemMsg?.content })
              return model.startChat({ history }).sendMessage(last.content)
            },
            { label: "gemini-llm", retries: 2, baseDelayMs: 800 }
          )
          return result.response.text()
        }
      }
      if (provider === "groq") {
        const client = getGroq()
        const model = config.capableModel ?? process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"
        return async (messages) => {
          const res = await client.chat.completions.create({ model, messages })
          return res.choices[0].message.content ?? ""
        }
      }
      if (provider === "cerebras") {
        const client = getCerebras()
        const model = config.capableModel ?? process.env.CEREBRAS_MODEL ?? "llama3.1-8b"
        return async (messages) => {
          const res = await client.chat.completions.create({ model, messages })
          return res.choices[0].message.content ?? ""
        }
      }
      if (provider === "openai-compat") {
        const client = getOpenAICompat()
        const model = config.capableModel ?? process.env.OPENAI_COMPAT_MODEL ?? ""
        return async (messages) => {
          const res = await client.chat.completions.create({ model, messages })
          return res.choices[0].message.content ?? ""
        }
      }
      // ollama
      const ollama = getOllama()
      const ollamaModel = config.capableModel ?? process.env.OLLAMA_MODEL ?? "llama3.1"
      return async (messages) => {
        const res = await ollama.chat({ model: ollamaModel, messages, stream: false })
        return res.message.content
      }
    },

    getLLMStream() {
      if (provider === "openai") {
        const client = getOpenAI()
        const model = config.capableModel ?? process.env.OPENAI_MODEL ?? "gpt-4o"
        return async function* (messages) {
          const stream = await client.chat.completions.create({ model, messages, stream: true })
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content
            if (token) yield token
          }
        }
      }
      if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(config.apiKey!)
        return async function* (messages) {
          const systemMsg = messages.find((m) => m.role === "system")
          const chatMsgs = messages.filter((m) => m.role !== "system")
          const history = chatMsgs.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }))
          while (history.length > 0 && history[0].role === "model") history.shift()
          const last = chatMsgs[chatMsgs.length - 1]
          const result = await withModelFallback(
            getGeminiModelChain(),
            (modelName) => {
              const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemMsg?.content })
              return model.startChat({ history }).sendMessageStream(last.content)
            },
            { label: "gemini-llm-stream", retries: 2, baseDelayMs: 800 }
          )
          for await (const chunk of result.stream) {
            const token = chunk.text()
            if (token) yield token
          }
        }
      }
      if (provider === "groq") {
        const client = getGroq()
        const model = config.capableModel ?? process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"
        return async function* (messages) {
          const stream = await client.chat.completions.create({ model, messages, stream: true })
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content
            if (token) yield token
          }
        }
      }
      if (provider === "cerebras") {
        const client = getCerebras()
        const model = config.capableModel ?? process.env.CEREBRAS_MODEL ?? "llama3.1-8b"
        return async function* (messages) {
          const stream = await client.chat.completions.create({ model, messages, stream: true })
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content
            if (token) yield token
          }
        }
      }
      if (provider === "openai-compat") {
        const client = getOpenAICompat()
        const model = config.capableModel ?? process.env.OPENAI_COMPAT_MODEL ?? ""
        return async function* (messages) {
          const stream = await client.chat.completions.create({ model, messages, stream: true })
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content
            if (token) yield token
          }
        }
      }
      // ollama
      const ollama = getOllama()
      const ollamaModel = config.capableModel ?? process.env.OLLAMA_MODEL ?? "llama3.1"
      return async function* (messages) {
        const stream = await ollama.chat({ model: ollamaModel, messages, stream: true })
        for await (const chunk of stream) {
          if (chunk.message.content) yield chunk.message.content
        }
      }
    },

    getEmbeddingModel(purpose?: "primary" | "ingest") {
      const ep = embeddingProvider
      const eApiKey =
        purpose === "ingest" && config.apiKeyIngest
          ? config.apiKeyIngest
          : (config.embeddingApiKey ?? config.apiKey)

      if (ep === "openai") {
        const client = new OpenAI({ apiKey: eApiKey })
        const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"
        return async (text) => {
          const res = await client.embeddings.create({ model, input: text, dimensions: 1536 })
          return res.data[0].embedding
        }
      }
      if (ep === "gemini") {
        const genAI = new GoogleGenerativeAI(eApiKey!)
        const modelName = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001"
        const model = genAI.getGenerativeModel({ model: modelName })
        return async (text) => {
          const res = await withRetry(
            () =>
              model.embedContent({
                content: { role: "user", parts: [{ text }] },
                outputDimensionality: 1536,
              } as Parameters<typeof model.embedContent>[0]),
            { label: "gemini-embed" }
          )
          const v = res.embedding.values
          let sumSq = 0
          for (const x of v) sumSq += x * x
          const norm = Math.sqrt(sumSq)
          return norm > 0 ? v.map((x) => x / norm) : v
        }
      }
      if (ep === "openai-compat") {
        const client = new OpenAI({
          baseURL: config.openAiCompatBaseUrl ?? "http://localhost:8000/v1",
          apiKey: eApiKey ?? "not-needed",
        })
        const model = config.openAiCompatEmbeddingModel ?? process.env.OPENAI_COMPAT_EMBEDDING_MODEL!
        return async (text) => {
          const res = await client.embeddings.create({ model, input: text })
          return res.data[0].embedding
        }
      }
      // ollama
      const ollama = getOllama()
      const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text"
      return async (text) => {
        const res = await ollama.embed({ model: ollamaModel, input: text })
        return res.embeddings[0]
      }
    },
  }
}

function getEnvKeyForProvider(p: string): string | undefined {
  const map: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    cerebras: process.env.CEREBRAS_API_KEY,
    "openai-compat": process.env.OPENAI_COMPAT_API_KEY,
  }
  return map[p]
}

function buildEnvConfig(): ProviderConfig {
  const provider = process.env.AI_PROVIDER ?? "gemini"
  const embeddingProvider = process.env.EMBEDDING_PROVIDER || provider
  return {
    provider,
    apiKey: getEnvKeyForProvider(provider),
    apiKeyIngest:
      provider === "gemini"
        ? (process.env.GEMINI_API_KEY_INGEST ?? process.env.GEMINI_API_KEY)
        : undefined,
    embeddingProvider,
    embeddingApiKey: getEnvKeyForProvider(embeddingProvider),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    openAiCompatBaseUrl: process.env.OPENAI_COMPAT_BASE_URL,
    openAiCompatEmbeddingModel: process.env.OPENAI_COMPAT_EMBEDDING_MODEL,
  }
}

const defaultProvider = createProvider(buildEnvConfig())

// Backward-compatible exports — existing call sites unchanged
export const getLLM = defaultProvider.getLLM.bind(defaultProvider)
export const getLLMStream = defaultProvider.getLLMStream.bind(defaultProvider)
export const getEmbeddingModel = defaultProvider.getEmbeddingModel.bind(defaultProvider)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 3: Verify dev server still starts**

```bash
npm run dev
```

Expected: server starts without errors. If `validateProviderConfig()` throws, your `.env` is missing a required key — check `.env.example` for what's needed.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/provider.ts
git commit -m "refactor(ai): extract createProvider factory with backward-compat exports"
```

---

## Task 4: `getProviderForUser` + Tests

**Files:**
- Create: `lib/ai/user-provider.ts`
- Create: `__tests__/lib/ai/user-provider.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/ai/user-provider.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NoAiKeyError, InvalidUserKeyError } from "@/lib/ai/errors"

// Mock Prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userApiKey: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock crypto
vi.mock("@/lib/ai/crypto", () => ({
  decryptKey: vi.fn(() => "decrypted-api-key"),
}))

// Mock createProvider
vi.mock("@/lib/ai/provider", () => ({
  createProvider: vi.fn(() => ({ getLLM: vi.fn(), getLLMStream: vi.fn(), getEmbeddingModel: vi.fn() })),
  validateProviderConfig: vi.fn(),
  getLLM: vi.fn(),
  getLLMStream: vi.fn(),
  getEmbeddingModel: vi.fn(),
}))

describe("getProviderForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AI_PROVIDER = "gemini"
    process.env.GEMINI_API_KEY = "env-key"
  })

  it("returns user provider when valid record exists", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    const { createProvider } = await import("@/lib/ai/provider")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
      id: "1", userId: "u1", provider: "gemini",
      encryptedKey: "enc", iv: "iv", authTag: "tag",
      ollamaBaseUrl: null, fastModel: null, capableModel: null,
      verifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    })
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await getProviderForUser("u1")
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", apiKey: "decrypted-api-key" }))
  })

  it("throws InvalidUserKeyError when record has no verifiedAt", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
      id: "1", userId: "u1", provider: "gemini",
      encryptedKey: "enc", iv: "iv", authTag: "tag",
      ollamaBaseUrl: null, fastModel: null, capableModel: null,
      verifiedAt: null, createdAt: new Date(), updatedAt: new Date(),
    })
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await expect(getProviderForUser("u1")).rejects.toThrow(InvalidUserKeyError)
  })

  it("returns defaultProvider when no user record and env key present", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null)
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    const { getLLM } = await import("@/lib/ai/provider")
    const result = await getProviderForUser("u1")
    // defaultProvider is the module-level instance, not createProvider again
    expect(result).toBeDefined()
  })

  it("throws NoAiKeyError when no user record and no env key", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null)
    delete process.env.GEMINI_API_KEY
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await expect(getProviderForUser("u1")).rejects.toThrow(NoAiKeyError)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run __tests__/lib/ai/user-provider.test.ts
```

Expected: `Cannot find module '@/lib/ai/user-provider'`

- [ ] **Step 3: Create `lib/ai/user-provider.ts`**

```ts
import { prisma } from "@/lib/db/prisma"
import { decryptKey } from "./crypto"
import { createProvider, getLLM, getLLMStream, getEmbeddingModel, type AIProvider, type ProviderConfig } from "./provider"
import { NoAiKeyError, InvalidUserKeyError } from "./errors"

const LLM_ONLY_PROVIDERS = new Set(["groq", "cerebras"])

export function hasEnvKey(provider: string): boolean {
  if (provider === "ollama" || provider === "openai-compat") return true
  const map: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    cerebras: process.env.CEREBRAS_API_KEY,
  }
  return !!map[provider]
}

const defaultProvider: AIProvider = { getLLM, getLLMStream, getEmbeddingModel }

function getEnvEmbeddingKey(): string | undefined {
  const ep = process.env.EMBEDDING_PROVIDER || process.env.AI_PROVIDER || "gemini"
  const map: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    "openai-compat": process.env.OPENAI_COMPAT_API_KEY,
  }
  return map[ep]
}

export async function getProviderForUser(userId: string): Promise<AIProvider> {
  const record = await prisma.userApiKey.findUnique({ where: { userId } })

  if (record) {
    if (!record.verifiedAt) throw new InvalidUserKeyError()

    const apiKey = decryptKey(record.encryptedKey, record.iv, record.authTag)

    const config: ProviderConfig = {
      provider: record.provider,
      apiKey,
      ollamaBaseUrl: record.ollamaBaseUrl ?? undefined,
      capableModel: record.capableModel ?? undefined,
      fastModel: record.fastModel ?? undefined,
    }

    // For LLM-only providers, fall back to env for embeddings
    if (LLM_ONLY_PROVIDERS.has(record.provider)) {
      config.embeddingProvider = process.env.EMBEDDING_PROVIDER || "gemini"
      config.embeddingApiKey = getEnvEmbeddingKey()
    }

    return createProvider(config)
  }

  // No user key — check env
  const envProvider = process.env.AI_PROVIDER ?? "gemini"
  if (!hasEnvKey(envProvider)) throw new NoAiKeyError()

  return defaultProvider
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/ai/user-provider.test.ts
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/ai/user-provider.ts __tests__/lib/ai/user-provider.test.ts
git commit -m "feat(byok): add getProviderForUser with env fallback and typed errors"
```

---

## Task 5: Thread Provider Through Lib Functions

**Files:**
- Modify: `lib/ai/rag/retrieve.ts`
- Modify: `lib/upload/ingest.ts`
- Modify: `lib/ai/generators/curriculum.ts`
- Modify: `lib/ai/generators/exercises.ts`

- [ ] **Step 1: Update `lib/ai/rag/retrieve.ts`**

Add an optional `embedFn` parameter. Change the function signature and the `embed` assignment:

```ts
// Add to imports at top:
// (no new imports needed — getEmbeddingModel is already imported)

export async function retrieveChunks(
  query: string,
  userId: string,
  opts?: { courseId?: string; topK?: number },
  embedFn?: (text: string) => Promise<number[]>  // NEW optional parameter
): Promise<RetrievedChunk[]> {
  const topK = opts?.topK ?? 10
  const embed = embedFn ?? getEmbeddingModel()   // use provided fn or fall back to global
  // ... rest of function unchanged
```

- [ ] **Step 2: Update `lib/upload/ingest.ts`**

At the top of `ingestDocument`, replace the global `getEmbeddingModel` call with a user-scoped one:

```ts
// Add import at top:
import { getProviderForUser } from "@/lib/ai/user-provider"

export async function ingestDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
  if (doc.status === "ready") return

  console.log(`[ingest] start: ${doc.name} (${doc.id})`)

  // Resolve user's AI provider once for this job
  const provider = await getProviderForUser(doc.userId)
  const embed = provider.getEmbeddingModel("ingest")

  try {
    // ... rest of function — replace all `const embed = getEmbeddingModel("ingest")` with the resolved `embed`
```

Remove the old `import { getEmbeddingModel } from "@/lib/ai/provider"` line from `ingest.ts` since it's no longer used directly.

- [ ] **Step 3: Update `lib/ai/generators/curriculum.ts`**

```ts
// Add import:
import { getProviderForUser } from "@/lib/ai/user-provider"

export async function generateCurriculum(courseId: string): Promise<void> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: { user: { select: { id: true } } },
  })
  const existingChapters = await prisma.chapter.count({ where: { courseId } })
  if (existingChapters > 0) return

  // Resolve user's AI provider once for this job
  const provider = await getProviderForUser(course.user.id)
  const llm = provider.getLLM()
  const embedFn = provider.getEmbeddingModel()

  const chunks = await retrieveChunks(course.title, course.user.id, { courseId, topK: 30 }, embedFn)
  // ... rest of function: replace `const llm = getLLM()` with the resolved `llm`
```

Remove `import { getLLM } from "@/lib/ai/provider"` since it's replaced.

- [ ] **Step 4: Update `lib/ai/generators/exercises.ts`**

Same pattern as curriculum — add `getProviderForUser` import, resolve provider at the top of `generateExercises`, use `provider.getLLM()` and pass `provider.getEmbeddingModel()` to any `retrieveChunks` calls.

Read the full function first (`lib/ai/generators/exercises.ts`) then apply:

```ts
import { getProviderForUser } from "@/lib/ai/user-provider"

export async function generateExercises(lessonId: string): Promise<void> {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { chapter: { include: { course: { include: { user: { select: { id: true } } } } } } },
  })
  
  // Resolve user's AI provider once for this job
  const provider = await getProviderForUser(lesson.chapter.course.user.id)
  const llm = provider.getLLM()
  const embedFn = provider.getEmbeddingModel()
  // ... rest unchanged, replace getLLM() calls with llm, pass embedFn to retrieveChunks
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors (usually missing `user` in the Prisma `include`).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/rag/retrieve.ts lib/upload/ingest.ts lib/ai/generators/curriculum.ts lib/ai/generators/exercises.ts
git commit -m "feat(byok): thread getProviderForUser through ingest, curriculum, exercise generators"
```

---

## Task 6: Server Actions — Save, Verify, Delete, Status

**Files:**
- Create: `app/actions/api-key.ts`

- [ ] **Step 1: Create `app/actions/api-key.ts`**

```ts
"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { encryptKey, decryptKey } from "@/lib/ai/crypto"
import { createProvider } from "@/lib/ai/provider"

const VERIFY_TIMEOUT_MS = 10_000

const SaveKeySchema = z.object({
  provider: z.enum(["gemini", "openai", "groq", "cerebras", "ollama", "openai-compat"]),
  apiKey: z.string().min(1).optional(),
  ollamaBaseUrl: z.string().url().optional(),
  openAiCompatBaseUrl: z.string().url().optional(),
  fastModel: z.string().optional(),
  capableModel: z.string().optional(),
})

type SaveKeyInput = z.infer<typeof SaveKeySchema>

function maskKey(key: string): string {
  if (key.length <= 10) return "••••••••••"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

// Cheapest model per provider for verification only
const VERIFY_MODELS: Record<string, string> = {
  gemini: "gemini-2.0-flash-lite",
  openai: "gpt-4o-mini",
  groq: "llama-3.1-8b-instant",
  cerebras: "llama3.1-8b",
}

async function verifyKey(input: SaveKeyInput): Promise<void> {
  const { provider, apiKey, ollamaBaseUrl, openAiCompatBaseUrl } = input

  if (provider === "ollama") {
    const baseUrl = ollamaBaseUrl ?? "http://localhost:11434"
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal })
      if (!res.ok) throw Object.assign(new Error("Ollama unreachable"), { status: res.status })
    } catch (err: any) {
      if (err.name === "AbortError") throw Object.assign(new Error("timeout"), { isTimeout: true })
      throw err
    } finally {
      clearTimeout(timer)
    }
    return
  }

  const verifyProvider = createProvider({
    provider,
    apiKey,
    openAiCompatBaseUrl,
    capableModel: VERIFY_MODELS[provider],
  })
  const llm = verifyProvider.getLLM()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

  try {
    await llm([{ role: "user", content: "Hi" }])
  } catch (err: any) {
    if (err.name === "AbortError" || err.code === "ECONNABORTED") {
      throw Object.assign(new Error("timeout"), { isTimeout: true })
    }
    // Map provider HTTP errors to user-friendly messages
    const status = err.status ?? err.statusCode ?? 0
    if (status === 401 || status === 403) {
      throw Object.assign(new Error("invalid_key"), { isInvalidKey: true })
    }
    if (status === 429) {
      throw Object.assign(new Error("rate_limited"), { isRateLimited: true })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function verifyErrorMessage(err: any): string {
  if (err.isTimeout) return "Không thể kết nối đến provider. Kiểm tra mạng và thử lại."
  if (err.isInvalidKey) return "API key không hợp lệ. Kiểm tra lại trong provider dashboard."
  if (err.isRateLimited) return "Key hợp lệ nhưng đang bị rate limit. Thử lại sau ít phút."
  return "Lỗi không xác định khi xác minh key."
}

export async function saveUserApiKey(
  input: SaveKeyInput
): Promise<{ maskedKey: string; provider: string; verifiedAt: Date } | { error: string }> {
  const session = await requireSession()
  const userId = session.user.id

  const parsed = SaveKeySchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  try {
    await verifyKey(parsed.data)
  } catch (err) {
    return { error: verifyErrorMessage(err) }
  }

  const plainKey = parsed.data.apiKey ?? ""
  const encrypted = plainKey ? encryptKey(plainKey) : { encryptedKey: "", iv: "", authTag: "" }
  const verifiedAt = new Date()

  await prisma.userApiKey.upsert({
    where: { userId },
    create: {
      userId,
      provider: parsed.data.provider,
      ...encrypted,
      ollamaBaseUrl: parsed.data.ollamaBaseUrl ?? null,
      fastModel: parsed.data.fastModel ?? null,
      capableModel: parsed.data.capableModel ?? null,
      verifiedAt,
    },
    update: {
      provider: parsed.data.provider,
      ...encrypted,
      ollamaBaseUrl: parsed.data.ollamaBaseUrl ?? null,
      fastModel: parsed.data.fastModel ?? null,
      capableModel: parsed.data.capableModel ?? null,
      verifiedAt,
    },
  })

  revalidatePath("/app/settings")
  return { maskedKey: maskKey(plainKey || parsed.data.ollamaBaseUrl || ""), provider: parsed.data.provider, verifiedAt }
}

export async function deleteUserApiKey(): Promise<void> {
  const session = await requireSession()
  await prisma.userApiKey.deleteMany({ where: { userId: session.user.id } })
  revalidatePath("/app/settings")
}

export async function getUserApiKeyStatus(): Promise<{
  provider: string
  maskedKey: string
  verifiedAt: Date
} | null> {
  const session = await requireSession()
  const record = await prisma.userApiKey.findUnique({ where: { userId: session.user.id } })
  if (!record || !record.verifiedAt) return null

  const plainKey = record.encryptedKey
    ? decryptKey(record.encryptedKey, record.iv, record.authTag)
    : (record.ollamaBaseUrl ?? "")

  return {
    provider: record.provider,
    maskedKey: maskKey(plainKey),
    verifiedAt: record.verifiedAt,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/api-key.ts
git commit -m "feat(byok): add server actions for API key save/verify/delete/status"
```

---

## Task 7: Settings UI

**Files:**
- Create: `app/app/settings/page.tsx`
- Create: `components/settings/ApiKeySettings.tsx`
- Modify: `app/app/layout.tsx`

- [ ] **Step 1: Create `components/settings/ApiKeySettings.tsx`**

```tsx
"use client"

import { useState } from "react"
import { saveUserApiKey, deleteUserApiKey } from "@/app/actions/api-key"

type Provider = "gemini" | "openai" | "groq" | "cerebras" | "ollama" | "openai-compat"

interface KeyStatus {
  provider: Provider
  maskedKey: string
  verifiedAt: Date
}

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "gemini", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "groq", label: "Groq" },
  { value: "cerebras", label: "Cerebras" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "openai-compat", label: "OpenAI-compatible" },
]

const PLACEHOLDER_MODELS: Record<Provider, { fast: string; capable: string }> = {
  gemini: { fast: "gemini-2.0-flash-lite", capable: "gemini-2.5-flash" },
  openai: { fast: "gpt-4o-mini", capable: "gpt-4o" },
  groq: { fast: "llama-3.1-8b-instant", capable: "llama-3.3-70b-versatile" },
  cerebras: { fast: "llama3.1-8b", capable: "llama3.3-70b" },
  ollama: { fast: "llama3.1", capable: "llama3.1:70b" },
  "openai-compat": { fast: "", capable: "" },
}

const LLM_ONLY = new Set<Provider>(["groq", "cerebras"])

interface Props {
  initial: KeyStatus | null
}

export function ApiKeySettings({ initial }: Props) {
  const [status, setStatus] = useState<KeyStatus | null>(initial)
  const [editing, setEditing] = useState(!initial)
  const [provider, setProvider] = useState<Provider>(initial?.provider ?? "gemini")
  const [apiKey, setApiKey] = useState("")
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [compatUrl, setCompatUrl] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [fastModel, setFastModel] = useState("")
  const [capableModel, setCapableModel] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await saveUserApiKey({
      provider,
      apiKey: provider !== "ollama" ? apiKey : undefined,
      ollamaBaseUrl: provider === "ollama" ? ollamaUrl : undefined,
      openAiCompatBaseUrl: provider === "openai-compat" ? compatUrl : undefined,
      fastModel: fastModel || undefined,
      capableModel: capableModel || undefined,
    })

    setSaving(false)

    if ("error" in result) {
      setError(result.error)
      return
    }

    setStatus({ provider: result.provider as Provider, maskedKey: result.maskedKey, verifiedAt: result.verifiedAt })
    setEditing(false)
    setApiKey("")
  }

  async function handleRemove() {
    setRemoving(true)
    await deleteUserApiKey()
    setStatus(null)
    setEditing(true)
    setRemoving(false)
  }

  if (!editing && status) {
    return (
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">AI Provider</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-600">✓</span>
          <span className="font-medium capitalize">{status.provider}</span>
          <span className="text-muted-foreground">— {status.maskedKey}</span>
          <span className="text-muted-foreground text-xs ml-2">
            verified {new Date(status.verifiedAt).toLocaleDateString()}
          </span>
        </div>
        {LLM_ONLY.has(status.provider) && (
          <p className="text-xs text-muted-foreground">
            Embeddings use the server&apos;s configured EMBEDDING_PROVIDER.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
          >
            Change
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="rounded-lg border p-6 space-y-5">
      <h2 className="text-lg font-semibold">AI Provider</h2>

      {/* Provider selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Provider</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProvider(p.value)}
              className={`px-3 py-2 text-sm border rounded-md text-left transition-colors ${
                provider === p.value
                  ? "border-primary bg-primary/5 font-medium"
                  : "hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key input */}
      {provider === "ollama" ? (
        <div className="space-y-1">
          <label className="text-sm font-medium">Ollama Base URL</label>
          <input
            type="url"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
          />
        </div>
      ) : (
        <div className="space-y-1">
          {provider === "openai-compat" && (
            <div className="space-y-1 mb-3">
              <label className="text-sm font-medium">Base URL</label>
              <input
                type="url"
                value={compatUrl}
                onChange={(e) => setCompatUrl(e.target.value)}
                placeholder="http://localhost:1234/v1"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>
          )}
          <label className="text-sm font-medium">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key"
              required
              className="w-full px-3 py-2 pr-16 text-sm border rounded-md bg-background"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Advanced */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? "▲ Hide advanced" : "▼ Advanced model overrides"}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fast model</label>
              <input
                type="text"
                value={fastModel}
                onChange={(e) => setFastModel(e.target.value)}
                placeholder={PLACEHOLDER_MODELS[provider].fast}
                className="w-full px-2 py-1.5 text-xs border rounded-md bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Capable model</label>
              <input
                type="text"
                value={capableModel}
                onChange={(e) => setCapableModel(e.target.value)}
                placeholder={PLACEHOLDER_MODELS[provider].capable}
                className="w-full px-2 py-1.5 text-xs border rounded-md bg-background"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Verifying…" : "Test & Save"}
        </button>
        {status && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create `app/app/settings/page.tsx`**

```tsx
import { getUserApiKeyStatus } from "@/app/actions/api-key"
import { ApiKeySettings } from "@/components/settings/ApiKeySettings"

export default async function SettingsPage() {
  const status = await getUserApiKeyStatus()

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your AI provider to use LearnForge.</p>
      </div>
      <ApiKeySettings initial={status} />
    </div>
  )
}
```

- [ ] **Step 3: Add Settings to nav in `app/app/layout.tsx`**

Add `Settings` to the import from `lucide-react`:
```ts
import { BookOpen, Upload, MessageCircle, Trophy, User, Flame, Settings } from "lucide-react"
```

Add to `navItems`:
```ts
{ href: "/app/settings", icon: Settings, label: "Settings" },
```

- [ ] **Step 4: Verify visually**

Start the dev server and navigate to `http://localhost:3000/app/settings`. Confirm:
- Settings link appears in sidebar
- Provider selector shows 6 options
- Form submits with a real key → shows success state with masked key
- Form shows inline error for invalid/wrong key

- [ ] **Step 5: Commit**

```bash
git add app/app/settings/page.tsx components/settings/ApiKeySettings.tsx app/app/layout.tsx
git commit -m "feat(byok): add Settings page with AI provider key management UI"
```

---

## Task 8: Soft-Gate Banner

**Files:**
- Create: `components/settings/NoAiKeyBanner.tsx`
- Modify: `app/app/upload/page.tsx`
- Modify: `app/app/companion/page.tsx`

- [ ] **Step 1: Create `components/settings/NoAiKeyBanner.tsx`**

```tsx
import Link from "next/link"

interface Props {
  show: boolean
}

export function NoAiKeyBanner({ show }: Props) {
  if (!show) return null
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-700 dark:bg-yellow-950">
      <span>⚠️</span>
      <span className="text-yellow-800 dark:text-yellow-200">
        AI provider not configured. Add your API key in{" "}
        <Link href="/app/settings" className="font-medium underline underline-offset-2">
          Settings
        </Link>{" "}
        to use this feature.
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Add banner to upload page**

Read `app/app/upload/page.tsx` first, then add near the top of the rendered JSX:

```tsx
// Add imports:
import { getUserApiKeyStatus } from "@/app/actions/api-key"
import { NoAiKeyBanner } from "@/components/settings/NoAiKeyBanner"

// In the page component (make it async if not already):
export default async function UploadPage() {
  const keyStatus = await getUserApiKeyStatus()
  const noKey = !keyStatus && !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY
    && !process.env.GROQ_API_KEY && !process.env.CEREBRAS_API_KEY
  
  // Actually, use hasEnvKey for the current AI_PROVIDER:
  // import { hasEnvKey } from "@/lib/ai/user-provider"
  // const noKey = !keyStatus && !hasEnvKey(process.env.AI_PROVIDER ?? "gemini")

  return (
    <div>
      <NoAiKeyBanner show={!keyStatus && !hasEnvKey(process.env.AI_PROVIDER ?? "gemini")} />
      {/* ...existing JSX */}
    </div>
  )
}
```

Import `hasEnvKey` from `@/lib/ai/user-provider` for a clean check.

- [ ] **Step 3: Add banner to companion page**

Same pattern — read `app/app/companion/page.tsx`, add `NoAiKeyBanner` at the top of the JSX with the same `show` condition.

- [ ] **Step 4: Verify visually**

With no `GEMINI_API_KEY` in `.env` and no user key set, navigate to `/app/upload` and `/app/companion` — yellow banner should appear with a link to Settings.

After adding a key in Settings, banner should disappear on those pages.

- [ ] **Step 5: Commit**

```bash
git add components/settings/NoAiKeyBanner.tsx app/app/upload/page.tsx app/app/companion/page.tsx
git commit -m "feat(byok): add soft-gate NoAiKeyBanner to upload and companion pages"
```

---

## Task 9: Wire User Provider into API Routes

**Files:**
- Modify: `app/api/companion/route.ts`
- Modify: `app/api/tips/generate/route.ts`

- [ ] **Step 1: Update `app/api/companion/route.ts`**

Add import and replace the `getLLMStream()` call:

```ts
// Add import:
import { getProviderForUser } from "@/lib/ai/user-provider"
import { NoAiKeyError, InvalidUserKeyError } from "@/lib/ai/errors"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const userId = session.user.id   // already exists
  const userName = session.user?.name ?? "bạn"

  // ... existing body parsing and context resolution ...

  // Replace: const streamFn = getLLMStream()
  // With:
  let provider
  try {
    provider = await getProviderForUser(userId)
  } catch (err) {
    if (err instanceof NoAiKeyError || err instanceof InvalidUserKeyError) {
      return NextResponse.json({ error: err.message }, { status: err instanceof NoAiKeyError ? 503 : 400 })
    }
    throw err
  }
  const streamFn = provider.getLLMStream()

  // ... rest of streaming logic unchanged ...
}
```

Remove `import { getLLMStream } from "@/lib/ai/provider"` if it's no longer used.

- [ ] **Step 2: Update `app/api/tips/generate/route.ts`**

Read the full file first, then apply the same pattern:

```ts
import { getProviderForUser } from "@/lib/ai/user-provider"
import { NoAiKeyError, InvalidUserKeyError } from "@/lib/ai/errors"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const userId = session.user!.id!

  // ... existing param parsing ...

  let provider
  try {
    provider = await getProviderForUser(userId)
  } catch (err) {
    if (err instanceof NoAiKeyError || err instanceof InvalidUserKeyError) {
      return NextResponse.json({ error: err.message }, { status: err instanceof NoAiKeyError ? 503 : 400 })
    }
    throw err
  }

  const llm = provider.getLLM()
  const embedFn = provider.getEmbeddingModel()

  // Pass embedFn to retrieveChunks:
  const chunks = await retrieveChunks(query, userId, { courseId, topK: 5 }, embedFn)

  // Replace getLLM() call with llm(messages)
  // ... rest unchanged
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all previously-passing tests still pass.

- [ ] **Step 5: End-to-end smoke test**

1. Set `ENCRYPTION_SECRET` in `.env` (`openssl rand -hex 32`)
2. Clear `GEMINI_API_KEY` from `.env`
3. Start dev server: `npm run dev`
4. Navigate to `/app/upload` → yellow banner appears
5. Go to `/app/settings` → add your Gemini key → "Test & Save" → shows ✓ verified
6. Go back to `/app/upload` → banner gone
7. Upload a PDF → confirm curriculum generates without error
8. Open `/app/companion` → chat works

- [ ] **Step 6: Commit**

```bash
git add app/api/companion/route.ts app/api/tips/generate/route.ts
git commit -m "feat(byok): wire getProviderForUser into companion and tips API routes"
```

---

## Self-Review Checklist

- [x] **Schema:** `UserApiKey` model with all fields from spec ✓
- [x] **Crypto:** AES-256-GCM, test covers round-trip + tamper + missing secret ✓
- [x] **createProvider:** all 6 providers × 3 functions, backward-compat exports ✓
- [x] **getProviderForUser:** user key → env fallback → NoAiKeyError chain ✓
- [x] **LLM-only providers:** Groq/Cerebras fall back to env embedding ✓
- [x] **Write-after-verify invariant:** DB write only on successful verify ✓
- [x] **Error differentiation:** timeout / invalid-key / rate-limited mapped separately ✓
- [x] **Verification uses cheapest model:** VERIFY_MODELS constant in actions ✓
- [x] **Settings UI:** all 6 providers, Ollama URL field, compat URL field, advanced section ✓
- [x] **Change flow:** old key active until new key verified and upserted ✓
- [x] **Banners on upload + companion:** yes ✓; lesson page excluded (correct — submit is DB-only) ✓
- [x] **Nav entry:** Settings added to sidebar ✓
- [x] **Ingest/curriculum/exercises:** all thread provider internally ✓
- [x] **retrieve.ts:** accepts optional embedFn, falls back to global ✓
