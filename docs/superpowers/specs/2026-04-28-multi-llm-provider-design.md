# Multi-LLM Provider Design

**Date:** 2026-04-28  
**Status:** Approved

## Summary

Extend `lib/ai/provider.ts` to support Groq, Cerebras, and all OpenAI-compatible local servers (vLLM, llama.cpp, LM Studio, Jan.ai) while keeping the same `getLLM()` and `getEmbeddingModel()` public API. No callers change. No new packages needed — the already-installed `openai` SDK handles all providers via `baseURL`.

---

## Provider Matrix

| `AI_PROVIDER` value | Covers | LLM | Embeddings |
|---|---|---|---|
| `openai` | OpenAI cloud | ✓ | ✓ |
| `gemini` | Google AI Studio | ✓ | ✓ |
| `ollama` | Ollama local | ✓ | ✓ |
| `groq` | Groq cloud (free) | ✓ | ✗ |
| `cerebras` | Cerebras cloud (free) | ✓ | ✗ |
| `openai-compat` | vLLM, llama.cpp, LM Studio, Jan.ai | ✓ | optional |

Default local server ports: LM Studio `1234`, Jan.ai `1337`, llama.cpp `8080`, vLLM `8000`.

---

## Architecture

### What changes
- `lib/ai/provider.ts` — only file with logic changes (~100 → ~180 lines)
- `.env.example` — new provider sections added

### What stays the same
- `getLLM(): (messages: ChatMessage[]) => Promise<string>` — unchanged signature
- `getEmbeddingModel(): (text: string) => Promise<number[]>` — unchanged signature
- All callers (`ingest.ts`, `curriculum.ts`, etc.) — untouched

### Implementation pattern
Groq, Cerebras, and `openai-compat` all use the existing `openai` SDK with a custom `baseURL`. Same `chat.completions.create()` call, different base URL and API key.

```ts
// Groq
new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: GROQ_API_KEY })

// Cerebras
new OpenAI({ baseURL: "https://api.cerebras.ai/v1", apiKey: CEREBRAS_API_KEY })

// openai-compat (vLLM / llama.cpp / LM Studio / Jan.ai)
new OpenAI({ baseURL: OPENAI_COMPAT_BASE_URL, apiKey: OPENAI_COMPAT_API_KEY ?? "not-needed" })
```

---

## Embedding Provider Split

`EMBEDDING_PROVIDER` — new optional env var, defaults to `AI_PROVIDER`.

Required when `AI_PROVIDER` is `groq` or `cerebras` (neither supports embeddings). Valid values: `openai | gemini | ollama | openai-compat`.

The `vector(768)` pgvector dimension is fixed — all embedding providers must produce 768-dimensional vectors:
- OpenAI `text-embedding-3-small` with `dimensions: 768` ✓
- Gemini `text-embedding-004` — native 768d ✓
- Ollama `nomic-embed-text` — 768d ✓
- `openai-compat` — valid only when `OPENAI_COMPAT_EMBEDDING_MODEL` is set and the model outputs 768d

---

## Startup Validation

`validateProviderConfig()` runs once on first use. Throws a descriptive `Error` for:

1. `AI_PROVIDER=groq` or `cerebras` with no `EMBEDDING_PROVIDER` set
2. `EMBEDDING_PROVIDER=groq` or `cerebras` (neither does embeddings)
3. `AI_PROVIDER=openai-compat` with no `OPENAI_COMPAT_BASE_URL`
4. `EMBEDDING_PROVIDER=openai-compat` with no `OPENAI_COMPAT_EMBEDDING_MODEL`

---

## New Environment Variables

```bash
# AI_PROVIDER: openai | gemini | ollama | groq | cerebras | openai-compat
AI_PROVIDER="gemini"

# Required when AI_PROVIDER=groq or cerebras (they have no embedding support)
# EMBEDDING_PROVIDER="ollama"  # openai | gemini | ollama | openai-compat

# ── Groq (free cloud, LLM only) ───────────────────
GROQ_API_KEY=""
GROQ_MODEL="llama-3.3-70b-versatile"

# ── Cerebras (free cloud, LLM only) ───────────────
CEREBRAS_API_KEY=""
CEREBRAS_MODEL="llama3.1-8b"

# ── OpenAI-compatible (vLLM / llama.cpp / LM Studio / Jan.ai) ──
OPENAI_COMPAT_BASE_URL="http://localhost:8000/v1"
OPENAI_COMPAT_API_KEY="not-needed"
OPENAI_COMPAT_MODEL="mistral"
OPENAI_COMPAT_EMBEDDING_MODEL=""   # blank = use EMBEDDING_PROVIDER instead
```

---

## Files Modified

| File | Change |
|---|---|
| `lib/ai/provider.ts` | Add groq/cerebras/openai-compat providers + EMBEDDING_PROVIDER split + validation |
| `.env.example` | Add Groq, Cerebras, openai-compat sections; update AI_PROVIDER comment |

No other files are modified.
