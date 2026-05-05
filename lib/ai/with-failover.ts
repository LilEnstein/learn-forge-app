import { decryptKey } from "./crypto"
import { createProvider, type AIProvider, type ProviderConfig } from "./provider"
import { getDefaultKey, getNextActiveKey, markQuotaExceeded, markInvalid, touchLastUsed } from "./keys"
import {
  NoActiveKeyError,
  QuotaExhaustedError,
  InvalidUserKeyError,
} from "./errors"
import type { TaskType } from "./types"
import { resolveModelForTask } from "./user-provider"
import type { UserApiKey } from "@prisma/client"

interface ResolvedKey {
  key: UserApiKey
  provider: AIProvider
}

const LLM_ONLY_PROVIDERS = new Set(["groq", "cerebras"])

function getEnvEmbeddingKey(): string | undefined {
  const ep = process.env.EMBEDDING_PROVIDER || process.env.AI_PROVIDER || "gemini"
  const map: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    "openai-compat": process.env.OPENAI_COMPAT_API_KEY,
  }
  return map[ep]
}

async function buildProviderFromKey(
  userId: string,
  key: UserApiKey,
  task: TaskType
): Promise<AIProvider> {
  const apiKey = key.encryptedKey ? decryptKey(key.encryptedKey, key.iv, key.authTag) : ""
  const taskModel = await resolveModelForTask(userId, task)

  const config: ProviderConfig = {
    provider: key.provider,
    apiKey,
    ollamaBaseUrl: key.ollamaBaseUrl ?? undefined,
    capableModel: task === "embedding" ? undefined : taskModel,
    fastModel: task === "companion" ? taskModel : undefined,
  }

  if (LLM_ONLY_PROVIDERS.has(key.provider)) {
    config.embeddingProvider = process.env.EMBEDDING_PROVIDER || "gemini"
    config.embeddingApiKey = getEnvEmbeddingKey()
  }

  return createProvider(config)
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined
  const e = err as { status?: number; statusCode?: number; response?: { status?: number } }
  return e.status ?? e.statusCode ?? e.response?.status
}

function isQuotaError(err: unknown): boolean {
  if (extractStatus(err) === 429) return true
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? ""
  return msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted")
}

function isAuthError(err: unknown): boolean {
  const status = extractStatus(err)
  if (status === 401 || status === 403) return true
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? ""
  return msg.includes("invalid api key") || msg.includes("unauthorized") || msg.includes("api_key_invalid")
}

/**
 * Run `fn(provider)` with the user's default key. On a 429/quota error, mark the
 * key as quota_exceeded and retry once with the next active key. On a 401, mark
 * the key invalid and bubble up. Throws NoActiveKeyError if no key is available.
 */
export async function withFailover<T>(
  userId: string,
  task: TaskType,
  fn: (provider: AIProvider, meta: { keyId: string; keyName: string; provider: string }) => Promise<T>
): Promise<T> {
  const initial = await getDefaultKey(userId)
  if (!initial) throw new NoActiveKeyError()

  let current: ResolvedKey = {
    key: initial,
    provider: await buildProviderFromKey(userId, initial, task),
  }
  let attempt = 0
  const MAX_RETRIES = 1

  while (true) {
    try {
      const result = await fn(current.provider, {
        keyId: current.key.id,
        keyName: current.key.name,
        provider: current.key.provider,
      })
      // Best-effort: update lastUsedAt (don't throw if it fails)
      touchLastUsed(current.key.id).catch(() => {})
      return result
    } catch (err) {
      if (isAuthError(err)) {
        await markInvalid(current.key.id)
        throw new InvalidUserKeyError()
      }
      if (isQuotaError(err)) {
        await markQuotaExceeded(current.key.id)
        if (attempt >= MAX_RETRIES) {
          const refreshed = await getDefaultKey(userId)
          throw new QuotaExhaustedError(refreshed?.quotaResetHint ?? undefined)
        }
        const next = await getNextActiveKey(userId, current.key.id)
        if (!next) {
          const exhaustedKey = await getDefaultKey(userId)
          throw new NoActiveKeyError(exhaustedKey?.quotaResetHint ?? undefined)
        }
        current = {
          key: next,
          provider: await buildProviderFromKey(userId, next, task),
        }
        attempt += 1
        continue
      }
      throw err
    }
  }
}
