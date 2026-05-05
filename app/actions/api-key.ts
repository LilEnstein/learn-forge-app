"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { encryptKey, decryptKey } from "@/lib/ai/crypto"
import { createProvider } from "@/lib/ai/provider"
import { fetchAvailableModels } from "@/lib/ai/model-discovery"
import {
  setDefaultKey as setDefaultKeyDb,
  removeKey as removeKeyDb,
  getKeyById,
} from "@/lib/ai/keys"
import type { ModelInfo, AiProviderName } from "@/lib/ai/types"
import { ALL_PROVIDERS } from "@/lib/ai/types"

const VERIFY_TIMEOUT_MS = 10_000

const PROVIDER_ENUM = z.enum(ALL_PROVIDERS as [AiProviderName, ...AiProviderName[]])

const AddKeySchema = z
  .object({
    name: z.string().min(1).max(50),
    provider: PROVIDER_ENUM,
    apiKey: z.string().min(1).optional(),
    ollamaBaseUrl: z.string().url().optional(),
    openAiCompatBaseUrl: z.string().url().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((d) => (d.provider === "ollama" ? !!d.ollamaBaseUrl : !!d.apiKey), {
    message: "API key required for non-Ollama providers",
  })

type AddKeyInput = z.infer<typeof AddKeySchema>

const VERIFY_MODELS: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  groq: "llama-3.1-8b-instant",
  cerebras: "llama3.1-8b",
}

function maskKey(key: string): string {
  if (key.length <= 10) return "••••••••••"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

async function verifyKey(input: AddKeyInput): Promise<void> {
  const { provider, apiKey, ollamaBaseUrl, openAiCompatBaseUrl } = input

  if (provider === "ollama") {
    const baseUrl = ollamaBaseUrl ?? "http://localhost:11434"
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal })
      if (!res.ok) throw Object.assign(new Error("Ollama unreachable"), { status: res.status })
    } catch (err: unknown) {
      const e = err as { name?: string }
      if (e.name === "AbortError") throw Object.assign(new Error("timeout"), { isTimeout: true })
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

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error("timeout"), { isTimeout: true })), VERIFY_TIMEOUT_MS)
  )

  try {
    await Promise.race([llm([{ role: "user", content: "Hi" }]), timeoutPromise])
  } catch (err: unknown) {
    const e = err as { isTimeout?: boolean; status?: number; statusCode?: number; response?: { status?: number }; message?: string }
    if (e.isTimeout) throw err
    const status = e.status ?? e.statusCode ?? e.response?.status ?? 0
    if (status === 400 || status === 401 || status === 403) {
      throw Object.assign(new Error("invalid_key"), { isInvalidKey: true })
    }
    if (status === 404) {
      throw Object.assign(new Error("model_not_found"), { isModelNotFound: true })
    }
    if (status === 429) {
      throw Object.assign(new Error("rate_limited"), { isRateLimited: true })
    }
    const msg = (e.message ?? "").toLowerCase()
    if (msg.includes("api key") || msg.includes("invalid key") || msg.includes("unauthorized")) {
      throw Object.assign(new Error("invalid_key"), { isInvalidKey: true })
    }
    throw err
  }
}

function verifyErrorMessage(err: unknown): string {
  const e = err as { isTimeout?: boolean; isInvalidKey?: boolean; isRateLimited?: boolean; isModelNotFound?: boolean; message?: string }
  if (e.isTimeout) return "Không thể kết nối đến provider. Kiểm tra mạng và thử lại."
  if (e.isInvalidKey) return "API key không hợp lệ. Kiểm tra lại trong provider dashboard."
  if (e.isRateLimited) return "Key hợp lệ nhưng đang bị rate limit. Thử lại sau ít phút."
  if (e.isModelNotFound) return "Model xác minh không còn khả dụng."
  console.error("[api-key verify] unexpected error:", err)
  return `Lỗi xác minh key: ${e.message ?? "unknown"}`
}

export interface UserApiKeySummary {
  id: string
  name: string
  provider: string
  maskedKey: string
  isDefault: boolean
  status: "active" | "quota_exceeded" | "invalid"
  quotaResetHint: Date | null
  lastUsedAt: Date | null
  ollamaBaseUrl: string | null
  availableModels: ModelInfo[] | null
  modelsFetchedAt: Date | null
  createdAt: Date
}

function summarize(record: {
  id: string
  name: string
  provider: string
  encryptedKey: string
  iv: string
  authTag: string
  ollamaBaseUrl: string | null
  isDefault: boolean
  status: string
  quotaResetHint: Date | null
  lastUsedAt: Date | null
  availableModels: unknown
  modelsFetchedAt: Date | null
  createdAt: Date
}): UserApiKeySummary {
  const display = record.encryptedKey
    ? maskKey(decryptKey(record.encryptedKey, record.iv, record.authTag))
    : record.ollamaBaseUrl ?? ""
  return {
    id: record.id,
    name: record.name,
    provider: record.provider,
    maskedKey: display,
    isDefault: record.isDefault,
    status: record.status as UserApiKeySummary["status"],
    quotaResetHint: record.quotaResetHint,
    lastUsedAt: record.lastUsedAt,
    ollamaBaseUrl: record.ollamaBaseUrl,
    availableModels: (record.availableModels as ModelInfo[] | null) ?? null,
    modelsFetchedAt: record.modelsFetchedAt,
    createdAt: record.createdAt,
  }
}

export async function getUserApiKeys(): Promise<UserApiKeySummary[]> {
  const session = await requireSession()
  const userId = session.user.id as string
  const rows = await prisma.userApiKey.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  })
  return rows.map(summarize)
}

export async function addUserApiKey(
  input: AddKeyInput
): Promise<{ ok: true; key: UserApiKeySummary } | { ok: false; error: string }> {
  const session = await requireSession()
  const userId = session.user.id as string

  const parsed = AddKeySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  try {
    await verifyKey(parsed.data)
  } catch (err) {
    return { ok: false, error: verifyErrorMessage(err) }
  }

  let availableModels: ModelInfo[] = []
  try {
    availableModels = await fetchAvailableModels({
      provider: parsed.data.provider,
      apiKey: parsed.data.apiKey,
      ollamaBaseUrl: parsed.data.ollamaBaseUrl,
      openAiCompatBaseUrl: parsed.data.openAiCompatBaseUrl,
    })
  } catch (err) {
    console.warn("[addUserApiKey] model discovery failed (non-fatal):", err)
  }

  const plainKey = parsed.data.apiKey ?? ""
  const encrypted = plainKey ? encryptKey(plainKey) : { encryptedKey: "", iv: "", authTag: "" }

  const existingCount = await prisma.userApiKey.count({ where: { userId } })
  const shouldBeDefault = parsed.data.isDefault === true || existingCount === 0

  const record = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.userApiKey.updateMany({ where: { userId }, data: { isDefault: false } })
    }
    return tx.userApiKey.create({
      data: {
        userId,
        name: parsed.data.name,
        provider: parsed.data.provider,
        ...encrypted,
        ollamaBaseUrl: parsed.data.ollamaBaseUrl ?? null,
        isDefault: shouldBeDefault,
        status: "active",
        availableModels: availableModels.length > 0 ? (availableModels as object) : undefined,
        modelsFetchedAt: availableModels.length > 0 ? new Date() : null,
      },
    })
  })

  revalidatePath("/app/settings")
  revalidatePath("/app/upload")
  return { ok: true, key: summarize(record) }
}

export async function removeUserApiKey(
  keyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  const userId = session.user.id as string
  const key = await getKeyById(userId, keyId)
  if (!key) return { ok: false, error: "Key not found" }
  await removeKeyDb(userId, keyId)
  revalidatePath("/app/settings")
  revalidatePath("/app/upload")
  return { ok: true }
}

export async function setDefaultUserApiKey(
  keyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  const userId = session.user.id as string
  const key = await getKeyById(userId, keyId)
  if (!key) return { ok: false, error: "Key not found" }
  await setDefaultKeyDb(userId, keyId)
  revalidatePath("/app/settings")
  revalidatePath("/app/upload")
  return { ok: true }
}

export async function refreshKeyModels(
  keyId: string
): Promise<{ ok: true; models: ModelInfo[] } | { ok: false; error: string }> {
  const session = await requireSession()
  const userId = session.user.id as string
  const key = await getKeyById(userId, keyId)
  if (!key) return { ok: false, error: "Key not found" }

  const apiKey = key.encryptedKey ? decryptKey(key.encryptedKey, key.iv, key.authTag) : undefined

  let models: ModelInfo[]
  try {
    models = await fetchAvailableModels({
      provider: key.provider as AiProviderName,
      apiKey,
      ollamaBaseUrl: key.ollamaBaseUrl ?? undefined,
    })
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  await prisma.userApiKey.update({
    where: { id: keyId },
    data: { availableModels: models as object, modelsFetchedAt: new Date() },
  })
  revalidatePath("/app/settings")
  return { ok: true, models }
}

const ModelConfigSchema = z.object({
  fileProcessing: z.string().nullable().optional(),
  courseGen: z.string().nullable().optional(),
  companion: z.string().nullable().optional(),
  embedding: z.string().nullable().optional(),
})

export type ModelConfigInput = z.infer<typeof ModelConfigSchema>

export async function saveModelConfig(input: ModelConfigInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  const userId = session.user.id as string
  const parsed = ModelConfigSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  await prisma.userModelConfig.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  })
  revalidatePath("/app/settings")
  return { ok: true }
}

export async function getModelConfig(): Promise<ModelConfigInput | null> {
  const session = await requireSession()
  const userId = session.user.id as string
  const config = await prisma.userModelConfig.findUnique({ where: { userId } })
  if (!config) return null
  return {
    fileProcessing: config.fileProcessing,
    courseGen: config.courseGen,
    companion: config.companion,
    embedding: config.embedding,
  }
}

// ─── Backward-compat single-key API (used by upload page banner check) ──

export async function getUserApiKeyStatus(): Promise<{
  provider: string
  maskedKey: string
  verifiedAt: Date
} | null> {
  const session = await requireSession()
  const userId = session.user.id as string
  const record = await prisma.userApiKey.findFirst({
    where: { userId, isDefault: true },
  })
  if (!record) return null

  const display = record.encryptedKey
    ? decryptKey(record.encryptedKey, record.iv, record.authTag)
    : record.ollamaBaseUrl ?? ""
  return {
    provider: record.provider,
    maskedKey: maskKey(display),
    verifiedAt: record.createdAt,
  }
}
