import { prisma } from "@/lib/db/prisma"
import { decryptKey } from "./crypto"
import { createProvider, getLLM, getLLMStream, getEmbeddingModel, type AIProvider, type ProviderConfig } from "./provider"
import { NoAiKeyError, InvalidUserKeyError } from "./errors"
import type { TaskType } from "./types"
import { TASK_ENV_FALLBACK } from "./types"
import { getDefaultKey } from "./keys"

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

async function tryPoolKey(provider: string): Promise<AIProvider | null> {
  const keys = await prisma.poolKey.findMany({
    where: { provider, isActive: true },
    orderBy: { priority: "asc" },
  })

  const today = new Date().toISOString().slice(0, 10)

  for (const key of keys) {
    if (key.lastResetAt.toISOString().slice(0, 10) < today) {
      await prisma.poolKey.update({
        where: { id: key.id },
        data: { dailyUsed: 0, lastResetAt: new Date() },
      })
      key.dailyUsed = 0
    }

    if (key.dailyUsed < key.dailyLimit) {
      await prisma.poolKey.update({ where: { id: key.id }, data: { dailyUsed: { increment: 1 } } })
      const apiKey = decryptKey(key.encryptedKey, key.iv, key.authTag)
      return createProvider({ provider, apiKey })
    }
  }

  return null
}

/**
 * Resolves which model name to use for a given task. Falls back through:
 *   1. UserModelConfig override for the task
 *   2. Env var listed in TASK_ENV_FALLBACK[task]
 *   3. undefined → provider uses its own default
 */
export async function resolveModelForTask(
  userId: string,
  task: TaskType
): Promise<string | undefined> {
  const config = await prisma.userModelConfig.findUnique({ where: { userId } })
  if (config && config[task]) return config[task] as string
  const envName = TASK_ENV_FALLBACK[task]
  return envName ? process.env[envName] : undefined
}

/**
 * Returns an AIProvider for the given user.
 * Resolution order:
 *   1. User's default UserApiKey with status="active" → decrypt → createProvider
 *   2. No active user key but env var configured → defaultProvider (env-backed)
 *   3. No env key but admin pool has keys → pool key
 *   4. Else throw NoAiKeyError
 *
 * The optional `task` argument allows the caller to pick the model configured
 * for that task (per-task model selection from Feature 10).
 */
export async function getProviderForUser(userId: string, task?: TaskType): Promise<AIProvider> {
  const record = await getDefaultKey(userId)

  if (record) {
    if (record.status === "invalid") throw new InvalidUserKeyError()

    const apiKey = record.encryptedKey ? decryptKey(record.encryptedKey, record.iv, record.authTag) : ""
    const taskModel = task ? await resolveModelForTask(userId, task) : undefined

    const config: ProviderConfig = {
      provider: record.provider,
      apiKey,
      ollamaBaseUrl: record.ollamaBaseUrl ?? undefined,
      capableModel: task === "embedding" ? undefined : taskModel,
      fastModel: task === "companion" ? taskModel : undefined,
    }

    if (LLM_ONLY_PROVIDERS.has(record.provider)) {
      config.embeddingProvider = process.env.EMBEDDING_PROVIDER || "gemini"
      config.embeddingApiKey = getEnvEmbeddingKey()
    }

    return createProvider(config)
  }

  const envProvider = process.env.AI_PROVIDER ?? "gemini"
  if (hasEnvKey(envProvider)) return defaultProvider

  const poolProvider = await tryPoolKey(envProvider)
  if (poolProvider) return poolProvider

  throw new NoAiKeyError()
}
