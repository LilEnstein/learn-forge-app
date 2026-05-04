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
