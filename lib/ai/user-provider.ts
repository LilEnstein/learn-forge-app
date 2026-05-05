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

async function tryPoolKey(provider: string): Promise<AIProvider | null> {
  const keys = await prisma.poolKey.findMany({
    where: { provider, isActive: true },
    orderBy: { priority: "asc" },
  })

  const today = new Date().toISOString().slice(0, 10)

  for (const key of keys) {
    // Reset counter if it's a new day
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

  // No user key — check env first, then pool keys
  const envProvider = process.env.AI_PROVIDER ?? "gemini"
  if (hasEnvKey(envProvider)) return defaultProvider

  const poolProvider = await tryPoolKey(envProvider)
  if (poolProvider) return poolProvider

  throw new NoAiKeyError()
}
