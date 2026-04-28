# Multi-LLM Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `lib/ai/provider.ts` to support Groq, Cerebras, and all OpenAI-compatible local servers (vLLM, llama.cpp, LM Studio, Jan.ai) with no changes to any caller.

**Architecture:** All new providers (Groq, Cerebras, openai-compat) use the already-installed `openai` SDK with a custom `baseURL` — no new packages needed. A separate `EMBEDDING_PROVIDER` env var handles the case where the LLM provider (Groq, Cerebras) cannot produce embeddings. Startup validation throws a descriptive error on misconfiguration.

**Tech Stack:** TypeScript, `openai` npm package (already installed), `ollama` npm package (already installed), `@google/generative-ai` (already installed).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/ai/provider.ts` | Modify | Add groq/cerebras/openai-compat clients, EMBEDDING_PROVIDER split, validation |
| `.env.example` | Modify | Document new env vars for all providers |

---

## Task 1: Add `EMBEDDING_PROVIDER` constant and startup validation

**Files:**
- Modify: `lib/ai/provider.ts`

- [ ] **Step 1: Add `EMBEDDING_PROVIDER` and `validateProviderConfig` after the existing `AI_PROVIDER` constant**

Open `lib/ai/provider.ts`. After line 5 (`const AI_PROVIDER = ...`), insert:

```ts
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || AI_PROVIDER;

const LLM_ONLY_PROVIDERS = new Set(["groq", "cerebras"]);

export function validateProviderConfig(): void {
  if (AI_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_BASE_URL) {
    throw new Error(
      "[AI] AI_PROVIDER=openai-compat requires OPENAI_COMPAT_BASE_URL.\n" +
        "Examples: http://localhost:1234/v1 (LM Studio), http://localhost:8080/v1 (llama.cpp), " +
        "http://localhost:1337/v1 (Jan.ai), http://localhost:8000/v1 (vLLM)"
    );
  }
  if (LLM_ONLY_PROVIDERS.has(AI_PROVIDER) && !process.env.EMBEDDING_PROVIDER) {
    throw new Error(
      `[AI] AI_PROVIDER=${AI_PROVIDER} does not support embeddings.\n` +
        "Set EMBEDDING_PROVIDER to one of: openai, gemini, ollama, openai-compat"
    );
  }
  if (LLM_ONLY_PROVIDERS.has(EMBEDDING_PROVIDER)) {
    throw new Error(
      `[AI] EMBEDDING_PROVIDER=${EMBEDDING_PROVIDER} cannot produce embeddings.\n` +
        "Valid values: openai, gemini, ollama, openai-compat"
    );
  }
  if (EMBEDDING_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_EMBEDDING_MODEL) {
    throw new Error(
      "[AI] EMBEDDING_PROVIDER=openai-compat requires OPENAI_COMPAT_EMBEDDING_MODEL to be set."
    );
  }
}

validateProviderConfig();
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/provider.ts
git commit -m "feat(ai): add EMBEDDING_PROVIDER + startup validation"
```

---

## Task 2: Add Groq and Cerebras LLM clients

**Files:**
- Modify: `lib/ai/provider.ts`

- [ ] **Step 1: Add lazy-initialized clients for Groq and Cerebras**

After the existing `let _gemini` declaration (around line 12), add:

```ts
let _groq: OpenAI | null = null;
let _cerebras: OpenAI | null = null;
```

After the existing `getGemini()` function, add:

```ts
function getGroq() {
  if (!_groq)
    _groq = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
  return _groq;
}

function getCerebras() {
  if (!_cerebras)
    _cerebras = new OpenAI({
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: process.env.CEREBRAS_API_KEY,
    });
  return _cerebras;
}
```

- [ ] **Step 2: Add groq and cerebras branches to `getLLM()`**

Inside `getLLM()`, before the final `// Ollama` fallback block, add:

```ts
  if (AI_PROVIDER === "groq") {
    const groq = getGroq();
    const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
    return async (messages) => {
      const res = await groq.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  if (AI_PROVIDER === "cerebras") {
    const cerebras = getCerebras();
    const model = process.env.CEREBRAS_MODEL ?? "llama3.1-8b";
    return async (messages) => {
      const res = await cerebras.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/provider.ts
git commit -m "feat(ai): add Groq and Cerebras LLM providers"
```

---

## Task 3: Add `openai-compat` provider (LLM + optional embeddings)

**Files:**
- Modify: `lib/ai/provider.ts`

- [ ] **Step 1: Add lazy-initialized client for openai-compat**

After the `let _cerebras` declaration, add:

```ts
let _openaiCompat: OpenAI | null = null;
```

After `getCerebras()`, add:

```ts
function getOpenAICompat() {
  if (!_openaiCompat)
    _openaiCompat = new OpenAI({
      baseURL: process.env.OPENAI_COMPAT_BASE_URL ?? "http://localhost:8000/v1",
      apiKey: process.env.OPENAI_COMPAT_API_KEY ?? "not-needed",
    });
  return _openaiCompat;
}
```

- [ ] **Step 2: Add `openai-compat` branch to `getLLM()`**

Inside `getLLM()`, before the final `// Ollama` fallback, add:

```ts
  if (AI_PROVIDER === "openai-compat") {
    const compat = getOpenAICompat();
    const model = process.env.OPENAI_COMPAT_MODEL ?? "";
    return async (messages) => {
      const res = await compat.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/provider.ts
git commit -m "feat(ai): add openai-compat provider (vLLM, llama.cpp, LM Studio, Jan.ai)"
```

---

## Task 4: Switch `getEmbeddingModel()` to use `EMBEDDING_PROVIDER`

**Files:**
- Modify: `lib/ai/provider.ts`

This task makes the embedding function respect `EMBEDDING_PROVIDER` instead of hardcoding `AI_PROVIDER`. The current function checks `AI_PROVIDER` in each branch — replace those checks with a local `provider` constant.

- [ ] **Step 1: Replace the full `getEmbeddingModel()` function**

Replace the entire existing `getEmbeddingModel()` function with:

```ts
export function getEmbeddingModel(): (text: string) => Promise<number[]> {
  const provider = EMBEDDING_PROVIDER;

  if (provider === "openai") {
    const openai = getOpenAI();
    const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    return async (text) => {
      const res = await openai.embeddings.create({ model, input: text, dimensions: 768 });
      return res.data[0].embedding;
    };
  }

  if (provider === "gemini") {
    const genAI = getGemini();
    // text-embedding-004 outputs 768 dimensions — matches our pgvector schema
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    return async (text) => {
      const res = await model.embedContent(text);
      return res.embedding.values;
    };
  }

  if (provider === "openai-compat") {
    const compat = getOpenAICompat();
    const model = process.env.OPENAI_COMPAT_EMBEDDING_MODEL!;
    return async (text) => {
      const res = await compat.embeddings.create({ model, input: text });
      return res.data[0].embedding;
    };
  }

  // ollama (default)
  const ollama = getOllama();
  const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  return async (text) => {
    const res = await ollama.embed({ model: ollamaModel, input: text });
    return res.embeddings[0];
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/provider.ts
git commit -m "feat(ai): route embeddings through EMBEDDING_PROVIDER"
```

---

## Task 5: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace the `# ── AI Provider` section**

Find the current AI Provider section in `.env.example` and replace it entirely with:

```bash
# ── AI Provider ───────────────────────────────────
# LLM provider: openai | gemini | ollama | groq | cerebras | openai-compat
AI_PROVIDER="gemini"

# Embedding provider — defaults to AI_PROVIDER when capable.
# REQUIRED when AI_PROVIDER=groq or cerebras (they have no embedding support).
# Valid values: openai | gemini | ollama | openai-compat
# EMBEDDING_PROVIDER="ollama"

# ── OpenAI ────────────────────────────────────────
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"

# ── Google AI Studio (Gemini) ─────────────────────
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.0-flash"

# ── Ollama (local) ────────────────────────────────
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"

# ── Groq (free cloud, LLM only) ───────────────────
# Pair with EMBEDDING_PROVIDER=ollama or EMBEDDING_PROVIDER=gemini
GROQ_API_KEY=""
GROQ_MODEL="llama-3.3-70b-versatile"

# ── Cerebras (free cloud, LLM only) ───────────────
# Pair with EMBEDDING_PROVIDER=ollama or EMBEDDING_PROVIDER=gemini
CEREBRAS_API_KEY=""
CEREBRAS_MODEL="llama3.1-8b"

# ── OpenAI-compatible (vLLM / llama.cpp / LM Studio / Jan.ai) ──
# Default ports: LM Studio=1234, Jan.ai=1337, llama.cpp=8080, vLLM=8000
# OPENAI_COMPAT_BASE_URL="http://localhost:1234/v1"
# OPENAI_COMPAT_API_KEY="not-needed"
# OPENAI_COMPAT_MODEL="mistral"
# OPENAI_COMPAT_EMBEDDING_MODEL=""   # leave blank to use EMBEDDING_PROVIDER instead
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): document Groq, Cerebras, and openai-compat provider config"
```

---

## Task 6: Smoke test

- [ ] **Step 1: Verify type-check is clean across the full project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Verify dev server starts with current `.env.local`**

```bash
npm run dev
```

Expected: server starts on port 3000 with no startup errors. If `validateProviderConfig()` throws, the error message will name exactly which env var is missing — fix `.env.local` accordingly.

- [ ] **Step 3: Verify the final state of `lib/ai/provider.ts`**

The complete file should look like this (verify line-by-line against what was implemented):

```ts
import OpenAI from "openai";
import { Ollama } from "ollama";
import { GoogleGenerativeAI } from "@google/generative-ai";

const AI_PROVIDER = process.env.AI_PROVIDER ?? "gemini";
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || AI_PROVIDER;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const LLM_ONLY_PROVIDERS = new Set(["groq", "cerebras"]);

export function validateProviderConfig(): void {
  if (AI_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_BASE_URL) {
    throw new Error(
      "[AI] AI_PROVIDER=openai-compat requires OPENAI_COMPAT_BASE_URL.\n" +
        "Examples: http://localhost:1234/v1 (LM Studio), http://localhost:8080/v1 (llama.cpp), " +
        "http://localhost:1337/v1 (Jan.ai), http://localhost:8000/v1 (vLLM)"
    );
  }
  if (LLM_ONLY_PROVIDERS.has(AI_PROVIDER) && !process.env.EMBEDDING_PROVIDER) {
    throw new Error(
      `[AI] AI_PROVIDER=${AI_PROVIDER} does not support embeddings.\n` +
        "Set EMBEDDING_PROVIDER to one of: openai, gemini, ollama, openai-compat"
    );
  }
  if (LLM_ONLY_PROVIDERS.has(EMBEDDING_PROVIDER)) {
    throw new Error(
      `[AI] EMBEDDING_PROVIDER=${EMBEDDING_PROVIDER} cannot produce embeddings.\n` +
        "Valid values: openai, gemini, ollama, openai-compat"
    );
  }
  if (EMBEDDING_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_EMBEDDING_MODEL) {
    throw new Error(
      "[AI] EMBEDDING_PROVIDER=openai-compat requires OPENAI_COMPAT_EMBEDDING_MODEL to be set."
    );
  }
}

validateProviderConfig();

let _openai: OpenAI | null = null;
let _groq: OpenAI | null = null;
let _cerebras: OpenAI | null = null;
let _openaiCompat: OpenAI | null = null;
let _ollama: Ollama | null = null;
let _gemini: GoogleGenerativeAI | null = null;

function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function getGroq() {
  if (!_groq)
    _groq = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
  return _groq;
}

function getCerebras() {
  if (!_cerebras)
    _cerebras = new OpenAI({
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: process.env.CEREBRAS_API_KEY,
    });
  return _cerebras;
}

function getOpenAICompat() {
  if (!_openaiCompat)
    _openaiCompat = new OpenAI({
      baseURL: process.env.OPENAI_COMPAT_BASE_URL ?? "http://localhost:8000/v1",
      apiKey: process.env.OPENAI_COMPAT_API_KEY ?? "not-needed",
    });
  return _openaiCompat;
}

function getOllama() {
  if (!_ollama) _ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434" });
  return _ollama;
}

function getGemini() {
  if (!_gemini) _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return _gemini;
}

export function getEmbeddingModel(): (text: string) => Promise<number[]> {
  const provider = EMBEDDING_PROVIDER;

  if (provider === "openai") {
    const openai = getOpenAI();
    const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    return async (text) => {
      const res = await openai.embeddings.create({ model, input: text, dimensions: 768 });
      return res.data[0].embedding;
    };
  }

  if (provider === "gemini") {
    const genAI = getGemini();
    // text-embedding-004 outputs 768 dimensions — matches our pgvector schema
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    return async (text) => {
      const res = await model.embedContent(text);
      return res.embedding.values;
    };
  }

  if (provider === "openai-compat") {
    const compat = getOpenAICompat();
    const model = process.env.OPENAI_COMPAT_EMBEDDING_MODEL!;
    return async (text) => {
      const res = await compat.embeddings.create({ model, input: text });
      return res.data[0].embedding;
    };
  }

  // ollama (default)
  const ollama = getOllama();
  const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  return async (text) => {
    const res = await ollama.embed({ model: ollamaModel, input: text });
    return res.embeddings[0];
  };
}

export function getLLM(): (messages: ChatMessage[]) => Promise<string> {
  if (AI_PROVIDER === "openai") {
    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    return async (messages) => {
      const res = await openai.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  if (AI_PROVIDER === "gemini") {
    const genAI = getGemini();
    const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    return async (messages) => {
      const systemMsg = messages.find((m) => m.role === "system");
      const chatMsgs = messages.filter((m) => m.role !== "system");

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemMsg?.content,
      });

      const history = chatMsgs.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const last = chatMsgs[chatMsgs.length - 1];
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(last.content);
      return result.response.text();
    };
  }

  if (AI_PROVIDER === "groq") {
    const groq = getGroq();
    const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
    return async (messages) => {
      const res = await groq.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  if (AI_PROVIDER === "cerebras") {
    const cerebras = getCerebras();
    const model = process.env.CEREBRAS_MODEL ?? "llama3.1-8b";
    return async (messages) => {
      const res = await cerebras.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  if (AI_PROVIDER === "openai-compat") {
    const compat = getOpenAICompat();
    const model = process.env.OPENAI_COMPAT_MODEL ?? "";
    return async (messages) => {
      const res = await compat.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  // ollama (default)
  const ollama = getOllama();
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.1";
  return async (messages) => {
    const res = await ollama.chat({ model: ollamaModel, messages, stream: false });
    return res.message.content;
  };
}
```

- [ ] **Step 4: Commit design doc and plan**

```bash
git add docs/superpowers/
git commit -m "docs: add multi-llm provider design doc and implementation plan"
```
