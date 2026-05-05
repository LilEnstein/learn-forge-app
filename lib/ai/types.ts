// Shared types for Feature 10 — multi-key manager + per-task model config.

export type ModelCapability = "generateContent" | "embedContent" | "countTokens"
export type ModelTag = "fast" | "powerful" | "embedding" | "preview"

export interface ModelInfo {
  name: string
  displayName: string
  capabilities: ModelCapability[]
  tags: ModelTag[]
  outputTokenLimit: number
}

export type TaskType = "fileProcessing" | "courseGen" | "companion" | "embedding"

export type KeyStatus = "active" | "quota_exceeded" | "invalid"

export type AiProviderName = "gemini" | "openai" | "groq" | "cerebras" | "ollama" | "openai-compat"

export const ALL_PROVIDERS: AiProviderName[] = [
  "gemini",
  "openai",
  "groq",
  "cerebras",
  "ollama",
  "openai-compat",
]

// Capability + tag preferences per task. Used by the model picker UI to filter
// the list of available models a key can offer.
export const TASK_REQUIREMENTS: Record<
  TaskType,
  { capability: ModelCapability; preferTags: ModelTag[]; nameMustInclude?: string }
> = {
  fileProcessing: { capability: "generateContent", preferTags: ["powerful"] },
  courseGen: { capability: "generateContent", preferTags: ["powerful"] },
  companion: { capability: "generateContent", preferTags: ["fast"] },
  embedding: { capability: "embedContent", preferTags: ["embedding"], nameMustInclude: "embedding" },
}

// Env-var defaults for each task — used as final fallback when user has no key
// configured and no per-task override.
export const TASK_ENV_FALLBACK: Record<TaskType, string> = {
  fileProcessing: "GEMINI_MODEL",
  courseGen: "GEMINI_MODEL",
  companion: "GEMINI_MODEL_LITE",
  embedding: "GEMINI_EMBEDDING_MODEL",
}
