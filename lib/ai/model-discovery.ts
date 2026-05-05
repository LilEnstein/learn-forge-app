import type { ModelInfo, ModelCapability, ModelTag, AiProviderName } from "./types"

const FETCH_TIMEOUT_MS = 10_000

export interface FetchModelsInput {
  provider: AiProviderName
  apiKey?: string
  ollamaBaseUrl?: string
  openAiCompatBaseUrl?: string
}

export async function fetchAvailableModels(input: FetchModelsInput): Promise<ModelInfo[]> {
  switch (input.provider) {
    case "gemini":
      return fetchGeminiModels(input.apiKey ?? "")
    case "openai":
      return fetchOpenAiCompatModels({
        baseUrl: "https://api.openai.com/v1",
        apiKey: input.apiKey ?? "",
        provider: "openai",
      })
    case "groq":
      return fetchOpenAiCompatModels({
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: input.apiKey ?? "",
        provider: "groq",
      })
    case "cerebras":
      return fetchOpenAiCompatModels({
        baseUrl: "https://api.cerebras.ai/v1",
        apiKey: input.apiKey ?? "",
        provider: "cerebras",
      })
    case "openai-compat":
      return fetchOpenAiCompatModels({
        baseUrl: input.openAiCompatBaseUrl ?? "",
        apiKey: input.apiKey ?? "not-needed",
        provider: "openai-compat",
      })
    case "ollama":
      return fetchOllamaModels(input.ollamaBaseUrl ?? "http://localhost:11434")
    default:
      return []
  }
}

interface GeminiModelEntry {
  name: string
  displayName?: string
  supportedGenerationMethods?: string[]
  outputTokenLimit?: number
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  const data = await fetchJsonWithTimeout<{ models?: GeminiModelEntry[] }>(url, {})
  const out: ModelInfo[] = []
  for (const m of data.models ?? []) {
    const methods = m.supportedGenerationMethods ?? []
    const capabilities = methods.filter((x): x is ModelCapability =>
      x === "generateContent" || x === "embedContent" || x === "countTokens"
    )
    if (!capabilities.includes("generateContent") && !capabilities.includes("embedContent")) continue
    const lower = m.name.toLowerCase()
    out.push({
      name: m.name,
      displayName: m.displayName ?? m.name,
      capabilities,
      tags: classifyGemini(lower, capabilities),
      outputTokenLimit: m.outputTokenLimit ?? 0,
    })
  }
  return out
}

function classifyGemini(name: string, caps: ModelCapability[]): ModelTag[] {
  const tags: ModelTag[] = []
  if (caps.includes("embedContent") || name.includes("embedding")) tags.push("embedding")
  if (name.includes("flash-lite") || name.includes("2.0-flash") || name.includes("flash-8b")) tags.push("fast")
  if (name.includes("2.5") && !name.includes("lite")) tags.push("powerful")
  if (name.includes("preview") || name.includes("experimental")) tags.push("preview")
  return Array.from(new Set(tags))
}

interface OpenAiModelEntry {
  id: string
  object?: string
}

async function fetchOpenAiCompatModels(opts: {
  baseUrl: string
  apiKey: string
  provider: AiProviderName
}): Promise<ModelInfo[]> {
  if (!opts.baseUrl) return []
  const data = await fetchJsonWithTimeout<{ data?: OpenAiModelEntry[] }>(
    `${opts.baseUrl.replace(/\/$/, "")}/models`,
    { headers: { Authorization: `Bearer ${opts.apiKey}` } }
  )
  const out: ModelInfo[] = []
  for (const m of data.data ?? []) {
    if (!m.id) continue
    const id = m.id
    const lower = id.toLowerCase()
    // Skip fine-tunes and audio/vision/moderation models.
    if (lower.startsWith("ft:")) continue
    if (lower.includes("whisper") || lower.includes("tts") || lower.includes("dall-e")) continue
    if (lower.includes("moderation")) continue

    const isEmbedding = lower.includes("embedding")
    const capabilities: ModelCapability[] = isEmbedding ? ["embedContent"] : ["generateContent"]
    const tags = classifyOpenAiCompat(lower, opts.provider)

    out.push({
      name: id,
      displayName: id,
      capabilities,
      tags,
      outputTokenLimit: 0,
    })
  }
  return out
}

function classifyOpenAiCompat(name: string, provider: AiProviderName): ModelTag[] {
  const tags: ModelTag[] = []
  if (name.includes("embedding")) tags.push("embedding")

  if (provider === "openai") {
    if (name.includes("mini") || name.includes("nano") || name.includes("3.5")) tags.push("fast")
    if (name.startsWith("gpt-4o") && !name.includes("mini")) tags.push("powerful")
    if (name.startsWith("gpt-4") && !name.includes("o-mini")) tags.push("powerful")
    if (name.startsWith("o1") || name.startsWith("o3") || name.startsWith("o4")) tags.push("powerful")
  } else if (provider === "groq" || provider === "cerebras") {
    if (name.includes("8b") || name.includes("instant") || name.includes("mini")) tags.push("fast")
    if (name.includes("70b") || name.includes("405b") || name.includes("versatile")) tags.push("powerful")
  } else {
    // openai-compat: assume locally-hosted, prefer fast.
    if (!name.includes("embedding")) tags.push("fast")
  }

  if (name.includes("preview") || name.includes("experimental")) tags.push("preview")
  return Array.from(new Set(tags))
}

interface OllamaTagEntry {
  name: string
  size?: number
}

async function fetchOllamaModels(baseUrl: string): Promise<ModelInfo[]> {
  const data = await fetchJsonWithTimeout<{ models?: OllamaTagEntry[] }>(
    `${baseUrl.replace(/\/$/, "")}/api/tags`,
    {}
  )
  return (data.models ?? []).map((m) => {
    const isEmbedding = m.name.toLowerCase().includes("embed")
    return {
      name: m.name,
      displayName: m.name,
      capabilities: (isEmbedding ? ["embedContent"] : ["generateContent"]) as ModelCapability[],
      tags: (isEmbedding ? ["embedding"] : ["fast"]) as ModelTag[],
      outputTokenLimit: 0,
    }
  })
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) {
      throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}
